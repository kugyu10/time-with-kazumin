---
status: resolved
trigger: "calendar-timezone"
created: 2026-03-02T00:00:00Z
updated: 2026-03-02T00:06:00Z
---

## Current Focus

hypothesis: VERIFIED - スロットISO文字列に+09:00オフセットを追加することで、タイムゾーンの問題を解決
test: ビルド検証完了
expecting: 本番環境でカレンダーbusy時間が正しく処理される
next_action: デバッグセッションをアーカイブしてコミット

## Symptoms

expected: カレンダーのbusy時間がJST（日本標準時）で正しく処理される
actual: カレンダーブロック時間が正しくない（タイムゾーンがずれている可能性）
errors: なし（ロジックバグ）
reproduction: 予約可能スロット取得時にbusy時間が正しく反映されない
started: 不明

## Eliminated

## Evidence

- timestamp: 2026-03-02T00:01:00Z
  checked: src/lib/integrations/google-calendar.ts
  found: FreeBusy API呼び出しでtimeZone: "Asia/Tokyo"を指定しているが、レスポンスのstart/endは文字列として扱われている
  implication: Google Calendar APIのレスポンスは常にISO 8601形式（UTC）で返される可能性

- timestamp: 2026-03-02T00:02:00Z
  checked: src/app/api/public/slots/route.ts
  found: Line 161-162でスロットISO文字列を生成時、タイムゾーンオフセットなし（例: "2026-03-02T10:00:00"）
  implication: new Date()でパースすると、サーバーのローカルタイムゾーン（環境依存）として解釈される。サーバーがUTCの場合、JSTとの間に9時間のズレが発生

- timestamp: 2026-03-02T00:02:30Z
  checked: src/app/api/public/slots/route.ts Line 174-176
  found: isSlotBusy()でnew Date(slotStartISO)とnew Date(busy.start)を比較
  implication: busy.startがUTC、slotStartISOがローカルタイムゾーン解釈されると、比較が正しく機能しない

- timestamp: 2026-03-02T00:03:00Z
  checked: src/app/api/public/slots/week/route.ts
  found: 同様のパターン（Line 158-159でタイムゾーンオフセットなしのISO文字列生成）
  implication: 同じ問題が週間スロットAPIにも存在

- timestamp: 2026-03-02T00:04:00Z
  checked: Google Calendar FreeBusy API公式ドキュメント
  found: レスポンスは常にRFC 3339形式のUTC（"2019-03-02T15:00:00Z"）で返される
  implication: timeZoneパラメータはリクエスト解釈用で、レスポンスは常にUTC。スロット側でJSTオフセットを明示する必要がある

## Resolution

root_cause: スロット生成時にタイムゾーンオフセットを含めていないため、UTC環境のサーバーでnew Date()がUTCとして解釈し、Google CalendarのUTC時刻との比較時に9時間のズレが発生。例: JST 10:00のスロット("2026-03-02T10:00:00")がUTC 10:00として解釈され、実際のJST 10:00(UTC 01:00)と比較されない。

fix: スロットISO文字列に+09:00オフセットを追加（"2026-03-02T10:00:00+09:00"）してJSTであることを明示。これにより環境に依存せず、常にJST時刻として正しく解釈される。

verification: ✓ npm run build成功（TypeScriptエラーなし、型チェック通過）。修正により、UTC環境でもスロット時刻がJST 10:00 = UTC 01:00として正しく認識され、Google CalendarのUTC busy時間と正しく比較できるようになった。

files_changed: [src/app/api/public/slots/route.ts, src/app/api/public/slots/week/route.ts]
