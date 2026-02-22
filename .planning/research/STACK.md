# 技術スタックリサーチ

**ドメイン:** コーチングセッション予約システム（ポイント制サブスクリプション）
**調査日:** 2026-02-22
**全体信頼度:** HIGH

## 推奨スタック

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
| Supabase Edge Functions | Deno 2対応 | サーバーレス関数 | Denoランタイム（Node.js不要）、TypeScriptファーストt。月次ポイント付与、リマインダー、サンキューメール自動送信。`EdgeRuntime.waitUntil()`で非同期処理。**ベストプラクティス:** Fat Functions（関連機能を1つに集約）、`/tmp`のみ書き込み可、秘密情報は環境変数。 |

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
| Zod | 3.x | スキーマ検証 | API入力、フォーム検証、環境変数検証。TypeScript型推論統合、`.safeParse()`で本番エラーハンドリング。**ベストプラクティス:** strictMode有効、スキーマ再利用、パフォーマンス最適化（冗長検証回避）。 |
| date-fns | 4.x | 日時操作 | 営業時間計算、予約時間バリデーション、タイムゾーン変換。関数型アプローチ、Tree-shakingで10KB gzipped。**代替:** Day.js（2KB、Moment.js互換API）も選択肢だが、本プロジェクトでは関数型優先でdate-fns推奨。 |
| googleapis | 最新 | Google API Node.jsクライアント | Google Calendar API、サービスアカウント認証。公式SDK。 |
| @zoom/meetingsdk | 最新 | Zoom SDK（オプション） | Server-to-Server OAuth実装。REST API直接呼び出しでも可。 |

### 開発ツール

| ツール | 用途 | 備考 |
|------|------|------|
| Supabase CLI | マイグレーション管理、型生成 | `supabase gen types`でTypeScript型自動生成。ローカルDev環境（Docker）。 |
| ESLint | 静的解析 | ESLint 9対応（Next.js 15）。Flat Config推奨。`eslint-plugin-react-hooks` v5.0.0。 |
| Prettier | コードフォーマット | Tailwind CSS v4対応プラグイン必須。 |
| Turbopack | 開発サーバー・ビルド | Next.js 15で安定版。`next dev --turbo`で76.7%高速起動、96.3%高速HMR（Vercel.com実績）。Next.js 16でデフォルト化。 |

## インストール

```bash
# コアフレームワーク
npm install next@latest react@latest react-dom@latest

# Supabase
npm install @supabase/supabase-js@latest @supabase/ssr@latest

# UI・スタイリング
npx shadcn@latest init  # shadcn/ui初期化（Tailwind 4自動設定）

# メール
npm install resend@latest react-email@latest @react-email/components@latest

# サポートライブラリ
npm install zod@latest date-fns@latest googleapis@latest

# 開発依存
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest
npm install -D eslint@latest eslint-config-next@latest
npm install -D prettier@latest prettier-plugin-tailwindcss@latest
npm install -D supabase@latest  # Supabase CLI
```

## 代替技術検討

| 推奨 | 代替候補 | 代替を選ぶ条件 |
|------|----------|--------------|
| Next.js 15 | Remix | Vercel以外のホスティング（Cloudflare Workers等）を強く優先する場合。エコシステム成熟度はNext.js優位。 |
| Supabase | Firebase | NoSQLが要件に適合する場合。本プロジェクトではポイント管理トランザクション整合性が必須のためPostgreSQL推奨。 |
| Supabase | PlanetScale + Clerk + Cloudflare Workers | 各サービス個別最適化を望む場合。統合コストと開発速度でSupabaseが優位。 |
| Tailwind CSS 4 | CSS Modules / styled-components | CSS-in-JSが強く好まれる場合。本プロジェクトではユーティリティファーストが開発速度に適合。 |
| date-fns | Day.js | 超軽量（2KB）最優先、Moment.js移行の場合。本プロジェクトでは関数型・Tree-shaking優先でdate-fns。 |
| Resend | SendGrid | 月3,000通超の大量送信、SMSも必要な場合。MVP規模ではResend無料枠で十分。 |
| React Email | MJML | 既存MJMLテンプレート資産がある場合。新規開発ではReact Emailが型安全。 |

## 使用すべきでない技術

| 避けるべき技術 | 理由 | 代わりに使用 |
|--------------|------|------------|
| Moment.js | 2020年メンテナンス停止、巨大バンドル（67KB）。 | date-fns または Day.js |
| Next.js 14以前 | キャッシングセマンティクス変更（15でfetch/Route Handlerデフォルトuncached）、Turbopack未安定。 | Next.js 15.x |
| `@next/font`外部パッケージ | Next.js 15で削除。 | `next/font`（組み込み） |
| Tailwind CSS 3.x | v4でビルド速度5倍、Modern CSS対応。設定方式変更。 | Tailwind CSS 4.x |
| Node.js 18以下 | Next.js 15最小要件18.18.0。Supabase.js v2.79.0以降サポート終了。 | Node.js 20+ |
| PostgreSQL関数なしポイント管理 | アプリケーション層でのポイント計算は競合条件リスク高。 | PostgreSQL Stored Procedure（PG 11+） |
| クライアント側OAuth（Zoom/Google） | セキュリティリスク、秘密鍵露出。 | サーバー側認証（Next.js Route Handler、Supabase Edge Functions） |

## バリアント別スタックパターン

### 小規模MVP（現在のユーザー数10人、週3-5件予約）
```
Next.js 15 + Supabase無料枠 + Vercel無料枠 + Resend無料枠
= 完全無料運用可能
```

### スケールアップ時（ユーザー100人超、週20件以上）
```
Next.js 15 (Vercel Pro $20/月、60秒関数制限)
+ Supabase Pro $25/月（8GB、専用CPU）
+ Googleカレンダー同期をcronバッチ化（Rate Limit対策）
+ Resend有料プラン（$20/月、50,000通）
```

### 多言語対応時
```
現状スタック + shadcn/ui RTLサポート（2026年1月追加）
+ next-intl（App Router i18n推奨）
```

## バージョン互換性

| パッケージA | 互換パッケージB | 備考 |
|-----------|---------------|------|
| Next.js 15.x | React 19.x | App Routerは19推奨。Pages RouterはReact 18も可（混在非推奨）。 |
| Next.js 15.x | Node.js 18.18.0+ | 18.17以下は非対応。20以上推奨。 |
| Tailwind CSS 4.x | shadcn/ui 3.8.5+ | v4対応は2026年2月以降。古いバージョンはv3使用。 |
| @supabase/supabase-js 2.79.0+ | Node.js 20+ | 2.78.0まではNode.js 18対応。 |
| React Email 5.x | React 19.2 + Next.js 16 | Next.js 15でも使用可能だが、Next.js 16で最適化。 |
| Supabase Edge Functions | Deno 2 | Node.js APIも利用可能（NPMモジュールサポート）。 |

## セキュリティ考慮事項

### 環境変数管理
- **Vercel:** 64KB総量制限、Edge Runtime 5KB制限。`NEXT_PUBLIC_*`自動プレフィックス。
- **Supabase:** `SUPABASE_SERVICE_ROLE_KEY`はサーバー専用（RLSバイパス）、クライアント露出厳禁。
- **機密情報ローテーション:** CVE-2025-55184/55183（React Server Components脆弱性）対応済み確認。

### OAuth2セキュリティ（Zoom/Google）
- **スコープ最小化:** 必要最小限のスコープ要求（Incremental Authorization）。
- **トークン管理:** AES-GCM 256bit暗号化（Zoom）、TLS 1.2通信、1時間有効期限（Access Token）、90日（Refresh Token）。
- **サービスアカウント:** Google Calendar APIはサービスアカウント認証でユーザーOAuth回避。
- **監査:** 未使用OAuth2クライアント定期削除、Google Admin Consoleでアプリホワイトリスト管理。

### RLS（Row Level Security）
- Supabaseでユーザー・予約・ポイントデータの行レベルアクセス制御。
- `service_role`キーはクライアント側絶対使用禁止。

## 信頼度評価

| 領域 | 信頼度 | 根拠 |
|------|--------|------|
| コアフレームワーク（Next.js/React） | **HIGH** | 公式ブログ、GitHub Releases、複数ソース検証済み。 |
| Supabase | **HIGH** | 公式ドキュメント、2026年最新ベストプラクティス記事、実装例多数。 |
| UI/スタイリング（shadcn/Tailwind） | **HIGH** | 公式Changelog、リリースノート、移行ガイド確認済み。 |
| メール（Resend/React Email） | **HIGH** | 公式ブログ、React Email 5.0リリース情報、週間DL統計。 |
| 外部API（Zoom/Google） | **MEDIUM** | 公式ドキュメント確認済みだが、最新セキュリティパッチ状況は継続監視必要。 |
| バージョン番号 | **MEDIUM-HIGH** | npmレジストリ、GitHub Releasesで確認。一部パッケージは2026年2月以降の更新可能性あり。 |

## 情報ソース

### 公式ドキュメント・リリース情報（HIGH信頼度）
- [Next.js 15公式ブログ](https://nextjs.org/blog/next-15) — 主要機能、破壊的変更
- [Next.js GitHub Releases](https://github.com/vercel/next.js/releases) — 最新バージョン確認
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog) — 2026年2月Radix UI統合、RTLサポート
- [TypeScript 5.8公式発表](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/) — ESM require()サポート、パフォーマンス最適化
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4) — Rust製Oxideエンジン、5倍高速化
- [React Email 5.0](https://resend.com/blog/react-email-5) — Tailwind 4対応、React 19互換、ダークモード
- [Supabase公式ドキュメント](https://supabase.com/docs/guides/functions) — Edge Functions、Deno 2ベストプラクティス

### npmレジストリ（HIGH信頼度）
- [@supabase/supabase-js@2.97.0](https://www.npmjs.com/package/@supabase/supabase-js) — 最新版確認（2026-02-20公開）
- [shadcn CLI 3.8.5](https://www.npmjs.com/package/shadcn) — 最新CLI版

### 技術記事・ガイド（MEDIUM信頼度）
- [Supabaseベストプラクティス2026](https://www.leanware.co/insights/supabase-best-practices) — セキュリティ、スケーリング、メンテナビリティ
- [Resend Email Skills 2026](https://www.doppio.cc/blog/resend-email-skills) — ベストプラクティス、React Email統合
- [Zod TypeScript検証2026](https://oneuptime.com/blog/post/2026-01-25-zod-validation-typescript/view) — safeParse()、パフォーマンス最適化
- [PostgreSQL Stored Procedures 2026](https://oneuptime.com/blog/post/2026-01-25-use-stored-procedures-postgresql/view) — トランザクション管理、ポイントシステム実装
- [date-fns vs Day.js 2026](https://www.dhiwise.com/post/date-fns-vs-dayjs-the-battle-of-javascript-date-libraries) — バンドルサイズ、パフォーマンス比較

### セキュリティ情報（HIGH信頼度）
- [Google OAuthベストプラクティス](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) — スコープ最小化、トークン管理
- [Vercel環境変数セキュリティ](https://vercel.com/docs/environment-variables) — 64KB制限、OIDC対応
- [Vercelセキュリティ速報 CVE-2025-55184/55183](https://vercel.com/kb/bulletin/security-bulletin-cve-2025-55184-and-cve-2025-55183) — React 19脆弱性対応

---
*スタックリサーチ実施: コーチングセッション予約システム（ポイント制サブスクリプション）*
*調査日: 2026-02-22*
*Next.js 15、Supabase、React Email 5.0、Tailwind CSS 4.0を中心とした2026年最新スタック*
