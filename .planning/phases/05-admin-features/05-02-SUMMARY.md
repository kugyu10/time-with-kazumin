---
phase: 05-admin-features
plan: 02
subsystem: admin
tags: [react-hook-form, zod, server-actions, supabase-rpc, tanstack-table]

# Dependency graph
requires:
  - phase: 05-admin-features
    plan: 01
    provides: "管理画面基盤、DataTable、認証・認可パターン"
  - phase: 01-foundation
    provides: "weekly_schedulesテーブル、manual_adjust_points RPC"
provides:
  - "営業時間設定UI（平日/祝日パターン切り替え）"
  - "getSchedules/updateSchedules Server Actions"
  - "会員一覧・登録・退会機能"
  - "ポイント手動調整機能（監査証跡付き）"
affects: [05-03, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useFieldArray for dynamic form fields"
    - "RPC呼び出しによるアトミックなポイント操作"
    - "確認ダイアログ付きのポイント調整フロー"

key-files:
  created:
    - "src/lib/actions/admin/schedules.ts"
    - "src/app/admin/schedules/page.tsx"
    - "src/app/admin/schedules/schedules-client.tsx"
    - "src/components/admin/forms/schedule-form.tsx"
    - "src/lib/actions/admin/members.ts"
    - "src/lib/actions/admin/points.ts"
    - "src/app/admin/members/page.tsx"
    - "src/app/admin/members/members-client.tsx"
    - "src/app/admin/members/columns.tsx"
    - "src/components/admin/forms/member-form.tsx"
    - "src/components/admin/forms/point-adjust-form.tsx"
  modified:
    - "src/components/admin/sidebar.tsx"
    - "src/types/database.ts"

key-decisions:
  - "営業時間はis_available=falseの曜日はDBに保存しない（シンプル設計）"
  - "会員退会は論理削除（role='guest'に変更 + member_plan.status='canceled'）"
  - "ポイント調整はnotes必須（監査証跡のため）"
  - "anyキャストでSupabase RPC型推論問題を回避"

patterns-established:
  - "ScheduleForm: useFieldArray + 7日分のフォーム管理"
  - "PointAdjustForm: 確認ダイアログ付きServer Action呼び出し"
  - "Member registration: Auth API + profiles + member_plans同時作成"

requirements-completed: [ADMIN-01, ADMIN-04, ADMIN-05]

# Metrics
duration: 9min
completed: 2026-02-22
---

# Phase 05 Plan 02: Admin Features - Schedule & Member Management Summary

**営業時間設定（平日/祝日パターン）と会員管理（CRUD + ポイント調整）機能を実装**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-22T22:39:13Z
- **Completed:** 2026-02-22T22:48:15Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- 曜日別営業時間設定UI（7行フォーム + 平日/祝日タブ切り替え）
- 会員一覧・新規登録・退会処理機能
- ポイント手動調整機能（確認ダイアログ + notes必須で監査証跡）
- manual_adjust_points RPC呼び出しによるアトミックな操作

## Task Commits

Each task was committed atomically:

1. **Task 1: 営業時間設定UI** - `f79d29a` (feat)
2. **Task 2: 会員管理 + ポイント調整** - `79ffc91` (feat)

## Files Created/Modified

- `src/lib/actions/admin/schedules.ts` - getSchedules, updateSchedules Server Actions
- `src/app/admin/schedules/page.tsx` - 営業時間設定ページ
- `src/app/admin/schedules/schedules-client.tsx` - タブUI
- `src/components/admin/forms/schedule-form.tsx` - 7日分のフォーム（React Hook Form）
- `src/lib/actions/admin/members.ts` - getMembers, createMember, deactivateMember
- `src/lib/actions/admin/points.ts` - adjustPoints（RPC呼び出し）
- `src/app/admin/members/page.tsx` - 会員一覧ページ
- `src/app/admin/members/members-client.tsx` - DataTable + ダイアログ管理
- `src/app/admin/members/columns.tsx` - カラム定義
- `src/components/admin/forms/member-form.tsx` - 会員登録フォーム
- `src/components/admin/forms/point-adjust-form.tsx` - ポイント調整フォーム
- `src/components/admin/sidebar.tsx` - 営業時間リンク修正
- `src/types/database.ts` - manual_adjust_points関数型追加

## Decisions Made

- **営業時間の保存方式:** is_available=falseの曜日はDBに保存しない（シンプル設計、KISS原則）
- **会員退会方式:** 物理削除ではなく論理削除（role='guest'に変更 + status='canceled'）
- **ポイント調整:** notes必須で監査証跡を確保（研究で確認したPitfall対策）
- **型問題回避:** anyキャストでSupabase RPC型推論問題を回避（既存パターン踏襲）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Supabase RPC型推論問題**
- **Found during:** Task 2 (ポイント調整Server Action)
- **Issue:** manual_adjust_points RPCの型がdatabase.tsに定義されていなかった
- **Fix:** database.tsに型定義を追加 + anyキャストで回避
- **Files modified:** src/types/database.ts, src/lib/actions/admin/points.ts
- **Committed in:** 79ffc91

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** 型定義追加は必須の修正。スコープ内。

## Issues Encountered

- **ESLintメモリ不足:** npm run lintがヒープ上限に達して失敗 → npm run buildで型チェック+lint実行
- **未使用変数エラー:** members-client.tsxのfilter内で変数が未使用 → コード修正

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 営業時間設定、会員管理、ポイント調整機能が完成
- Phase 05の基本機能すべて実装完了
- 次プラン（05-03: 予約管理）の実装準備完了

## Self-Check: PASSED

All created files verified. All commits verified.

---
*Phase: 05-admin-features*
*Completed: 2026-02-22*
