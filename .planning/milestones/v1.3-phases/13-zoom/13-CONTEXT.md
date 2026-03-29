# Phase 13: Zoomカレンダーブロック - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

ZOOM_AおよびZOOM_Bのスケジュール済みミーティングを空き枠判定に反映し、Zoomと予約システムの矛盾を解消する。UIの変更は不要。バックエンド（API・ロジック）のみ。

</domain>

<decisions>
## Implementation Decisions

### Zoom API統合方式
- **D-01:** ミーティング一覧取得関数 `getZoomScheduledMeetings()` を既存の `src/lib/integrations/zoom.ts` に追加する。トークン取得やエラーハンドリングを再利用。
- **D-02:** ZOOM_AとZOOM_Bのスケジュール取得は `Promise.allSettled` で並列実行する。片方が失敗してももう片方の結果は使える。

### 空き枠判定への組み込み方
- **D-03:** Zoomのビジー時間をGoogle CalendarのbusyTimes配列にマージし、既存の `isSlotBusy()` をそのまま使う。変更箇所を最小化。
- **D-04:** `/api/public/slots` と `/api/public/slots/week` の両方に反映する。
- **D-05:** 予約確定時のZoomリアルタイム確認は `saga.ts` のフローにステップを追加する。Zoom会議作成前にスケジュール確認し、競合時はエラー返却。

### キャッシュ戦略
- **D-06:** Google Calendarと同じ `LRUCache` パターンで15分TTLのキャッシュを実装する。一貫性のある既存パターン踏襲。
- **D-07:** 予約確定時（saga.ts内）はキャッシュをバイパスしてリアルタイムでZoom APIを叩く。

### エラー3161フォールバック
- **D-08:** ZOOM_B（無料アカウント）がエラー3161（APIスコープ制限）を返した場合、空配列を返却し `console.warn` でログ記録する。予約フローは止めない。
- **D-09:** 実機確認（ZOOM_BでGET /users/me/meetings をcurl実行）はデプロイ後に行う。先にフォールバック込みで実装を完了させる。

### Claude's Discretion
- Zoom APIレスポンスの型定義の詳細
- busyTimesマージの具体的な実装方法（配列concat + 重複除去 or そのまま追加）
- saga.tsへの追加ステップの具体的な位置（補償トランザクションとの整合）
- Zoomスケジュール取得のページネーション処理（30日以内の予定数が少ない場合は不要の可能性）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Zoom API統合
- `src/lib/integrations/zoom.ts` — 既存Zoom S2S OAuth統合。トークンキャッシュ、会議作成/削除。ここにスケジュール取得を追加
- `src/__tests__/lib/integrations/zoom.test.ts` — 既存Zoomテスト

### 空き枠判定
- `src/app/api/public/slots/route.ts` — 単日スロットAPI。Google CalendarのbusyTimesで判定。Zoomビジー時間のマージ先
- `src/app/api/public/slots/week/route.ts` — 週間スロットAPI。同上の空き枠ロジック。同じ変更が必要
- `src/lib/integrations/google-calendar.ts` — Google Calendar統合。LRUCacheパターンの参考実装（getCachedBusyTimes）

### 予約フロー
- `src/lib/bookings/saga.ts` — 予約Sagaパターン。Zoom会議作成前にスケジュール確認ステップを追加する場所

### 要件
- `.planning/REQUIREMENTS.md` — ZOOM-01〜ZOOM-04の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getZoomAccessToken(accountType)`: アカウント別トークン取得（LRUCacheで~1時間TTL）— そのまま再利用
- `LRUCache` パターン: Google Calendar（15分TTL）、Zoomトークン（~1時間TTL）で確立済み
- `isSlotBusy()`: busyTimes配列とスロットの重複判定関数 — Zoomビジー時間をマージすれば変更不要
- `BusyTime` インターフェース: `{ start: string; end: string }` — Zoom側も同じ形式に変換すれば合流可能

### Established Patterns
- エラー時フォールバック: Google Calendar取得失敗時は空配列を返して予約可能にする（slots/route.ts L184-189）— Zoomも同パターン
- `Promise.allSettled`: プロジェクト内で直接使用例は少ないが、Zoom A/Bの並列取得に最適

### Integration Points
- `slots/route.ts` L177-190: busyTimes取得後のマージポイント（Zoomビジー時間をここで合流）
- `slots/week/route.ts` L158-164: 週間API側の同等のマージポイント
- `saga.ts`: Zoom会議作成ステップ前にスケジュール確認を挿入

</code_context>

<specifics>
## Specific Ideas

- Zoomミーティング取得は `GET /users/me/meetings?type=scheduled` エンドポイントを使用
- ZOOM_B（無料アカウント）ではこのエンドポイントがスコープ制限でエラー3161を返す可能性あり — フォールバック必須
- Zoomスケジュール取得結果の `BusyTime` 変換: `meetings[].start_time` と `meetings[].duration` から `{ start, end }` を計算
- 現在のZoom OAuthスコープ名 `meeting:read:list_meetings:admin` はDeveloper Consoleで要確認（信頼度LOW — STATE.md記載）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-zoom*
*Context gathered: 2026-03-28*
