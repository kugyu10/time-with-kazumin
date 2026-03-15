# 技術スタックリサーチ

**ドメイン:** コーチングセッション予約システム（ポイント制サブスクリプション）
**調査日:** 2026-03-15
**全体信頼度:** HIGH

---

## E2Eテストスタック（v1.2 追加分）

このセクションは v1.2 マイルストーン「E2Eテスト環境導入」のための調査結果。
既存スタック（下部参照）に対してテストインフラを追加する。

### 結論: Playwright を採用する

**理由:** Next.js 15 App Router + Vercel + Supabase の組み合わせに対して、Playwright が最も適合する。
Cypress と比較して、CI コスト（並列実行が無料）、Vercel プレビューデプロイとの統合パターン、
そして Supabase 認証のバイパス方法が確立されている点で優位。

---

### E2Eコアライブラリ

| ライブラリ | バージョン | 用途 | 推奨理由 |
|-----------|-----------|------|----------|
| `@playwright/test` | `1.58.2` | E2Eテストランナー | 最新安定版（2026-01-30リリース）。Next.js公式ガイドで推奨。App Router / Server Components テストに対応。 |

**インストール:**
```bash
npm install -D @playwright/test@1.58.2
npx playwright install --with-deps chromium
```

CI環境では `chromium` のみインストールで十分（Firefox/WebKit は cross-browser 要件がなければ不要）。

---

### Supabase 認証テスト戦略

このプロジェクトでは Google OAuth とメール/パスワードの2方式が存在する。
E2E テストで認証を扱うには以下のパターンを組み合わせる。

#### パターン1: storageState によるセッション再利用（メイン戦略）

Playwright の `storageState` を使い、認証済みセッションをファイルに保存して再利用する。
テストごとにログインフローを実行せず、セットアップを1回だけ行う。

```typescript
// playwright/global-setup.ts
// Supabase REST API でメール/パスワード認証 → storageState に保存
```

認証状態ファイルは `.gitignore` に追加必須（セッション情報が含まれるため）。

#### パターン2: Google OAuth のバイパス

Google OAuth は本物のフローをテストで通すことが困難（Bot 検出）。
代替アプローチ：

- テスト専用ユーザーをメール/パスワード認証で作成し、Google OAuth テストは対象外とする
- または Supabase Admin API でセッショントークンを直接発行し `localStorage` にセット

**推奨:** テスト用にメール/パスワードユーザーを1名作成する（Supabase dev プロジェクトに固定）。
Google OAuth フロー自体の E2E テストは ROI が低いため対象外とする。

#### パターン3: ゲストフロー（認証なし）

認証が不要なゲスト予約フローは最もシンプル。認証バイパス不要でそのまま動作確認できる。

---

### Vercel プレビューデプロイ統合

| アプローチ | 設定 | 備考 |
|-----------|------|------|
| GitHub Actions + Vercel webhook | `repository_dispatch` でデプロイ完了後にテスト起動 | Vercel 公式推奨パターン |
| `patrickedqvist/wait-for-vercel-preview` | PR の preview URL を待機して BASE_URL に設定 | 最もシンプルな統合 |

**Deployment Protection について:**
`develop` ブランチのデプロイに Vercel Authentication（パスワード保護）が有効な場合、
テストがアクセスできない。無効化するか、Protection Bypass for Automation（有料 $150/月）が必要。
有料は不要なため、**develop 環境のデプロイ保護を無効にする**のが現実的。

**推奨 GitHub Actions 構成:**
```yaml
# .github/workflows/e2e.yml
# Vercel preview deployment 完了後にトリガー
# BASE_URL に preview URL を渡して Playwright 実行
```

---

### データクリーンアップ

| ライブラリ | バージョン | 用途 | 採用判断 |
|-----------|-----------|------|---------|
| `supawright` | `0.4.2` | Supabase テストデータ自動クリーンアップ | **採用しない（YAGNI）** |

`supawright` は Supabase のテーブル構造を読んでテストデータを自動生成・削除するライブラリ。
現時点では週3〜5件という小規模のため、テスト後の手動クリーンアップ（`afterAll` で SQL 直接実行）で十分。

テストデータ管理は Playwright の `globalSetup` / `globalTeardown` でシンプルに実装する。

---

### 環境変数管理

```
.env.test.local        # ローカル E2E テスト用（.gitignore 済み）
.env.test              # CI 環境用の非機密デフォルト値
```

`playwright.config.ts` で `dotenv` を使って `.env.test.local` を読み込む。
CI では GitHub Secrets として `SUPABASE_TEST_URL`、`SUPABASE_TEST_ANON_KEY`、
`TEST_USER_EMAIL`、`TEST_USER_PASSWORD` を登録する。

**dotenv は既存の Next.js に同梱されているため追加インストール不要。**

---

### 採用しないもの（Anti-Features）

| 却下技術 | 理由 |
|---------|------|
| Cypress | 並列実行が有料（Cypress Cloud）。Playwright で全て代替可能。 |
| Selenium / WebdriverIO | 設定コスト高、エコシステムが Playwright より劣る。 |
| `supawright` | 現規模では不要（YAGNI）。 |
| `playwright-extra` + `stealth` | 2023年3月以降メンテナンス停止。使わない。 |
| InBucket（ローカルメールキャッチャー） | ローカル Supabase が不要な dev プロジェクト前提テストで不要。 |
| ローカル Supabase（`supabase start`） | CI で dev プロジェクトに直接接続する方針のため不要。ただし将来的に要検討。 |
| msw（Mock Service Worker） | Supabase dev プロジェクトを使うため API モック不要。単体テスト（Vitest）側で使う。 |

---

### E2E テストスコープ

現規模（週3〜5件、ユーザー約10人）に適切な優先順位:

**優先度: 高（クリティカルパス）**
1. ゲスト予約フロー（予約 → 確認画面 → Zoom URL 表示）
2. 会員ログイン → ポイント確認 → 予約フロー
3. 予約キャンセル → ポイント返還確認

**優先度: 中（安定性確認）**
4. 管理者ログイン → 予約一覧確認
5. 招待メール送信フロー（v1.2 バグ修正対象）

**優先度: 低（後回し）**
6. Google OAuth フロー（Bot 検出のため自動化困難）
7. Zoom 会議生成・削除（外部 API 依存、E2E より統合テスト向き）

---

## 既存スタック（v1.0 / v1.1 確定済み）

### コア技術

| 技術 | バージョン | 用途 | 推奨理由 |
|------|----------|------|----------|
| Next.js | 15.x (最新安定版) | フルスタックフレームワーク | App Router安定版、React 19対応、Vercel最適化。Turbopack Dev安定化で開発体験向上。**注意:** Next.js 16も2026年2月時点でリリース済み。移行は慎重に検討。 |
| React | 19.x | UIライブラリ | Next.js 15がReact 19 RC対応。React Compiler（実験的）で自動最適化。Pages RouterではReact 18も利用可能だが、App Routerでは19推奨。 |
| TypeScript | 5.8.x | 型安全性 | 2025年2月リリースの最新安定版。ESM `require()` サポート、`--erasableSyntaxOnly`フラグ、パフォーマンス最適化。TypeScript 6.0はQ1 2026予定。 |
| Supabase | マネージド（最新） | BaaS (PostgreSQL + Auth + Edge Functions) | PostgreSQLトランザクションでポイント管理の整合性担保、RLS宣言的アクセス制御、Auth+Storage+Functionsオールインワン。無料枠500MBでMVP十分。 |
| @supabase/supabase-js | 2.97.0+ | Supabaseクライアント | 2026年2月時点最新。Node.js 18サポート終了（v2.79.0以降）。Node.js 20以上必須。 |
| PostgreSQL | 15+ (Supabaseマネージド) | リレーショナルDB | ポイント残高管理にトランザクションと関数必須。Stored Procedure（PG 11+）で複雑なポイント付与・消費ロジック実装。 |

### UIライブラリ・スタイリング

| 技術 | バージョン | 用途 | 推奨理由 |
|------|----------|------|----------|
| shadcn/ui | 3.8.5+ (CLI最新) | UIコンポーネント | コピペベース（vendor lock-in回避）、Radix UI統合（2026年2月から`radix-ui`統合パッケージ）、Base UI対応、RTLサポート追加。ブランドカラー変更が容易。 |
| Tailwind CSS | 4.x | ユーティリティCSS | 2025年初頭に安定版リリース。Rust製Oxideエンジンで5倍高速ビルド、CSS-first設定（`@theme`ディレクティブ）、Modern CSS（cascade layers, `@property`）。**重要:** v4は`tailwind.config.js`から`@theme`ディレクティブへ移行。 |
| Radix UI | 最新（統合パッケージ） | アクセシブルプリミティブ | shadcn/uiの基盤。2026年2月から個別パッケージ（`@radix-ui/react-*`）から統合`radix-ui`パッケージへ移行。 |

### サーバーレス・デプロイ

| 技術 | バージョン | 用途 | 推奨理由 |
|------|----------|------|----------|
| Vercel | マネージド | Next.jsホスティング | Next.js開発元。プレビューデプロイ、Edge Functions、無料枠でMVP十分。環境変数64KB制限、Edge Runtime 5KB制限に注意。 |
| Supabase Edge Functions | Deno 2対応 | サーバーレス関数 | Denoランタイム（Node.js不要）、TypeScriptファースト。月次ポイント付与、リマインダー、サンキューメール自動送信。`EdgeRuntime.waitUntil()`で非同期処理。**ベストプラクティス:** Fat Functions（関連機能を1つに集約）、`/tmp`のみ書き込み可、秘密情報は環境変数。 |

### メール送信

| 技術 | バージョン | 用途 | 推奨理由 |
|------|----------|------|----------|
| Resend | 最新 | トランザクションメール送信 | 無料枠3,000通/月、React Emailと同一チーム開発でシームレス統合。SPF/DKIM/DMARC対応、バッチ送信100件/リクエスト。 |
| React Email | 5.x | メールテンプレート | 2026年最新メジャーバージョン。Reactコンポーネントでテンプレート作成、Tailwind 4対応、ダークモード対応、React 19 + Next.js 16互換。週間DL 92万（前バージョン比117%増）。 |

### 外部API統合

| 技術 | バージョン | 用途 | 推奨理由 |
|------|----------|------|----------|
| Google Calendar API | v3 | カレンダー同期・祝日判定 | サービスアカウント認証（ユーザーOAuth不要）。`freebusy.query`で空き時間取得、`events.insert/delete`で予約連動。15分キャッシュでRate Limit回避。 |
| Zoom API | v2 | ビデオミーティング生成 | Server-to-Server OAuth（2アカウント対応）。`POST /users/me/meetings`でミーティング作成、`DELETE /meetings/{id}`で削除。AES-GCM 256bit暗号化（at rest）、TLS 1.2（in transit）。 |
| Google Calendar URLスキーム | N/A | ユーザーカレンダー追加 | `https://calendar.google.com/calendar/render?action=TEMPLATE`でOAuth審査回避。全ユーザー（ゲスト含む）共通実装。 |

### サポートライブラリ

| ライブラリ | バージョン | 用途 | 使用タイミング |
|----------|----------|------|--------------|
| Zod | 3.x | スキーマ検証 | API入力、フォーム検証、環境変数検証。TypeScript型推論統合、`.safeParse()`で本番エラーハンドリング。 |
| date-fns | 4.x | 日時操作 | 営業時間計算、予約時間バリデーション、タイムゾーン変換。関数型アプローチ、Tree-shakingで10KB gzipped。 |
| googleapis | 最新 | Google API Node.jsクライアント | Google Calendar API、サービスアカウント認証。公式SDK。 |

### テストライブラリ（既存）

| ライブラリ | バージョン | 用途 | 備考 |
|----------|----------|------|------|
| vitest | 4.x | 単体テスト / 統合テスト | 既存導入済み。ユーティリティ関数、フック、Server Actions のテスト。 |
| @testing-library/react | 16.x | コンポーネントテスト | 既存導入済み。 |

### 開発ツール

| ツール | 用途 | 備考 |
|------|------|------|
| Supabase CLI | マイグレーション管理、型生成 | `supabase gen types`でTypeScript型自動生成。ローカルDev環境（Docker）。 |
| ESLint | 静的解析 | ESLint 9対応（Next.js 15）。Flat Config推奨。`eslint-plugin-react-hooks` v5.0.0。 |
| Turbopack | 開発サーバー・ビルド | Next.js 15で安定版。`next dev --turbo`で76.7%高速起動、96.3%高速HMR（Vercel.com実績）。 |

---

## インストール（E2Eテスト追加分）

```bash
# E2Eテスト（新規追加）
npm install -D @playwright/test@1.58.2
npx playwright install --with-deps chromium
```

```bash
# 既存スタック（参考）
npm install next@latest react@latest react-dom@latest
npm install @supabase/supabase-js@latest @supabase/ssr@latest
npx shadcn@latest init
npm install resend@latest react-email@latest @react-email/components@latest
npm install zod@latest date-fns@latest googleapis@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest
npm install -D eslint@latest eslint-config-next@latest
npm install -D supabase@latest
```

---

## 信頼度評価

| 領域 | 信頼度 | 根拠 |
|------|--------|------|
| Playwright バージョン | **HIGH** | npm registry で 1.58.2 確認済み（2026-01-30リリース） |
| Next.js + Playwright 統合 | **HIGH** | Next.js 公式ドキュメント（2026-02-27更新）で確認 |
| Vercel プレビューデプロイ統合 | **HIGH** | Vercel Knowledge Base 公式記事で確認 |
| Supabase 認証バイパス | **MEDIUM** | 複数のコミュニティ記事で確認。Google OAuth バイパスは困難という点も合致 |
| storageState 認証再利用 | **HIGH** | Playwright 公式ドキュメントで確認 |
| E2E テストスコープ推奨 | **MEDIUM** | コミュニティベストプラクティスから推定。プロジェクト固有の調整必要 |

---

## 情報ソース

### E2Eテスト関連（HIGH信頼度）
- [Next.js App Router Testing Guide（公式）](https://nextjs.org/docs/app/guides/testing) — 2026-02-27更新
- [Next.js Playwright Setup（公式）](https://nextjs.org/docs/app/guides/testing/playwright) — 2026-02-27更新
- [Playwright Release Notes v1.58](https://playwright.dev/docs/release-notes) — 最新バージョン確認
- [Vercel E2E Testing with Preview Deployments](https://vercel.com/kb/guide/how-can-i-run-end-to-end-tests-after-my-vercel-preview-deployment) — 公式ガイド
- [Playwright Authentication（公式）](https://playwright.dev/docs/auth) — storageState パターン

### 比較・ベストプラクティス（MEDIUM信頼度）
- [Playwright vs Cypress 2026 Guide for Lean Teams](https://www.getautonoma.com/blog/playwright-vs-cypress)
- [Why Playwright Seems to Be Winning Over Cypress](https://www.d4b.dev/blog/2026-02-17-why-playwright-seems-to-be-winning-over-cypress-for-end-to-end-testing)
- [Login at Supabase via REST API in Playwright](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test)
- [Integrating Playwright with GitHub Workflow and Vercel](https://www.thisdot.co/blog/integrating-playwright-tests-into-your-github-workflow-with-vercel)
- [supawright GitHub](https://github.com/isaacharrisholt/supawright) — 採用しない理由の確認

### コアスタック関連（HIGH信頼度、v1.0/v1.1 調査時）
- [Next.js 15公式ブログ](https://nextjs.org/blog/next-15)
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog)
- [TypeScript 5.8公式発表](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/)
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)
- [Supabase公式ドキュメント](https://supabase.com/docs/guides/functions)

---
*スタックリサーチ更新: E2Eテストスタック調査追加*
*更新日: 2026-03-15*
*調査担当: GSD Project Researcher*
