---
phase: 14-plan-type-menu
plan: "01"
subsystem: admin-menus
tags: [admin, menu, plan-type, checkbox, crud]
dependency_graph:
  requires: [12-01]
  provides: [allowed_plan_types in admin menu CRUD]
  affects: [src/lib/actions/admin/menus.ts, src/components/admin/forms/menu-form.tsx, src/app/admin/menus/]
tech_stack:
  added: []
  patterns: [zod schema extension, server action with nullable array field, shadcn checkbox with array form field]
key_files:
  created: []
  modified:
    - src/lib/actions/admin/menus.ts
    - src/app/admin/menus/columns.tsx
    - src/components/admin/forms/menu-form.tsx
    - src/app/admin/menus/menus-client.tsx
    - src/app/admin/menus/page.tsx
decisions:
  - "空配列→NULL変換をonSubmit内で行う（D-06: 未選択=全プラン表示）"
  - "plans一覧は Server Component (page.tsx) でフェッチし Client Component に props で渡す"
metrics:
  duration: "~10 min"
  completed: "2026-03-28"
  tasks: 2
  files: 5
---

# Phase 14 Plan 01: allowed_plan_types 管理画面メニューCRUD対応 Summary

## One-liner

管理画面のメニューCRUDに `allowed_plan_types INTEGER[]` フィールドを追加し、プランタイプチェックボックスUIでDB保存できるようにした。

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | MenuSchema + CRUD + 型定義に allowed_plan_types を追加 | 3efc3a5 | menus.ts, columns.tsx |
| 2 | メニュー編集フォームにプランタイプチェックボックスUIを追加 | a8ee4c3 | menu-form.tsx, menus-client.tsx, page.tsx |

## What Was Built

### Task 1: バックエンド型定義とCRUD対応

- `src/lib/actions/admin/menus.ts`
  - `MenuSchema` に `allowed_plan_types: z.array(z.number()).nullable().optional()` を追加
  - `createMenu` の insert に `allowed_plan_types: validated.allowed_plan_types ?? null` を追加
  - `updateMenu` の update に `allowed_plan_types: validated.allowed_plan_types ?? null` を追加
  - `getMenus` の戻り値型に `allowed_plan_types: number[] | null` を追加

- `src/app/admin/menus/columns.tsx`
  - `Menu` 型に `allowed_plan_types: number[] | null` を追加

### Task 2: フロントエンドUI対応

- `src/components/admin/forms/menu-form.tsx`
  - `formSchema` に `allowed_plan_types: z.array(z.number()).optional()` を追加
  - `MenuFormProps` に `allowed_plan_types: number[] | null` と `plans?: Array<{ id: number; name: string }>` を追加
  - `defaultValues` に `allowed_plan_types: menu?.allowed_plan_types ?? []` を追加
  - `onSubmit` で空配列→NULLに変換してServer Actionを呼ぶ（全チェック外し=NULL=全プラン表示）
  - `send_thank_you_email` の後にプランタイプ選択チェックボックスUIを追加

- `src/app/admin/menus/menus-client.tsx`
  - `MenusClientProps` に `plans: Array<{ id: number; name: string }>` を追加
  - 作成・編集ダイアログの `MenuForm` に `plans={plans}` を渡す

- `src/app/admin/menus/page.tsx`
  - `plans` テーブルからアクティブなプラン一覧をフェッチ
  - `MenusClient` に `plans={plans ?? []}` を渡す

## Decisions Made

1. **空配列→NULL変換**: `onSubmit` 内で `values.allowed_plan_types?.length ? values.allowed_plan_types : null` として変換。空配列（全チェック外し）はNULL（全プラン表示）として扱う（D-06）。
2. **plans フェッチ場所**: Server Component の `page.tsx` でフェッチし、Client Component にprops経由で渡す。サーバーサイドフェッチで余分なクライアントAPIコールを回避。

## Deviations from Plan

### 実行時の問題

**git stash によるリンターリバート問題**
- 発見: ビルドエラー確認のために誤って `git stash` を実行
- stash pop 時にコンフリクトで失敗、リンターが Task 2 の変更を元に戻した
- 対応: `Write` ツールでファイルを再作成して復元
- 影響: 実装内容は同一、追加の作業時間が発生

### 既存のビルドエラー (スコープ外)

`npm run build` で `File '/Users/kugyu10/.next/types/app/(auth)/login/page.ts' not found` エラーが発生するが、これは今回の変更以前から存在する既存の問題。TypeScript型チェック (`npx tsc --noEmit`) は正常に通ることを確認済み。

## Verification Results

- `npx tsc --noEmit`: エラーなし (PASS)
- `npx vitest run`: 119テストパス (E2EテストはPlaywright設定の既存問題でスキップ)
- `grep -rn "allowed_plan_types"` で全対象ファイルにヒット確認済み

## Self-Check: PASSED

- [x] src/lib/actions/admin/menus.ts 変更確認
- [x] src/app/admin/menus/columns.tsx 変更確認
- [x] src/components/admin/forms/menu-form.tsx 変更確認
- [x] src/app/admin/menus/menus-client.tsx 変更確認
- [x] src/app/admin/menus/page.tsx 変更確認
- [x] コミット 3efc3a5 存在確認
- [x] コミット a8ee4c3 存在確認
