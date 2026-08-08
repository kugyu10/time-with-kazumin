---
status: fixed-pending-deploy
trigger: "予約時に『既に予約済み』誤判定 / キャンセル後に枠が復活しない / Viewでは空いて見えるのに予約すると予約済み（再現不安定）"
created: 2026-08-09
investigated_by: Claude (Fable 5)
---

## TL;DR（根本原因は3つの複合）

1. **空き枠APIがDBの予約を1件も見ていなかった（最重要）**
   `/api/public/slots` と `/api/public/slots/week` は anon キーで `bookings` を SELECT していたが、
   RLS ポリシー `"Guests cannot directly access bookings" USING (false)` により **常に0件（エラーなし）**。
   → 空き判定は実質 Google カレンダー/Zoom の busy 時間（15分キャッシュ・取得失敗時は素通し）だけに依存。
   → busyが取れている間は偶然正しく見え、取れない/古いと「空きに見えるのに予約するとEXCLUDE制約(23P01)で『既に予約されています』」。
   **再現が不安定だった理由はこのキャッシュ/連携状態への依存。**

2. **Google OAuth が 2026-03-26 から完全に死んでいる（本番で確認済み）**
   - `oauth_tokens` (provider=google): access_token 失効 2026-03-26T13:53Z、以降 updated_at 更新なし
   - refresh token を復号して Google に直接リフレッシュ要求 → **`invalid_grant`**（失効/取り消し済み）
   - 結果: 3/27以降の**全予約がカレンダー登録ステップで失敗 → Saga補償で即時自動キャンセル**
     （本番bookingsで確認: 3/27以降の予約は全件 created_at==updated_at で canceled、zoom/gcal ID null）
   - 会員には「カレンダー登録に失敗しました」等が返り、予約が成立しない状態が続いていた
   - 参考: `.planning/debug/google-oauth-redirect-uri-mismatch.md`（redirect_uri 問題。
     なお同メモに「グローバル oauth2Client キャッシュ除去済み」とあるが**コードには未適用だった**→今回適用）

3. **会員Sagaの事前空きチェックもRLSで盲目**
   `checkSlotAvailability` は会員権限クライアントで実行され、RLS「自分の予約のみSELECT可」により
   他人の予約が見えず、事前チェックが機能していなかった（最終防衛線のEXCLUDE制約だけが機能）。

## 実施した修正（コード。未デプロイ・本番DB変更なし）

| ファイル | 修正 |
|---|---|
| `src/app/api/public/slots/route.ts` | bookings参照を service role 化。日境界に `+09:00` を明示（UTC解釈ずれ修正） |
| `src/app/api/public/slots/week/route.ts` | 同上（週版） |
| `src/lib/bookings/saga.ts` | ① `checkSlotAvailability` を service role 化 ② **カレンダー登録を非ブロッキング化**（失敗しても予約は成立、ログのみ） ③ 補償キャンセルのUPDATEに0行検知を追加 |
| `src/app/api/guest/bookings/route.ts` | ① Zoom/カレンダー作成**前**にDB競合の事前チェック追加（409を返す） ② カレンダー登録を非ブロッキング化 |
| `src/lib/bookings/cancel.ts` | status更新を service role 化 + `.select("id")` で0行更新（サイレント失敗）を検知 |
| `src/lib/integrations/oauth/google.ts` | OAuth2クライアントのグローバルキャッシュ除去（毎回生成。デバッグメモの未適用修正を適用） |
| テスト | `cancel.test.ts` 新規5件、`compensateAll.test.ts` モック更新。**全138件パス**、lint/build クリーン |

DBマイグレーションは**不要**（RLSは変更せず、サーバー側で service role を使う方針。返すのは空き状況のみでPIIなし）。

## 検証

- 本番: anonキーで `bookings` SELECT → `[]` を実測確認（原因1の実証）
- 本番: refresh token 復号 → Google へ refresh 要求 → `invalid_grant` 実測（原因2の実証）
- dev DB: 挿入→競合チェック検知→重複INSERTが23P01→キャンセル(1行更新)→枠復活、の一連を実測確認（テストデータは削除済み）

## 残タスク（要ユーザー対応）

1. **【必須・これをしないと予約は直らない】Google 再認証**
   管理画面 → 設定 → Google連携 で再認証する。
   - `invalid_grant` の典型原因: Google Cloud Console の OAuth 同意画面が「テスト」モード
     （**refresh token が7日で失効**する）。本番運用するなら「本番(公開)」ステータスに変更すること。
   - Vercel の `GOOGLE_REDIRECT_URI` が `https://time.kazumin0831.com/api/admin/oauth/google/callback`
     と一致しているか、Google Cloud Console の承認済みリダイレクトURIに登録済みかを確認。
2. コードレビュー後、デプロイ（今回の修正で「カレンダーが死んでいても予約自体は成立」するようになる）
3. dev環境のスキーマドリフト: dev DB (`rvhivweztxowtjbivzhs`) に `20260303000001_add_break_time.sql` 以降が
   未適用（`weekly_schedules.break_start_time` が無く、devの空き枠APIは常に0件になる）。dev に migration を適用推奨。
4. 任意: カレンダー登録失敗時の管理者通知（現状はログのみ）
