---
phase: 16-member-activity
plan: 02
subsystem: admin-ui
tags: [activity-status, data-table, dashboard, server-component]
dependency_graph:
  requires: [16-01]
  provides: [ACT-01, ACT-02, ACT-03]
  affects: [src/components/ui/data-table.tsx, src/app/admin/members, src/app/admin/dashboard]
tech_stack:
  added: []
  patterns: [getRowClassName prop pattern, async Server Component + Suspense]
key_files:
  created:
    - src/app/admin/dashboard/follow-up-list.tsx
  modified:
    - src/components/ui/data-table.tsx
    - src/app/admin/members/columns.tsx
    - src/app/admin/members/members-client.tsx
    - src/app/admin/dashboard/page.tsx
decisions:
  - "DataTable getRowClassNameはoptional prop (TData汎用) — Member以外のテーブルへの影響なし"
  - "sortingFnを文字列比較で実装 — ISO 8601形式なので文字列ソートで正しく動作する"
  - "FollowUpListはasync Server Component — dashboard/page.tsxをasync化せずSuspenseで囲む (RESEARCH.md Pitfall 5対策)"
  - "全件表示 (YAGNI) — 会員数が少ないサロン運営のためページングは不要"
metrics:
  duration_min: 10
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_modified: 5
---

# Phase 16 Plan 02: 会員アクティビティUI実装 Summary

## One-liner

DataTableにgetRowClassName propを追加して会員一覧の行色分けを実現し、ダッシュボード下部にFollowUpList async Server Componentでフォロー会員リストを表示。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DataTable getRowClassName + columns前回セッション + members-client行スタイル | f85e88b | data-table.tsx, columns.tsx, members-client.tsx |
| 2 | ダッシュボード FollowUpList Server Component | 52e0d5a | follow-up-list.tsx, dashboard/page.tsx |

## What Was Built

### Task 1: 会員一覧の行背景色 + 前回セッションカラム

**src/components/ui/data-table.tsx**
- `getRowClassName?: (row: Row<TData>) => string` optional prop を追加
- `Row` 型を `@tanstack/react-table` からインポート
- `TableRow` の `className` に `getRowClassName?.(row)` を適用

**src/app/admin/members/columns.tsx**
- `last_session_at` カラムをステータスカラムの前に追加
- セル表示: `null` → 「未訪問」(muted)、0日 → 「今日」、N日 → 「N日前」
- ISO 8601文字列比較によるソート関数

**src/app/admin/members/members-client.tsx**
- `getMemberRowClassName(row: Row<Member>): string` 関数を追加
  - `red` → `bg-red-50 hover:bg-red-100`
  - `yellow` → `bg-yellow-50 hover:bg-yellow-100`
- `DataTable` に `getRowClassName={getMemberRowClassName}` を渡す

### Task 2: ダッシュボードフォローリスト

**src/app/admin/dashboard/follow-up-list.tsx** (新規)
- `async` Server Component として実装
- `getFollowUpMembers()` で取得した会員を `red` / `yellow` に分類
- `FollowUpSection` サブコンポーネントで赤セクション（60日以上）→ 黄セクション（30-60日）の順に表示
- 0件時は「フォローが必要な会員はいません。」メッセージ

**src/app/admin/dashboard/page.tsx**
- `Suspense` と `FollowUpList` をインポート
- クイックリンクグリッドの下に「フォローが必要な会員」セクションを追加
- `page.tsx` 自体は非同期化せず `FollowUpList` を `Suspense` で囲む

## Deviations from Plan

None - プラン通りに実装。

## Known Stubs

None - 全データはgetMembers()/getFollowUpMembers()から実データを取得している。

## Self-Check: PASSED

- src/components/ui/data-table.tsx: FOUND
- src/app/admin/members/columns.tsx: FOUND
- src/app/admin/members/members-client.tsx: FOUND
- src/app/admin/dashboard/follow-up-list.tsx: FOUND
- src/app/admin/dashboard/page.tsx: FOUND
- Commit f85e88b: FOUND
- Commit 52e0d5a: FOUND
- TypeScript: no errors
