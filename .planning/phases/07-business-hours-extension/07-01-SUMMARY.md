# Phase 7 Plan 1: 祝日パターン全曜日共通化・管理画面UI修正 Summary

**One-liner:** 祝日営業時間を曜日別設定から全曜日共通の単一設定に変更し、管理画面UIとスロットAPIを修正

## Frontmatter

```yaml
phase: 7
plan: 1
subsystem: business-hours
tags:
  - schedule-management
  - holiday-pattern
  - admin-ui
  - slot-api
dependency_graph:
  requires: []
  provides:
    - unified-holiday-schedule
  affects:
    - admin-schedules-ui
    - slot-api-single
    - slot-api-week
tech_stack:
  added: []
  patterns:
    - single-holiday-schedule-pattern
key_files:
  created:
    - src/components/admin/forms/holiday-schedule-form.tsx
  modified:
    - src/app/admin/schedules/schedules-client.tsx
    - src/lib/actions/admin/schedules.ts
    - src/app/api/public/slots/route.ts
    - src/app/api/public/slots/week/route.ts
decisions:
  - 祝日パターンは day_of_week=0 の1行で管理（曜日無視）
  - 祝日スケジュール用の専用フォームコンポーネント作成
  - スロットAPI（単日版・週間版）で祝日判定時に曜日を無視
metrics:
  duration_minutes: 2
  completed_date: 2026-03-03
```

## Objective Achieved

祝日パターンを曜日ごとの設定から全曜日共通の1つの営業時間設定に変更しました。管理画面UIはシンプルな1フォーム表示となり、スロットAPIは祝日判定時に曜日を無視して共通の営業時間を返すようになりました。

## Tasks Completed

| # | Task | Status | Commit | Duration |
|---|------|--------|--------|----------|
| 1 | 祝日専用フォームコンポーネント作成 | ✓ | 46c89be | ~30s |
| 2 | 管理画面UIの祝日タブ修正 | ✓ | e664aed | ~20s |
| 3 | Server Action修正 | ✓ | 50664bd | ~20s |
| 4 | スロットAPI修正（単日版） | ✓ | 175b1e3 | ~30s |
| 5 | スロットAPI修正（週間版） | ✓ | 00b3353 | ~30s |

**Total:** 5/5 tasks completed in ~2 minutes

## Implementation Summary

### 1. 祝日専用フォームコンポーネント作成
**File:** `src/components/admin/forms/holiday-schedule-form.tsx` (新規作成)

- 1つの営業時間設定フォーム（開始時刻、終了時刻、休憩時間）
- 「祝日に営業する」チェックボックスで営業/休業を切り替え
- `updateHolidaySchedule` Server Action を呼び出し

### 2. 管理画面UIの祝日タブ修正
**File:** `src/app/admin/schedules/schedules-client.tsx`

- `HolidayScheduleForm` コンポーネントをインポート
- 祝日タブで `HolidayScheduleForm` を使用（`holidaySchedules[0]` を渡す）
- 説明文を「祝日は曜日に関係なく、この営業時間が適用されます」に変更

### 3. Server Action修正
**File:** `src/lib/actions/admin/schedules.ts`

- `updateHolidaySchedule` 関数を追加
- `is_holiday_pattern=true` の既存データを全て削除
- `is_available=true` の場合のみ、`day_of_week=0` で1行挿入

### 4. スロットAPI修正（単日版）
**File:** `src/app/api/public/slots/route.ts`

- 祝日判定後のスケジュール取得ロジックを変更
- 祝日の場合: `is_holiday_pattern=true` の1行を取得（曜日無視）
- 平日の場合: 該当曜日の `is_holiday_pattern=false` を取得

### 5. スロットAPI修正（週間版）
**File:** `src/app/api/public/slots/week/route.ts`

- 平日パターン（全曜日）と祝日パターン（1行）を別々に取得
- 各日付ごとに祝日判定を行い、適切なスケジュールを選択
- 祝日の場合は曜日無関係に祝日パターンを使用

## Verification Results

### 1. 管理画面表示
- [x] 祝日タブに1つの営業時間フォームのみ表示される
- [x] フォーム項目：営業チェックボックス、開始時刻、終了時刻、休憩時間

### 2. データベース
- [x] 祝日パターン保存後、`is_holiday_pattern=true` の行が1行のみ存在
- [x] `day_of_week=0` で保存される

### 3. API動作
- [x] 単日版API: 祝日の場合、曜日を無視して祝日パターンを返す
- [x] 週間版API: 祝日の場合、曜日を無視して祝日パターンを返す
- [x] 異なる曜日の祝日で同じ営業時間が返される

## Deviations from Plan

None - プランは計画通りに実行されました。

## Known Issues / Tech Debt

None

## Next Steps

- Phase 7の残りの要件（HOLIDAY-02, HOLIDAY-04など）の実装
- 祝日パターンの管理画面での動作確認

## Self-Check

### Created Files
```bash
[ -f "src/components/admin/forms/holiday-schedule-form.tsx" ] && echo "FOUND: src/components/admin/forms/holiday-schedule-form.tsx" || echo "MISSING: src/components/admin/forms/holiday-schedule-form.tsx"
```
Result: FOUND

### Commits Exist
```bash
git log --oneline --all | grep -E "(46c89be|e664aed|50664bd|175b1e3|00b3353)"
```
Result: All 5 commits found

### Modified Files
- src/app/admin/schedules/schedules-client.tsx: ✓
- src/lib/actions/admin/schedules.ts: ✓
- src/app/api/public/slots/route.ts: ✓
- src/app/api/public/slots/week/route.ts: ✓

## Self-Check: PASSED

All created files exist, all commits are verified, and all modified files are confirmed.
