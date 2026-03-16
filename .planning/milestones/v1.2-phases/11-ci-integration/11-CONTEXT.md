# Phase 11: CI統合 - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** /gsd:list-phase-assumptions feedback

<domain>
## Phase Boundary

GitHub ActionsでE2Eテストを自動実行するCI/CDパイプラインを構築する。
Vercel preview URLに対してPlaywright E2Eテストを実行する。

</domain>

<decisions>
## Implementation Decisions

### トリガー条件（ユーザー修正）
- developブランチへのpush時にはE2Eテストは実行しない
- `develop → main` へのPR作成・更新時にE2Eテストを実行する

### Vercel連携（ユーザー確認）
- GitHub Appsによる自動連携は未設定
- `VERCEL_TOKEN` をGitHub Secretsに設定してVercel preview URLを取得する

### Supabase接続（未検証）
- CI環境（GitHub Actions）から開発用Supabaseへの接続可否は未検証
- global-setup.tsがSERVICE_ROLE_KEYでテストデータを投入するため、接続可能であることが前提

### Claude's Discretion
- GitHub Actionsワークフローの具体的なjob/step構成
- Playwright browserのインストール方法
- タイムアウト値の設定
- アーティファクト保存の詳細構成

</decisions>

<specifics>
## Specific Ideas

- `patrickedqvist/wait-for-vercel-preview` アクションを使用してVercel preview URL取得
- `PLAYWRIGHT_BASE_URL` 環境変数でpreview URLを渡す（playwright.config.tsが対応済み）
- 必要なGitHub Secrets: `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`, `VERCEL_TOKEN`
- テスト失敗時はPlaywrightのHTML report + traceをアーティファクトとして保存

</specifics>

<deferred>
## Deferred Ideas

- Slack/メール等の通知連携
- テスト結果のPRコメント自動投稿
- mainブランチへの自動マージ

</deferred>

---

*Phase: 11-ci-integration*
*Context gathered: 2026-03-16 via assumptions feedback*
