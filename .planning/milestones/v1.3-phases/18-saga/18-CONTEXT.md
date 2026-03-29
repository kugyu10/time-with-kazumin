# Phase 18: Saga補償トランザクション修正 - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Source:** GitHub Issue #13

<domain>
## Phase Boundary

saga.ts の補償トランザクション（compensation）が失敗した場合にリソースが残留する問題を修正する。予約作成と予約キャンセルの両方で、Zoom会議・Googleカレンダー・ポイント・予約レコードの整合性を保証する。

</domain>

<decisions>
## Implementation Decisions

### 補償失敗時の挙動
- **D-01:** 補償関数（compensateZoomDelete, compensateCalendarDelete等）が失敗した場合、エラーログに加えて戻り値のerrorに補償失敗の詳細を含める。ユーザーには「予約は失敗しましたが、一部のリソースのクリーンアップに失敗しました」と伝える。
- **D-02:** 補償失敗時も全補償ステップを最後まで実行する（1つの補償が失敗しても他の補償は実行する）。現在の実装は正しくこの方針。
- **D-03:** `completedSteps.reverse()` の破壊的変更を `[...completedSteps].reverse()` に修正し、元配列を保護する。

### cancel.ts の改善
- **D-04:** cancel.ts のZoom削除・Googleカレンダー削除は現在「非ブロッキング」方針（失敗してもキャンセルは続行）。この方針は維持する。ただし失敗した場合の情報を戻り値に含める。

### Claude's Discretion
- 補償失敗情報の具体的なデータ構造
- リトライ回数の調整（現在2回）
- ログレベルの調整

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 予約Saga
- `src/lib/bookings/saga.ts` — 予約作成Sagaパターン。compensateAll(), compensateZoomDelete(), compensateCalendarDelete() が修正対象
- `src/lib/bookings/cancel.ts` — 予約キャンセル処理。Zoom/Calendar削除の非ブロッキング処理

### 外部API統合
- `src/lib/integrations/zoom.ts` — deleteZoomMeeting()
- `src/lib/integrations/google-calendar.ts` — deleteCalendarEvent()
- `src/lib/utils/retry.ts` — retryWithExponentialBackoff()

### Issue
- GitHub Issue #13: https://github.com/kugyu10/time-with-kazumin/issues/13

</canonical_refs>

<code_context>
## Existing Code Insights

### 現在の問題点
1. `compensateAll()` で `completedSteps.reverse()` が元配列を破壊的に変更
2. 補償関数が失敗しても `catch` で握りつぶし、呼び出し元に補償失敗を伝えない
3. ユーザーには「予約に失敗しました」としか表示されず、Zoom会議が残留している可能性が分からない

### 正しい動作
- compensateAll() は全ステップを逆順に実行（現在の実装は正しい）
- 各補償関数は retryWithExponentialBackoff で2回リトライ（現在の実装は正しい）
- 補償失敗を収集して呼び出し元に返す仕組みが不足

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard bug fix approach

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-saga*
*Context gathered: 2026-03-29*
