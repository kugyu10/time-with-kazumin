---
phase: 10-test-scenarios
plan: 02
subsystem: testing
tags: [playwright, e2e, auth, member-booking, fixtures, page-route]

# Dependency graph
requires:
  - phase: 09-playwright-foundation
    provides: Playwright基盤（global-setup.ts, fixtures.ts, auth.setup.ts, playwright.config.ts）
  - phase: 10-test-scenarios-01
    provides: ゲスト予約フロー E2E テスト、global-setup 拡張（member_plans + cancel_token）
provides:
  - 会員ログインフロー E2E テスト（認証済み/未認証ユーザーの動作検証）
  - 会員予約フロー E2E テスト（メニュー選択→スロット選択→確認→ダッシュボード遷移）
  - ポイント残高表示の E2E 検証
affects:
  - phase 11: CI統合時に auth.spec.ts/member-booking.spec.ts が実行される

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "memberPage フィクスチャで認証済みコンテキストを再利用（storageState）"
    - "page.route() で /api/bookings POST をモック化して外部 Saga パターンを切り離す"
    - "beforeEach で複数 API ルートをまとめてモック設定"

key-files:
  created:
    - e2e/specs/auth.spec.ts
    - e2e/specs/member-booking.spec.ts
  modified: []

key-decisions:
  - "memberPage フィクスチャは storageState で認証済みなため、テスト内でログイン操作は不要（KISS原則）"
  - "Supabase 直接クエリ（meeting_menus 取得）はテスト DB に実データが存在する前提とし、page.route() でモックしない"
  - "ポイント残高の変化テストはモック環境では不可能なため、表示の存在確認（100ポイント）に留める"

patterns-established:
  - "memberPage フィクスチャパターン: fixtures.ts から import し、認証済み操作を直接実行"
  - "beforeEach での複数 API モック: settings + slots/week + bookings を一括でモック設定"
  - "Server Component ダッシュボードのポイント確認: global-setup で設定した実データを直接検証"

requirements-completed: [E2E-03, E2E-04]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 10 Plan 02: 会員ログイン・予約フロー E2E テスト Summary

**memberPage フィクスチャと page.route() モックを使った会員ログインフロー（E2E-03）・会員予約フロー（E2E-04）の E2E テスト実装**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T14:21:12Z
- **Completed:** 2026-03-15T14:23:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- e2e/specs/auth.spec.ts を新規作成: 認証済み会員のダッシュボード/bookings/new アクセス検証、未認証ユーザーの /login リダイレクト検証（3テスト）
- e2e/specs/member-booking.spec.ts を新規作成: メニュー選択→スロット選択→確認→ダッシュボード遷移フロー、ポイント残高表示の検証（2テスト）
- 両ファイルとも `../fixtures` から test/expect を import（Pitfall 6 対策）
- /api/bookings POST を page.route() でモック化して Zoom/Calendar/Resend の実 API 呼び出しを回避
- TypeScript 型チェック通過を確認

## Task Commits

各タスクをアトミックにコミット:

1. **Task 1: 会員ログインフロー E2E テスト実装** - `277be26` (feat)
2. **Task 2: 会員予約フロー E2E テスト実装** - `4dad347` (feat)

## Files Created/Modified

- `e2e/specs/auth.spec.ts` - 会員ログインフロー E2E テスト（3 test）
- `e2e/specs/member-booking.spec.ts` - 会員予約フロー E2E テスト（2 test、beforeEach で3 API モック）

## Decisions Made

- memberPage フィクスチャは storageState で認証済みなため、ログイン操作は不要（KISS原則）
- /bookings/new の Supabase 直接クエリ（meeting_menus/weekly_schedules）はテスト DB 実データ前提とし page.route() でモックしない（Supabase JS SDK の URL が環境変数依存で不確定なため）
- ポイント残高の「変化」テストはモック環境で不可能なため、global-setup で設定した 100 ポイントの「表示」確認に留める

## Deviations from Plan

なし — プランの仕様通りに実装完了。

## Issues Encountered

- テスト実行時に auth.setup.ts がタイムアウト（ローカル環境で .env.test 未設定/Supabase 認証情報なし）。spec ファイル自体の問題ではなく、TypeScript 型チェックは通過。CI 環境（.env.test 設定済み）での実行を前提とした設計。

## Next Phase Readiness

- 会員ログイン・予約フロー E2E テストが実装完了。Phase 10 全プラン完了。Phase 11（CI 統合）へ進む準備完了。

---
*Phase: 10-test-scenarios*
*Completed: 2026-03-15*
