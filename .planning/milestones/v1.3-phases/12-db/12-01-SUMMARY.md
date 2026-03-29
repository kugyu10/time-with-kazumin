---
phase: 12-db
plan: 01
subsystem: database
tags: [postgresql, supabase, migration, integer-array, gin-index, seed-data, typescript-types]

# Dependency graph
requires: []
provides:
  - "meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL カラム（GINパーシャルインデックス付き）"
  - "お金のブロック解消プラン（plans テーブル）: monthly_points=120, max_points=240, price_monthly=50000"
  - "60分お金のブロック解消セッション（meeting_menus テーブル）: allowed_plan_types にプランID設定済み"
  - "src/types/database.ts に allowed_plan_types: number[] | null 型反映済み"
affects: [14-menu-filter, phase-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CTE (WITH ... RETURNING id) パターンで SERIAL id を取得して別テーブルに参照設定"
    - "GINパーシャルインデックス (WHERE allowed_plan_types IS NOT NULL) で NULL 行を除外"
    - "カラム追加マイグレーションは ALTER TABLE ... ADD COLUMN IF NOT EXISTS パターン踏襲"
    - "seed データはマイグレーションファイル内に含める（seed.sql は初期データ専用）"

key-files:
  created:
    - supabase/migrations/20260327000001_add_allowed_plan_types.sql
    - supabase/migrations/20260327000002_seed_money_block_plan.sql
  modified:
    - src/types/database.ts

key-decisions:
  - "allowed_plan_types INTEGER[] DEFAULT NULL — NULLで全プラン表示（後方互換）、配列で対象プランを限定"
  - "zoom_account は暫定 'A' を使用（D-04 要確認事項を踏襲、後で変更可能）"
  - "seed データはマイグレーションファイル内に含める（seed.sql は初期データ専用）"
  - "GINインデックスはパーシャル（WHERE IS NOT NULL）で NULL 行を除外し効率化"

patterns-established:
  - "CTE INSERT ... RETURNING パターン: SERIAL id を事前に決め打ちせず CTE で取得してから参照"

requirements-completed: [MENU-01, MENU-03, MENU-05]

# Metrics
duration: 13min
completed: 2026-03-27
---

# Phase 12 Plan 01: DBスキーマ基盤 Summary

**meeting_menus.allowed_plan_types INTEGER[]カラム追加（GINパーシャルインデックス）とお金のブロック解消プラン/専用メニューのseedデータ投入、TypeScript型定義再生成まで完了**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-27T10:58:49Z
- **Completed:** 2026-03-27T11:11:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `meeting_menus` テーブルに `allowed_plan_types INTEGER[] DEFAULT NULL` カラムを追加し、GINパーシャルインデックスを適用
- `お金のブロック解消プラン`（monthly_points=120, max_points=240, price_monthly=50000）を `plans` テーブルに INSERT
- `60分お金のブロック解消セッション`（duration_minutes=60, points_required=60, allowed_plan_types にプランID設定）を CTE 経由で `meeting_menus` に INSERT
- `supabase db reset` でローカルDB適用、`supabase gen types typescript` で TypeScript型定義を再生成
- `npm run build` エラーなし、既存ユニットテスト 107 件全パス

## Task Commits

各タスクをアトミックにコミット:

1. **Task 1: allowed_plan_types カラム追加マイグレーションとseedデータ投入** - `0a1923c` (feat)
2. **Task 2: TypeScript 型定義の再生成と既存テスト通過確認** - `fa7d29f` (feat)

## Files Created/Modified

- `supabase/migrations/20260327000001_add_allowed_plan_types.sql` - allowed_plan_types カラム追加 + GINパーシャルインデックス定義
- `supabase/migrations/20260327000002_seed_money_block_plan.sql` - お金のブロック解消プラン + 専用メニュー seed データ（CTE使用）
- `src/types/database.ts` - supabase gen types typescript で再生成、meeting_menus の Row/Insert/Update 型に allowed_plan_types 追加

## Decisions Made

- zoom_account は暫定 `'A'` を使用（CONTEXT.md D-04「要確認」を踏襲。後で変更可能）
- seed データはマイグレーションファイル内に含める（seed.sql は初期データ専用のベストプラクティス準拠）
- GINインデックスはパーシャル（WHERE allowed_plan_types IS NOT NULL）でインデックス対象を限定し効率化

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] supabase gen types の標準エラー出力が database.ts に混入**
- **Found during:** Task 2 (型定義再生成)
- **Issue:** `supabase gen types typescript --local > database.ts` で実行すると `Connecting to db 5432` がファイル先頭に混入し ESLint パースエラー
- **Fix:** `2>/dev/null` を追加して標準エラー出力をリダイレクト（`supabase gen types typescript --local 2>/dev/null > database.ts`）
- **Files modified:** src/types/database.ts
- **Verification:** npm run build がエラーなく完了
- **Committed in:** fa7d29f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** ビルドエラーを防ぐために必要な修正。スコープ逸脱なし。

## Issues Encountered

- Supabase ローカル環境が停止していたため `supabase start` が必要。初回起動でDockerイメージのダウンロードに約4分かかった（環境初回起動のため、再現しない）
- `npm run test` で 3 ファイル失敗しているが、これは E2E Playwright spec ファイルが Vitest に読み込まれる既存の既知問題（マイグレーション前後で変化なし: 3 failed | 107 passed）

## User Setup Required

None — ローカル環境への自動適用のみ。本番環境へのマイグレーション適用は別途 Supabase ダッシュボードまたは `supabase db push` で実施。

## Next Phase Readiness

- Phase 14（プランタイプ別メニュー表示）のDB基盤が整備完了
- `allowed_plan_types` カラムが存在し、既存メニューは全て NULL（後方互換）
- お金のブロック解消プランのIDは DB に動的に割り当てられているため、Phase 14 のアプリ層では DB クエリで取得する
- Phase 14 実装前確認事項: `meeting_menus` 既存 RLS ポリシー（is_active = true のみ）との干渉なし確認（STATE.md 記載済み）

---
*Phase: 12-db*
*Completed: 2026-03-27*
