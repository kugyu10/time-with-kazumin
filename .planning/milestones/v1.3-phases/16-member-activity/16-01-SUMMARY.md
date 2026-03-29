---
phase: 16-member-activity
plan: 01
subsystem: api
tags: [typescript, supabase, activity-status, vitest, member-management]

# Dependency graph
requires:
  - phase: 12-db
    provides: bookings table schema with member_plan_id, status, start_time, end_time
provides:
  - ActivityStatus型 ('normal' | 'yellow' | 'red')
  - calcActivityStatus純粋関数 (exported, testable)
  - 拡張Member型 (last_session_at, has_future_booking, activity_status)
  - getMembers() が bookings 2段階集計でactivity fieldsを返す
  - getFollowUpMembers() が yellow/red 会員のみ返す
  - calcActivityStatus ユニットテスト (10ケース全パス)
affects:
  - 16-02 (UIレイヤー: DataTable行色, 「前回セッション」カラム, FollowUpList)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 2段階クエリ + JS集計 (profiles取得後、bookings集計を別クエリ)
    - calcActivityStatus純粋関数パターン (テスト可能な日付計算関数)
    - active会員のみactivity_status計算 (inactive/canceledはnormal固定)

key-files:
  created:
    - src/__tests__/lib/actions/activity-status.test.ts
  modified:
    - src/lib/actions/admin/members.ts

key-decisions:
  - "2段階クエリ + JS集計採用 — Supabase JSの3段ネストJOIN (profiles→member_plans→bookings) を避け、シンプルさとデバッグ容易性を優先"
  - "calcActivityStatusをエクスポート済み純粋関数としてmembers.tsに配置 — テスト可能性とDRY原則を両立"
  - "member_plan.status !== 'active' の会員はactivity_status='normal' — D-07: 退会・停止会員はフォロー対象外"
  - "getFollowUpMembers()はgetMembers()を再利用してフィルタ — DRY、パフォーマンス問題が出たら分割を検討 (YAGNI)"

patterns-established:
  - "Pattern 2段階クエリ: Step1でprofilesとmember_plans.idを取得、Step2でmember_plan_idでbookingsを絞る"
  - "Pattern calcActivityStatus: hasFutureBooking優先チェック → null判定 → 日数判定の順序"

requirements-completed: [ACT-01, ACT-02]

# Metrics
duration: 15min
completed: 2026-03-29
---

# Phase 16 Plan 01: Member Activity Data Layer Summary

**ActivityStatus型とcalcActivityStatus純粋関数をmembers.tsに追加し、getMembers()でbookings 2段階クエリ集計、getFollowUpMembers()でyellow/red会員フィルタ、10ケースの全境界値ユニットテストをパス**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-29T08:00:00Z
- **Completed:** 2026-03-29T08:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Member型にlast_session_at, has_future_booking, activity_statusの3フィールドを追加
- getMembers()にbookingsテーブルへの2段階クエリ(completed最新end_time + future confirmed)を追加
- calcActivityStatus純粋関数をエクスポート (30日=yellow, 60日=red, 将来予約あり=normal, null=red)
- getFollowUpMembers()でyellow/red activeメンバーのみ返す関数を追加
- TypeScriptコンパイル成功、10ケース全ユニットテストパス

## Task Commits

各タスクはアトミックにコミット:

1. **Task 1: Member型拡張 + getMembers()拡張 + getFollowUpMembers()** - `1a7fe8a` (feat)
2. **Task 2: calcActivityStatus ユニットテスト (10ケース)** - `93f2c94` (test)

## Files Created/Modified

- `src/lib/actions/admin/members.ts` - ActivityStatus型, calcActivityStatus関数, Member型拡張(3フィールド), getMembers()bookings集計, getFollowUpMembers()を追加
- `src/__tests__/lib/actions/activity-status.test.ts` - calcActivityStatus境界値テスト10ケース新規作成

## Decisions Made

- 2段階クエリ + JS集計採用: Supabase JSの3段ネストJOIN (profiles→member_plans→bookings) を避け、シンプルさとデバッグ容易性を優先 (RESEARCH.md Pattern 2推奨)
- calcActivityStatusはexport関数としてmembers.tsに配置: テスト可能性とDRY原則を両立
- member_plan.status !== 'active' の会員はactivity_status='normal': D-07の仕様通り、退会・停止会員はフォロー対象外
- getFollowUpMembers()はgetMembers()を内部呼び出ししてフィルタ: DRY、YAGNI原則に従いパフォーマンス最適化は後回し

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 02 (UIレイヤー) に必要な型と関数が全て揃っている
- ActivityStatus, calcActivityStatus, Member (拡張型), getFollowUpMembers がエクスポート済み
- 型安全: TypeScript strict モードでコンパイルエラーなし

## Self-Check: PASSED

- FOUND: src/lib/actions/admin/members.ts
- FOUND: src/__tests__/lib/actions/activity-status.test.ts
- FOUND: .planning/phases/16-member-activity/16-01-SUMMARY.md
- FOUND: commit 1a7fe8a (Task 1)
- FOUND: commit 93f2c94 (Task 2)

---
*Phase: 16-member-activity*
*Completed: 2026-03-29*
