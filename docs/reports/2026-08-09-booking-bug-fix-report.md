# 予約バグ 調査・修正レポート (2026-08-09)

調査・修正: Claude (Fable 5) / コミット: `96e6dff` (develop、未push・未デプロイ)

## 症状(報告されたもの)

- 「既に予約済み」と誤判定される(空いているはずの枠なのに)
- キャンセル後に枠が復活しない
- 埋まっているはずなのにViewでは空いて見え、予約しようとすると予約済みになる
- 再現できたりできなかったりする

## 結論: 原因は3つの複合バグ(すべて本番で実証済み)

### 原因1: 空き枠APIがDBの予約を1件も見ていなかった(「空きに見えるのに予約済みエラー」の正体)

`/api/public/slots`(日・週)は anon キーで `bookings` を参照していたが、RLSポリシー
`"Guests cannot directly access bookings" USING (false)` により**常に0件がエラーなしで返る**
状態だった(本番で実測確認: anonキーでのSELECTは `[]`)。

空き判定は実質Googleカレンダー/Zoomのbusy時間(15分キャッシュ、取得失敗時は素通し)だけに
依存しており、キャッシュや連携の状態次第で結果が変わる——これが**「再現できたりできなかったり」の正体**。
予約時はDBのEXCLUDE制約(`status != 'canceled'`、エラーコード23P01)が正しく弾くため
「この時間帯は既に予約されています」になる。

### 原因2: Google OAuthが2026-03-26から完全に死んでいる(「予約が成立しない」の正体)

本番の refresh token を復号してGoogleに直接リフレッシュ要求したところ **`invalid_grant`(失効)**。
その結果、**3/27以降の予約は全件「カレンダー登録失敗 → Sagaの補償トランザクションで即時自動キャンセル」**
になっていた。

証拠: 本番 `bookings` の3/27以降の全レコードが created_at ≒ updated_at の `canceled` で、
zoom_meeting_id / google_event_id が null(=confirmステップに到達せず補償発動)。
`oauth_tokens` の access_token 失効時刻(2026-03-26T13:53Z)と完全に一致。

「予約キャンセルトランザクションが怪しい」という直感は正しく、補償キャンセルが毎回発動していた。

### 原因3: 会員予約の事前空きチェックもRLSで盲目

`checkSlotAvailability` は会員権限クライアントで実行され、RLS「自分の予約のみSELECT可」により
他人の予約が見えず、事前チェックが機能していなかった(EXCLUDE制約だけが機能)。

## 実施した修正(コミット `96e6dff`)

| ファイル | 修正内容 |
|---|---|
| `src/app/api/public/slots/route.ts` | bookings参照を service role 化。日境界に `+09:00` を明示(UTC解釈ずれ修正) |
| `src/app/api/public/slots/week/route.ts` | 同上(週版) |
| `src/lib/bookings/saga.ts` | ①事前空きチェックを service role 化 ②**カレンダー登録を非ブロッキング化**(失敗しても予約は成立) ③補償キャンセルのUPDATEに0行検知を追加 |
| `src/app/api/guest/bookings/route.ts` | ①Zoom/カレンダー作成**前**にDB競合の事前チェック追加(409) ②カレンダー登録を非ブロッキング化 |
| `src/lib/bookings/cancel.ts` | status更新を service role 化 + `.select("id")` でサイレント0行更新を検知 |
| `src/lib/integrations/oauth/google.ts` | OAuth2クライアントのグローバルキャッシュ除去(デバッグメモ記載の未適用修正を適用) |
| テスト | `cancel.test.ts` 新規5件、`compensateAll.test.ts` モック更新 |

- **全138テストパス、lint/buildクリーン、DBマイグレーション不要**(RLSは変更せず、サーバー側でservice roleを使用。返すのは空き状況のみでPIIなし)
- dev DBで「挿入→競合検知→重複INSERTが23P01→キャンセル(1行更新)→枠復活」の一連を実測検証済み(テストデータは削除済み)

## 要対応(ユーザー作業)

1. **【必須】管理画面からGoogle再認証** — これをしないとカレンダー連携は復活しない。
   - `invalid_grant` の典型原因: Google Cloud Console の OAuth 同意画面が「テスト」モード
     (**refresh tokenが7日で失効**)。本番運用するなら「本番(公開)」ステータスへ変更すること。
   - Vercel の `GOOGLE_REDIRECT_URI` が `https://time.kazumin0831.com/api/admin/oauth/google/callback`
     と一致し、Google Cloud Console の承認済みリダイレクトURIに登録済みかを確認。
2. コミット `96e6dff` をレビューしてデプロイ(デプロイ後はカレンダーが死んでいても予約自体は通る)
3. dev環境のスキーマドリフト解消: dev DB (`rvhivweztxowtjbivzhs`) に `20260303000001_add_break_time.sql`
   以降が未適用(`weekly_schedules.break_start_time` が無く、devの空き枠APIは常に0件)
4. 任意: カレンダー登録失敗時の管理者通知(現状はログのみ)

## 関連ドキュメント

- 調査詳細: `.planning/debug/booking-phantom-conflict-and-cancel-not-freeing.md`
- 過去の関連デバッグ: `.planning/debug/google-oauth-redirect-uri-mismatch.md`
