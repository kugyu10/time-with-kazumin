---
phase: 11-ci-integration
plan: 01
subsystem: infra
tags: [github-actions, playwright, vercel, ci, e2e]

# Dependency graph
requires:
  - phase: 10-test-scenarios
    provides: Playwright E2Eテスト実装（e2e/specs/）
  - phase: 09-playwright-foundation
    provides: playwright.config.ts、global-setup.ts、環境変数設計
provides:
  - develop → main PR作成時にGitHub ActionsでE2Eテストが自動実行されるCI/CDパイプライン
affects:
  - 全ての develop → main PRマージフロー

# Tech tracking
tech-stack:
  added:
    - patrickedqvist/wait-for-vercel-preview@v1.3.3
    - actions/checkout@v4
    - actions/setup-node@v4
    - actions/upload-artifact@v4
  patterns:
    - Vercel Preview URL自動取得 → Playwright E2Eテスト実行の2-jobパターン
    - !cancelled() 条件でのアーティファクト保存（失敗時にも保存）

key-files:
  created:
    - .github/workflows/e2e.yml
  modified: []

key-decisions:
  - "GITHUB_TOKENのみ使用（VERCEL_TOKEN不要）: patrickedqvist/wait-for-vercel-previewはGitHub Deployment Events経由でVercel Preview URLを取得するため"
  - "chromiumのみインストール: 全ブラウザインストールは不要でCI実行時間を短縮（KISSおよびYAGNI原則）"
  - "pushトリガー完全排除: developブランチへのpushでは発火しない設計でCI実行コストを最適化"

patterns-established:
  - "GitHub Secrets → env: ブロック変数マッピング: .env.testキー名をGitHub Secrets名に変換してCIに渡すパターン"

requirements-completed:
  - E2E-05

# Metrics
duration: 1min
completed: 2026-03-16
---

# Phase 11 Plan 01: CI Integration Summary

**develop → main PR作成時にVercel Preview URLへPlaywright E2Eテストを自動実行するGitHub Actions 2-jobワークフロー**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T05:18:40Z
- **Completed:** 2026-03-16T05:19:16Z
- **Tasks:** 1/2（Task 2はcheckpoint:human-verifyで停止）
- **Files modified:** 1

## Accomplishments
- `.github/workflows/e2e.yml` を新規作成（2-job構成）
- Job 1（wait-for-preview）: `patrickedqvist/wait-for-vercel-preview@v1.3.3` でVercel Preview URLを自動取得
- Job 2（e2e）: chromiumのみインストールし、8つのGitHub Secretsを参照してPlaywrightテストを実行
- `!cancelled()` 条件でHTMLレポートをアーティファクトとして30日間保存

## Task Commits

各タスクは個別にコミットされました:

1. **Task 1: GitHub Actions E2Eワークフロー作成** - `6973826` (feat)

**Plan metadata:** TBD（最終コミット後に更新）

## Files Created/Modified
- `.github/workflows/e2e.yml` - develop → main PR時にE2Eテストを自動実行するGitHub Actionsワークフロー

## Decisions Made
- `GITHUB_TOKEN` のみ使用（VERCEL_TOKEN不要）: `patrickedqvist/wait-for-vercel-preview` はGitHub Deployment Events経由でVercel Preview URLを取得するため、追加トークンは不要
- chromiumのみインストール: 全ブラウザインストールは不要（KISSおよびYAGNI原則）
- pushトリガー完全排除: developブランチへのpushでは発火しない設計

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**外部サービスの手動設定が必要です。** GitHub Secretsに以下の8変数を設定してください:

設定場所: GitHub → リポジトリ → Settings → Secrets and variables → Actions → New repository secret

| Secret名 | 取得元 |
|----------|--------|
| `SUPABASE_DEV_URL` | `.env.test` の `NEXT_PUBLIC_SUPABASE_URL` の値 |
| `SUPABASE_DEV_ANON_KEY` | `.env.test` の `NEXT_PUBLIC_SUPABASE_ANON_KEY` の値 |
| `SUPABASE_DEV_SERVICE_ROLE_KEY` | `.env.test` の `SUPABASE_SERVICE_ROLE_KEY` の値 |
| `JWT_CANCEL_SECRET` | `.env.test` の `JWT_CANCEL_SECRET` の値 |
| `E2E_MEMBER_EMAIL` | `.env.test` の `E2E_MEMBER_EMAIL` の値 |
| `E2E_MEMBER_PASSWORD` | `.env.test` の `E2E_MEMBER_PASSWORD` の値 |
| `E2E_ADMIN_EMAIL` | `.env.test` の `E2E_ADMIN_EMAIL` の値 |
| `E2E_ADMIN_PASSWORD` | `.env.test` の `E2E_ADMIN_PASSWORD` の値 |

## Next Phase Readiness
- `.github/workflows/e2e.yml` 配置完了。GitHub SecretsをDashboardで設定後、develop → main PRを作成することでCI検証が可能
- Task 2（checkpoint:human-verify）: PR作成による実際のCI動作確認が必要

---
*Phase: 11-ci-integration*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: `.github/workflows/e2e.yml`
- FOUND: `.planning/phases/11-ci-integration/11-01-SUMMARY.md`
- FOUND commit: `6973826`
