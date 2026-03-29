---
phase: 14-plan-type-menu
plan: 02
subsystem: ui
tags: [filter, plan-type, menu, booking, vitest, tdd]

# Dependency graph
requires:
  - phase: 12-db
    provides: "allowed_plan_types INTEGER[] DEFAULT NULL column on meeting_menus"
  - phase: 14-plan-type-menu/14-01
    provides: "MenuForm with allowed_plan_types CRUD support"
provides:
  - "filterMenusByPlanType pure function with full unit test coverage"
  - "bookings/new page filtered by member's plan_id via allowed_plan_types"
  - "zoom_account='B' hardcoded filter removed"
affects: [booking-flow, menu-visibility, plan-type-filtering]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pure filter function with generics for plan-type based menu visibility"]

key-files:
  created:
    - src/lib/utils/menu-filter.ts
    - src/lib/utils/menu-filter.test.ts
  modified:
    - src/app/(member)/bookings/new/page.tsx

key-decisions:
  - "filterMenusByPlanType は generics を使い、allowed_plan_types フィールドを持つ任意の型に適用可能"
  - "フィルタはアプリ層で実施（RLSポリシー変更なし）— 既存ポリシーとの競合回避"
  - "MenuSelect の Menu 型には allowed_plan_types を追加しない（Pitfall 5回避）。フィルタ後に除外して渡す"

patterns-established:
  - "Plan-type filter: fetch with allowed_plan_types → filterMenusByPlanType → strip field before rendering"

requirements-completed: [MENU-02, MENU-04]

# Metrics
duration: 12min
completed: 2026-03-28
---

# Phase 14 Plan 02: プランタイプ別メニューフィルタ Summary

**会員予約画面のzoom_account="B"ハードコードをallowed_plan_typesベースのフィルタに置き換え、TDDで純粋フィルタ関数を実装（5テスト全パス）**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-28T12:40:00Z
- **Completed:** 2026-03-28T12:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `filterMenusByPlanType` 純粋関数をTDDで作成（RED→GREEN）。null/planId/空配列の全パターンをカバーする5テスト
- `bookings/new/page.tsx` で `member_plans` テーブルからユーザーの `plan_id` を取得し、メニューをフィルタリング
- `zoom_account="B"` のハードコードフィルタを撤去（MENU-04要件）

## Task Commits

Each task was committed atomically:

1. **Task 1: filterMenusByPlanType純粋関数の作成とユニットテスト** - `973d21f` (feat)
2. **Task 2: bookings/new/page.tsxのメニューフィルタ置き換え** - `5210718` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/utils/menu-filter.ts` - filterMenusByPlanType ジェネリック純粋関数
- `src/lib/utils/menu-filter.test.ts` - 5ユニットテスト（TDD GREEN）
- `src/app/(member)/bookings/new/page.tsx` - allowed_plan_typesベースフィルタに変更、zoom_account削除

## Decisions Made
- フィルタ後に `allowed_plan_types` フィールドを除外してから `setMenus` に渡す（MenuSelect の Menu 型との互換性維持）
- `user` が null の場合は `userPlanId = null` のままフィルタに渡す（allowed_plan_types=null のメニューのみ表示される、クラッシュなし）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint no-unused-vars エラー修正（eslint-disable コメント追加）**
- **Found during:** Task 2 (bookings/new/page.tsx 変更)
- **Issue:** `filteredMenus.map(({ allowed_plan_types, ...rest }) => rest)` の destructuring で `allowed_plan_types` が未使用変数として ESLint エラー
- **Fix:** `// eslint-disable-next-line @typescript-eslint/no-unused-vars` コメントを追加
- **Files modified:** src/app/(member)/bookings/new/page.tsx
- **Verification:** `npm run build` 成功
- **Committed in:** 5210718 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 ESLint suppression)
**Impact on plan:** ESLint suppression は destructuring でフィールドを除外する標準的なパターン。スコープ拡大なし。

## Issues Encountered
- ビルド中に `src/components/admin/forms/menu-form.tsx` の `plans` 変数が未使用エラーと誤認識されたが、実際にはファイル下部で使用されていた。ESLintで直接 lint したところエラーなし（TypeScript コンパイルのキャッシュ問題）。再ビルドで解消。

## Next Phase Readiness
- MENU-02・MENU-04 完了。プランタイプ別メニュー表示が実装済み
- Phase 14 の全2プランが完了
- 次: v1.3 マイルストーン残フェーズ（Phase 15: ポイント溢れ通知、Phase 16: 会員アクティビティ可視化）

---
*Phase: 14-plan-type-menu*
*Completed: 2026-03-28*
