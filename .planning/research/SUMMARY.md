# Project Research Summary

**Project:** Time with Kazumin — コーチングセッション予約システム
**Domain:** ポイント制サブスクリプション型予約管理 + E2Eテスト環境導入（v1.2）
**Researched:** 2026-02-22 / Updated: 2026-03-15 (E2Eテスト統合)
**Confidence:** HIGH

## Executive Summary

Time with Kazumin は Next.js 15 App Router + Supabase + Vercel で構築されたコーチングセッション予約システムであり、月次ポイント自動付与・Zoom アカウント自動振り分け・祝日対応営業時間という差別化機能を持つ。v1.2 マイルストーンでは既存システムの 4 つのバグ修正（Zoom URL 表示欠落、JST 時刻表示誤り、招待メール送信、カレンダーブロック反映）の確認と、Playwright による E2E テスト環境の導入を同時に行う。現在の規模は週 3〜5 件・ユーザー約 10 人という小規模であり、この規模に最適化されたシンプルな実装が求められる。

推奨アプローチは Playwright 1.58.2 の採用である。Cypress に対して並列実行コスト・Vercel Preview 統合パターン・Supabase 認証バイパスの確立度で明確に優位であり、Next.js 公式ドキュメント（2026-02-27 更新）でも推奨されている。認証戦略として Google OAuth の自動化は ToS 違反リスクと CI 環境での Bot 検出で実現不可能なため、Supabase REST API によるメール/パスワード認証 + storageState セッション再利用パターンを採用する。外部サービス（Zoom、Google Calendar、Resend）は `page.route()` でモックし、実 API 呼び出しを E2E 対象外とすることでクォータ消費と外部依存を回避する。

主要リスクは3点ある。Supabase dev 環境の接続数制限による並列テスト干渉（`workers: 1` で回避）、Vercel Preview URL の毎回変更（`patrickedqvist/wait-for-vercel-preview` で自動取得）、develop ブランチのデプロイ保護設定（現状確認の上で無効化が必要）。これらはすべて対策が確立されており、実装フェーズで確実に対処すれば高品質な CI/CD パイプラインを構築できる。既存システムの重大リスクである分散トランザクション補償処理・ポイント整合性・OAuth トークン管理は v1.0〜v1.1 でSaga パターンと Stored Procedures による設計が確定済みである。

## Key Findings

### Recommended Stack

既存スタック（Next.js 15 / React 19 / TypeScript 5.8 / Supabase / Vercel / Tailwind CSS v4 / shadcn/ui）は確定済みで安定している。v1.2 では E2E テストインフラとして Playwright を追加する。

**コアテクノロジー（確定済み）:**
- `Next.js 15.x`: フルスタックフレームワーク — App Router 安定版、React 19 対応、Vercel 最適化
- `Supabase (PostgreSQL 15+)`: BaaS — ポイント管理の ACID 保証に Stored Procedures が必須、RLS で宣言的アクセス制御
- `Vercel`: ホスティング — Next.js 開発元、無料枠で MVP 十分（10 秒タイムアウト注意）
- `Resend + React Email 5.x`: メール送信 — 月 3,000 通無料、React コンポーネントでテンプレート管理
- `Google Calendar API v3 + Zoom API v2`: 外部連携 — サービスアカウント認証、オンデマンド同期 + 15 分キャッシュ

**E2E テストスタック（v1.2 追加）:**
- `@playwright/test@1.58.2`: E2Eテストランナー — Next.js 公式推奨、CI 並列実行無料、storageState 認証再利用対応
- `patrickedqvist/wait-for-vercel-preview@v1.3.3`: CI 統合 — Vercel Preview URL を自動取得するシンプルな手法

**採用しない技術（理由）:**
- Cypress: 並列実行が有料（Playwright で完全代替）
- `supawright`: 現規模では YAGNI
- ローカル Supabase: dev プロジェクトへの直接接続方針のため不要

詳細: `.planning/research/STACK.md`

### Expected Features

**テーブルステークス（E2E で P0/P1 として必須確認）:**
- ゲスト予約ハッピーパス（スロット選択 → 確定 → Zoom URL 表示）— ここが壊れると売上ゼロ
- 時刻 JST 表示（#2 バグ修正確認）— UTC 表示はユーザー混乱の直接原因
- 会員ログイン → ダッシュボードリダイレクト — 認証基盤の確認
- 未認証での保護ルートアクセス → リダイレクト — ルート保護の確認
- 会員予約 + ポイント消費確認 — ポイント制の根幹機能
- 予約キャンセル + ポイント返還確認 — トランザクション整合性

**差別化要素（システムの核心、v1.0 確定済み）:**
- ポイント制サブスクリプション（市場では珍しい機能）
- Zoom アカウント使い分け（カジュアル 40 分制限 / 有料無制限の自動切り替え）
- 祝日対応営業時間（Google 公開カレンダー連携）
- ミーティングバッファ設定

**E2E でテストしないこと（アンチフィーチャー）:**
- Google OAuth UI フロー（ToS 違反リスク + CI で Bot 検出で絶対に動かない）
- 実際の Zoom/Google Calendar/Resend API 呼び出し（クォータ消費 + 外部依存）
- 全バリデーションパターン網羅（Vitest + React Testing Library で対応）

詳細: `.planning/research/FEATURES.md`

### Architecture Approach

E2E テストは既存の Next.js App Router アーキテクチャ（5層構成）に対して、テストインフラを追加する形で統合する。CI では Vercel Preview URL を対象に実行し、ローカルでは `next dev` を自動起動するデュアルモード設計。Supabase dev プロジェクトを共用し、独立した test 用プロジェクトは作成しない（YAGNI）。

**既存システムの主要コンポーネント（確定済み）:**
1. `Presentation Layer` — Next.js App Router (RSC/SSR)、shadcn/ui、Route Groups で guest/member/admin 分離
2. `Application Layer` — Route Handlers (`/api/*`)、Server Actions、Server Components
3. `Business Logic Layer` — `lib/availability/`（空き時間計算）、`lib/booking/`（Saga オーケストレーション）、`lib/points/`
4. `Integration Layer` — Google Calendar wrapper（15 分キャッシュ）、Zoom wrapper（A/B アカウント切り替え）、Resend wrapper
5. `Data Layer` — PostgreSQL Stored Procedures（ACID）、RLS（JWT claim ベース）、Edge Functions（pg_cron）

**E2E テスト追加コンポーネント（v1.2）:**
- `playwright.config.ts` — deュアルモード（CI: Vercel Preview、ローカル: dev server）+ プロジェクト別セッション（guest/member/admin）
- `e2e/global-setup.ts / global-teardown.ts` — service role でテストユーザー作成・cascade 削除
- `e2e/auth.setup.ts` — REST API ログイン + storageState 保存
- `e2e/fixtures.ts` — serviceRole フィクスチャ + booking cleanup
- `.github/workflows/e2e.yml` — develop push / main PR トリガーの CI ワークフロー

**確立済みパターン:**
- Server-First（RSC デフォルト、`'use client'` は必要箇所のみ）
- PostgreSQL Stored Procedures（`consume_points()` に `SELECT FOR UPDATE NOWAIT`）
- Saga パターン + 補償トランザクション（Zoom/Calendar/Email の分散処理）
- Optimistic Locking + DB UNIQUE INDEX（ダブルブッキング防止）

詳細: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

**クリティカル（v1.2 E2E 固有）:**

1. **Google OAuth を Playwright で自動化しようとする** — Google の Bot 検出と ToS 違反で CI 環境では絶対に動かない。テスト専用メール/パスワードユーザーを Supabase dev に作成し、Google OAuth フロー自体は E2E 対象外にする

2. **Supabase dev 環境の並列テスト干渉** — 無料枠の接続数制限により並列実行で競合が発生する。`workers: 1` でシリアル実行し、`afterEach` で booking データを service role でクリーンアップする

3. **Vercel Preview のデプロイ保護** — develop ブランチに Vercel Authentication が有効だと Playwright がアクセスできない。Protection Bypass for Automation は有料（$150/月）のため、develop 環境のデプロイ保護を無効化する

4. **service role での誤データ削除** — service role は RLS をバイパスするため teardown で他ユーザーデータを消す危険がある。`user_id` フィルタリングを必須とし、DB リセット全体（`supabase db reset`）は絶対に行わない

**クリティカル（既存システム、v1.0〜v1.1 確定済み）:**

5. **分散トランザクション補償処理欠如** — 予約作成 8 ステップが途中失敗すると不整合状態になる。Saga パターン + 冪等性キーで設計済み。Phase 2 実装前に設計完了必須

6. **ポイントトランザクション整合性** — 同時予約で残高超過消費が発生する。`consume_points()` に `SELECT FOR UPDATE NOWAIT` + 楽観的ロックで対応

7. **タイムゾーン不整合（#2 バグの根本原因）** — DB は全て `timestamptz`（UTC）、表示時のみ `date-fns-tz` で JST 変換

8. **OAuth トークン期限切れ** — Zoom/Google Calendar API が突然 401 エラーでサービス停止する。リフレッシュトークン自動更新 + 5 分前事前チェックで対応

詳細: `.planning/research/PITFALLS.md`

## Implications for Roadmap

v1.2 マイルストーンの E2E テスト環境導入は、アーキテクチャ研究で明確なビルド順序が定義されている。依存関係に基づいて以下の 5 フェーズ構成を推奨する。

### Phase 1: E2E 基盤整備
**Rationale:** 後続フェーズ全ての前提となるインフラ設定。Playwright インストールと設定ファイルの整備なしには何も始められない
**Delivers:** `playwright.config.ts`（デュアルモード + プロジェクト別認証設定）、`e2e/.auth/` の `.gitignore` 追記、`package.json` に `test:e2e` / `test:e2e:ui` / `test:all` スクリプト追加
**Avoids:** `.auth/` ファイルの誤コミット（セッション情報漏洩防止）
**Research flag:** 標準パターン確立済み — 追加調査不要

### Phase 2: テストデータ管理基盤
**Rationale:** 認証セットアップ（Phase 3）にはテストユーザーの事前作成が必要。global-setup / teardown と fixtures は Phase 1 完了後すぐに着手可能
**Delivers:** `e2e/global-setup.ts`（テストユーザー + member_plan 作成）、`e2e/global-teardown.ts`（cascade 削除）、`e2e/fixtures.ts`（serviceRole + booking cleanup フィクスチャ）
**Avoids:** teardown での誤データ削除（`user_id` フィルタリング必須）、DB リセット全体実行（マスターデータ消滅リスク）
**Research flag:** 標準パターン確立済み — 追加調査不要

### Phase 3: 認証セットアップ
**Rationale:** 会員・管理者テスト（Phase 4）には認証済みセッションが必要。`auth.setup.ts` は Supabase REST API ログイン + storageState 保存の確立パターン
**Delivers:** `e2e/auth.setup.ts`（会員・管理者セッション取得）、`e2e/.auth/member.json` / `admin.json`
**Uses:** Supabase `signInWithPassword()` REST API、Playwright `storageState`、`page.evaluate()` で localStorage にセッション注入
**Avoids:** Google OAuth 自動化（絶対に試みない）
**Research flag:** `/login` ページにメール/パスワードフォームが存在するか実装前に確認必要。既存のミドルウェアが `@supabase/ssr` の Cookie ベースセッションを使用しているため、UI ログイン後の storageState 取得が最も確実な場合がある

### Phase 4: テストシナリオ実装
**Rationale:** 基盤（Phase 1-3）完了後に着手。ゲストテストは Phase 1 完了直後から認証不要で先行着手可能。優先度 P0 → P1 → P2 の順で実装し、最初の green テストを早期に得る
**Delivers:** `e2e/guest/booking-flow.spec.ts`（P0: ゲスト予約 + JST 表示確認）、`e2e/member/booking-flow.spec.ts`（P1: ポイント消費）、`e2e/member/cancel-flow.spec.ts`（P1: ポイント返還 + Zoom 削除 API 確認）、`e2e/admin/booking-management.spec.ts`（P2: 管理者スモーク + 招待メール確認）
**Implements:** `page.route()` による外部 API モック（Zoom/Calendar/Resend）
**Avoids:** 実 Zoom API 呼び出し（クォータ消費）、全バリデーション網羅（Vitest で対応）
**Research flag:** 追加調査不要（Playwright 公式ドキュメントに完全なサンプルあり）

### Phase 5: CI 統合
**Rationale:** テストがローカルで全て green になってから CI に乗せる。不安定なテストを CI に載せると開発の妨げになる
**Delivers:** `.github/workflows/e2e.yml`（develop push / main PR トリガー）、GitHub Secrets 設定（`SUPABASE_DEV_URL`、`SUPABASE_DEV_ANON_KEY`、`SUPABASE_DEV_SERVICE_ROLE_KEY`）
**Avoids:** デプロイ保護による CI アクセス不可（Vercel dashboard で develop ブランチの Protection 設定を事前確認・無効化）
**Research flag:** Vercel dashboard で develop ブランチのデプロイ保護設定状況を確認する必要がある

### Phase Ordering Rationale

- **依存関係の厳守:** global-setup なしに auth.setup は動かない。auth.setup なしに member/admin テストは動かない。この順序は逆転不可
- **ゲストテストの前倒し:** ゲスト予約フローは認証不要のため Phase 1 完了後すぐに着手できる。最初の green テストを早期に得ることでモチベーション維持と基盤検証を兼ねる
- **CI は最後:** 不安定なテストを CI に載せると「CI が赤い」状態が続く。Phase 4 でローカル green を確認してから CI 統合する
- **Pitfalls の先行対処:** `workers: 1`（Supabase 接続制限）と `user_id` フィルタ（service role 誤削除）は Phase 2 で実装し、後続フェーズに引き継がない

### Research Flags

追加調査が必要なフェーズ:
- **Phase 3:** `/login` ページにメール/パスワードフォームが存在するか確認が必要。`middleware.ts` が `@supabase/ssr` Cookie ベースセッションを使用している場合、UI ログイン後の storageState 取得が最も確実。フォームが存在しない場合は Supabase REST API アプローチのみ
- **Phase 5:** Vercel dashboard で develop ブランチの Deployment Protection 設定を事前確認する。有効な場合は無効化が必要

標準パターンで追加調査不要なフェーズ:
- **Phase 1:** Playwright 公式ドキュメント準拠、設定パターン確立済み
- **Phase 2:** Supabase service role での CRUD は標準操作
- **Phase 4:** `page.route()` モックは Playwright 公式に完全なサンプルあり

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Playwright 1.58.2 は npm registry で確認済み（2026-01-30 リリース）。Next.js 公式ドキュメント（2026-02-27 更新）で推奨。既存スタックは v1.0 から確定 |
| Features（テストシナリオ） | HIGH | Playwright 公式 + Supabase 実証パターン（mokkapps.de）で確認。Google OAuth 回避の必然性はコミュニティで合意済み |
| Architecture | HIGH | Vercel プレビュー統合・Supabase auth バイパスは公式 + 複数実証ソースで確認。既存アーキテクチャは v1.0 から確定済み |
| Pitfalls | MEDIUM-HIGH | E2E 固有の pitfalls は公式 + 複数コミュニティソースで確認。既存 pitfalls は v1.0 調査から引き継ぎ検証済み |

**Overall confidence:** HIGH

### Gaps to Address

- **メール/パスワードログインフォームの存在確認:** `src/app/(auth)/login/` に email + password フォームがあるか実装前に確認。`middleware.ts` が supabase SSR Cookie ベースなら UI ログイン後の storageState 取得が最も確実。フォームがない場合は REST API アプローチ一択
- **Vercel develop 環境のデプロイ保護状態:** Vercel dashboard で確認が必要。有効な場合は Phase 5 で無効化する（無料の Protection Bypass は存在しない）
- **テストユーザーのロール付与方法:** Supabase `app_metadata` に `role: 'admin'` を付与する手順（または admin ユーザーを別途作成するか）を Phase 2 で確定する

## Sources

### Primary (HIGH confidence)
- [Next.js App Router Testing Guide（公式）](https://nextjs.org/docs/app/guides/testing) — 2026-02-27 更新
- [Next.js Playwright Setup（公式）](https://nextjs.org/docs/app/guides/testing/playwright) — 2026-02-27 更新
- [Playwright Release Notes v1.58](https://playwright.dev/docs/release-notes) — バージョン確認
- [Playwright Authentication（公式）](https://playwright.dev/docs/auth) — storageState パターン
- [Playwright Mock APIs（公式）](https://playwright.dev/docs/mock) — `page.route()` によるネットワークモック
- [Vercel E2E Testing with Preview Deployments](https://vercel.com/kb/guide/how-can-i-run-end-to-end-tests-after-my-vercel-preview-deployment) — 公式ガイド
- [Resend E2E Testing with Playwright](https://resend.com/docs/knowledge-base/end-to-end-testing-with-playwright) — `delivered@resend.dev` 推奨
- [Supabase 公式ドキュメント（Edge Functions、RLS）](https://supabase.com/docs) — 既存スタック確認
- [Next.js 15 公式ブログ](https://nextjs.org/blog/next-15) — コアスタック確認

### Secondary (MEDIUM confidence)
- [Login at Supabase via REST API in Playwright](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) — Supabase + Playwright 実証パターン
- [Integrating Playwright with GitHub Workflow and Vercel](https://www.thisdot.co/blog/integrating-playwright-tests-into-your-github-workflow-with-vercel) — CI 統合パターン
- [Playwright vs Cypress 2026 Guide for Lean Teams](https://www.getautonoma.com/blog/playwright-vs-cypress) — Playwright 採用根拠
- [Why Playwright Seems to Be Winning Over Cypress](https://www.d4b.dev/blog/2026-02-17-why-playwright-seems-to-be-winning-over-cypress-for-end-to-end-testing)
- [End-to-End Testing Auth Flows with Playwright and Next.js](https://testdouble.com/insights/how-to-test-auth-flows-with-playwright-and-next-js) — OAuth 代替戦略
- [Azure Architecture Center - Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) — 既存アーキテクチャ参照
- [Stripe API - Idempotency Keys](https://docs.stripe.com/api/idempotent_requests) — 冪等性キー実装参照

### Tertiary (LOW confidence — needs validation)
- E2E テストシナリオの優先度区分（P0/P1/P2）: コミュニティベストプラクティスから推定。プロジェクト固有の調整が必要な場合がある
- Supabase RLS パフォーマンス at 1,000+ rows: 小規模データでの動作は確認済み、大規模シミュレーションは未実施

---
*Research completed: 2026-02-22 / E2E test integration updated: 2026-03-15*
*Ready for roadmap: yes*
*対象マイルストーン: v1.2 安定化 — Playwright E2Eテスト環境導入*
