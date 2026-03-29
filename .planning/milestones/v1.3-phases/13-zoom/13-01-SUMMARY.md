---
phase: 13-zoom
plan: 01
subsystem: zoom-integration
tags: [zoom, cache, busy-time, lru-cache, tdd]
dependency_graph:
  requires: []
  provides: [getZoomScheduledMeetings, getCachedZoomBusyTimes, clearZoomScheduleCache]
  affects: [src/lib/integrations/zoom.ts]
tech_stack:
  added: [BusyTime import from google-calendar]
  patterns: [LRUCache TTL pattern, error 3161 fallback, cache bypass pattern]
key_files:
  created: []
  modified:
    - src/lib/integrations/zoom.ts
    - src/__tests__/lib/integrations/zoom.test.ts
decisions:
  - "getZoomScheduledMeetings はトークンキャッシュを使いつつスケジュールキャッシュをバイパスする（予約確定時のリアルタイム確認保証）"
  - "getCachedZoomBusyTimes はスケジュールキャッシュ（15分TTL）を使い通常のスロット表示に使用する"
  - "テストのfetch回数期待値はトークンキャッシュの挙動を考慮して3回（token×1 + meetings×2）とした"
metrics:
  duration: ~15 min
  completed: 2026-03-28
  tasks_completed: 1
  files_modified: 2
---

# Phase 13 Plan 01: Zoom スケジュール取得関数追加 Summary

## One-liner

Zoom APIからスケジュール済みミーティングをBusyTime[]で取得する3関数（getZoomScheduledMeetings/getCachedZoomBusyTimes/clearZoomScheduleCache）をTDDで実装し、エラー3161フォールバックとキャッシュバイパス振る舞いをユニットテストで検証済み。

## What Was Built

zoom.ts に以下の3つのエクスポート関数を追加した：

1. **`getZoomScheduledMeetings(accountType, fromDate, toDate): Promise<BusyTime[]>`**
   - Zoom API `GET /v2/users/me/meetings?type=scheduled` を呼び出してスケジュールを取得
   - アカウント未設定時は空配列を返す（フォールバック）
   - エラー3161（APIスコープ制限）時は空配列を返す（ZOOM_B対応）
   - fetch例外時は空配列を返す
   - **毎回APIを呼び出し、スケジュールキャッシュを使用しない**（予約確定時のリアルタイム確認保証）

2. **`getCachedZoomBusyTimes(accountType, startDate, endDate): Promise<BusyTime[]>`**
   - 15分TTLのLRUCache（max: 20エントリ）を使ってスケジュールをキャッシュ
   - スロット表示の通常フローで使用する想定

3. **`clearZoomScheduleCache(): void`**
   - スケジュールキャッシュをクリアする（予約確定後のキャッシュ無効化に使用）

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | TDD: 失敗テスト追加 | a635061 | zoom.test.ts |
| 1 (GREEN) | zoom.ts に3関数実装 | da2c259 | zoom.ts, zoom.test.ts |

## Verification Results

- `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` → **21 passed** (exit 0)

### Test Coverage
- getZoomScheduledMeetings: アカウント未設定、BusyTime変換、エラー3161、fetch例外、キャッシュバイパス(ZOOM-04)
- getCachedZoomBusyTimes: 2回目呼び出しでキャッシュ使用、clearZoomScheduleCache後の再取得

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] テスト期待値のfetch回数をトークンキャッシュ挙動に合わせて修正**
- **Found during:** Task 1 GREEN フェーズ
- **Issue:** プラン記述では「token取得2回 + meetings取得2回 = 4回」だが、`getZoomScheduledMeetings` はトークンキャッシュ（tokenCache）を使うため、2回目の呼び出しではtokenフェッチをスキップして実際は3回になる
- **Fix:** cache bypass テストの期待値を4回→3回に修正（token×1 + meetings×2）。should re-fetch テストも同様に3回に修正（未使用mockを残さないようにして隣接テストへの干渉も防止）
- **Files modified:** src/__tests__/lib/integrations/zoom.test.ts
- **Commit:** da2c259

**補足:** キャッシュバイパスの意味は「スケジュールキャッシュをバイパスする」ことであり、トークンキャッシュはそのまま使用するのが正しい動作。meetingsエンドポイントが毎回呼ばれることがZOOM-04の要件（予約確定時のリアルタイム確認）を満たしている。

## Known Stubs

なし - 全ての関数が実際のZoom APIを呼び出す実装となっている。

## Self-Check: PASSED
