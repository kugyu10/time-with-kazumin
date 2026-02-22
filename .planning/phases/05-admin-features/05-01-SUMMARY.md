---
phase: 05-admin-features
plan: 01
subsystem: admin
tags: [shadcn-ui, tanstack-table, server-actions, react-hook-form, zod]

# Dependency graph
requires:
  - phase: 02-auth-booking
    provides: "認証基盤、profilesテーブル、予約機能"
  - phase: 01-foundation
    provides: "Supabaseクライアント、データベーススキーマ"
provides:
  - "管理画面レイアウト（認証・認可チェック付き）"
  - "Admin Sidebar ナビゲーション"
  - "TanStack Table統合DataTableコンポーネント"
  - "メニュー（meeting_menus）CRUD Server Actions"
  - "プラン（plans）CRUD Server Actions"
  - "shadcn/ui管理画面用コンポーネント群"
affects: [05-02, 05-03, 06-polish]

# Tech tracking
tech-stack:
  added: [@tanstack/react-table]
  patterns:
    - "Server Actionsで認証・認可チェック（Defense-in-Depth）"
    - "service_roleでRLSバイパス"
    - "revalidatePath()でキャッシュ無効化"
    - "react-hook-form + zodによるフォームバリデーション"

key-files:
  created:
    - "src/app/admin/layout.tsx"
    - "src/app/admin/dashboard/page.tsx"
    - "src/components/admin/sidebar.tsx"
    - "src/components/ui/data-table.tsx"
    - "src/lib/actions/admin/menus.ts"
    - "src/lib/actions/admin/plans.ts"
    - "src/app/admin/menus/page.tsx"
    - "src/app/admin/plans/page.tsx"
  modified:
    - "src/middleware.ts"
    - "package.json"

key-decisions:
  - "CVE-2025-29927対策: Layout内で認証・認可を再チェック"
  - "Server Actions内でのDefense-in-Depth認証チェック"
  - "anyキャストでSupabase型推論問題を回避"

patterns-established:
  - "Admin Server Action: requireAdmin() + service_role + revalidatePath()"
  - "DataTable: getColumns()でアクション関数を受け取るパターン"
  - "Form: useForm + zodResolver + startTransition"

requirements-completed: [ADMIN-06, ADMIN-07]

# Metrics
duration: 14min
completed: 2026-02-22
---

# Phase 05 Plan 01: Admin Features - Foundation Summary

**管理画面基盤（認証・認可チェック付きレイアウト）とメニュー・プランのCRUD Server Actions実装**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-22T22:21:19Z
- **Completed:** 2026-02-22T22:35:40Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- 管理画面共通レイアウト（Admin Layout）とサイドバーナビゲーション構築
- TanStack Table統合DataTableコンポーネントでソート・ページネーション対応
- メニュー（meeting_menus）のCRUD機能実装（作成・編集・削除・一覧）
- プラン（plans）のCRUD機能実装（作成・編集・削除・一覧）
- 各Server ActionでのDefense-in-Depth認証チェック

## Task Commits

Each task was committed atomically:

1. **Task 1: 管理画面基盤セットアップ** - `9bc4747` (feat)
2. **Task 2: メニューCRUD実装** - `e7bf5b8` (feat)
3. **Task 3: プランCRUD実装** - `60f2e02` (feat)

## Files Created/Modified

- `src/app/admin/layout.tsx` - 管理画面共通レイアウト（認証・認可チェック）
- `src/app/admin/dashboard/page.tsx` - 管理画面ダッシュボード
- `src/components/admin/sidebar.tsx` - 管理画面ナビゲーション
- `src/components/ui/data-table.tsx` - TanStack Table統合DataTable
- `src/components/ui/table.tsx` - shadcn/ui Table
- `src/components/ui/dropdown-menu.tsx` - shadcn/ui DropdownMenu
- `src/components/ui/dialog.tsx` - shadcn/ui Dialog
- `src/components/ui/select.tsx` - shadcn/ui Select
- `src/components/ui/checkbox.tsx` - shadcn/ui Checkbox
- `src/components/ui/form.tsx` - shadcn/ui Form
- `src/lib/actions/admin/menus.ts` - メニューCRUD Server Actions
- `src/lib/actions/admin/plans.ts` - プランCRUD Server Actions
- `src/app/admin/menus/page.tsx` - メニュー管理ページ
- `src/app/admin/plans/page.tsx` - プラン管理ページ
- `src/components/admin/forms/menu-form.tsx` - メニュー編集フォーム
- `src/components/admin/forms/plan-form.tsx` - プラン編集フォーム
- `src/middleware.ts` - /adminを保護パスに追加

## Decisions Made

- **CVE-2025-29927対策:** Middlewareだけでなく、Layout内でも認証・認可を再チェック
- **Defense-in-Depth:** 各Server Action内でrequireAdmin()を呼び出し
- **Supabase型推論:** anyキャストでsingle()の型推論問題を回避（既存パターン踏襲）
- **論理削除:** メニュー・プランの削除は is_active = false に更新

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **ルートグループ競合:** (admin)/dashboardと(member)/dashboardが/dashboardで競合 → /admin/dashboardに変更
- **TypeScript型推論:** Supabaseの.single()でnever型エラー → anyキャストで解決

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 管理画面基盤完了、メニュー・プラン管理機能実装済み
- 次プラン（05-02: 営業時間管理）の実装準備完了

## Self-Check: PASSED

All created files verified. All commits verified.

---
*Phase: 05-admin-features*
*Completed: 2026-02-22*
