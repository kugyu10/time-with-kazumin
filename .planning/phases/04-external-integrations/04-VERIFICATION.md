---
phase: 04-external-integrations
verified: 2026-02-22T21:35:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Google OAuth認証フロー"
    expected: "管理者がGoogleアカウントで認証し、トークンがDBに保存される"
    why_human: "実際のGoogle OAuth consent画面とトークン取得の確認が必要"
  - test: "Zoom会議作成（アカウントA/B切り替え）"
    expected: "メニュー設定に応じてZoomアカウントA/Bで会議が作成される"
    why_human: "実際のZoom APIとの連携、複数アカウント動作の確認が必要"
  - test: "予約確認メール送信"
    expected: "予約確定時にユーザーと管理者にメールが送信される"
    why_human: "実際のResend APIとメール受信の確認が必要"
  - test: "Googleカレンダーbusy時間反映"
    expected: "管理者カレンダーのイベントが空きスロット計算から除外される"
    why_human: "実際のGoogle Calendar APIとbusy時間取得の確認が必要"
  - test: "キャンセル時の外部API連携"
    expected: "キャンセル時にZoom会議削除、カレンダーイベント削除、メール送信が実行される"
    why_human: "実際の外部API削除処理の動作確認が必要"
  - test: "OAuthトークン自動リフレッシュ"
    expected: "有効期限切れ時にgoogleapis 'tokens'イベントでDB自動更新される"
    why_human: "トークン有効期限切れシナリオの実動作確認が必要"
  - test: "APIレート制限時の指数バックオフ"
    expected: "403/429エラー時にリトライが動作し、最終的にエラーハンドリングされる"
    why_human: "実際のレート制限発生時の動作確認が必要"
---

# Phase 4: 外部API統合 検証レポート

**Phase Goal:** Google Calendar、Zoom、Resendの統合と補償処理の実装
**Verified:** 2026-02-22T21:35:00Z
**Status:** human_needed
**Re-verification:** No — 初回検証

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 予約確定時にメニューに応じたZoomアカウント(A/B)で会議が自動生成される | ✓ VERIFIED | zoom.ts (260行): createZoomMeeting()実装、accountType切り替え、saga.ts line 157で呼び出し、meeting_menus.zoom_accountカラム追加 |
| 2 | 管理者のGoogleカレンダーと同期し、busy時間が空き時間計算に反映される | ✓ VERIFIED | google-calendar.ts: FreeBusy API実装、getCachedBusyTimes()、slots API line 123で使用 |
| 3 | 予約確認メールとキャンセルメールが自動送信される(ユーザー+管理者宛) | ✓ VERIFIED | email.ts: sendBookingConfirmationEmail(), sendBookingCancellationEmail()実装、Promise.allSettledで並列送信 |
| 4 | キャンセル時にZoom会議が削除され、管理者カレンダーからイベントが削除される | ✓ VERIFIED | cancel.ts: deleteZoomMeeting() line 167, deleteCalendarEvent() line 180で呼び出し、retryWithExponentialBackoff適用 |
| 5 | OAuth認証トークンの有効期限切れ時に自動リフレッシュが動作する | ✓ VERIFIED | oauth/google.ts line 70-84: 'tokens'イベントリスナー、自動DB保存実装 |
| 6 | Google Calendar APIレート制限(10 QPS)を超えた場合にエラーハンドリングが動作する | ✓ VERIFIED | retry.ts: retryWithExponentialBackoff実装、403/429エラー時にリトライ、google-calendar.ts line 66, 143, 199で使用 |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260222200001_oauth_tokens.sql` | OAuthトークン暗号化テーブル | ✓ VERIFIED | 3716 bytes, pgcrypto拡張、upsert_oauth_token/get_oauth_token RPC関数 |
| `supabase/migrations/20260222200002_meeting_menus_zoom_account.sql` | meeting_menus.zoom_accountカラム | ✓ VERIFIED | 436 bytes, zoom_account CHAR(1) CHECK (A/B) |
| `src/lib/integrations/oauth/google.ts` | Google OAuth client | ✓ VERIFIED | 188行, getAuthUrl(), getTokensFromCode(), getOAuthClient(), 'tokens'イベント実装 |
| `src/lib/integrations/oauth/tokens.ts` | トークン暗号化・復号化 | ✓ VERIFIED | 142行, saveEncryptedTokens(), getDecryptedTokens(), service_role使用 |
| `src/lib/integrations/google-calendar.ts` | Google Calendar API wrapper | ✓ VERIFIED | 221行, FreeBusy API, Events API, LRUキャッシュ(15分TTL) |
| `src/lib/utils/retry.ts` | 指数バックオフリトライ | ✓ VERIFIED | 105行, retryWithExponentialBackoff(), 403/429対応 |
| `src/app/api/public/slots/route.ts` | 空きスロットAPI拡張 | ✓ VERIFIED | 194行, getCachedBusyTimes()統合 (line 123) |
| `src/app/api/admin/oauth/google/route.ts` | OAuth認証URL取得 | ✓ VERIFIED | 97行, getAuthUrl()呼び出し |
| `src/app/api/admin/oauth/google/callback/route.ts` | OAuthコールバック | ✓ VERIFIED | 57行, getTokensFromCode()呼び出し |
| `src/lib/integrations/zoom.ts` | Zoom Server-to-Server OAuth | ✓ VERIFIED | 260行, createZoomMeeting(), deleteZoomMeeting(), LRUキャッシュ(1時間) |
| `src/lib/integrations/email.ts` | Resend + React Email統合 | ✓ VERIFIED | 237行, sendBookingConfirmationEmail(), sendBookingCancellationEmail() |
| `src/lib/bookings/saga.ts` | 本実装版Saga | ✓ VERIFIED | 599行, Zoom/Calendar/Email統合、補償トランザクション |
| `src/emails/BookingConfirmation.tsx` | 予約確認メールテンプレート | ✓ VERIFIED | 243行, React Email, ユーザー/管理者コピー対応 |
| `src/emails/components/Layout.tsx` | メール共通レイアウト | ✓ VERIFIED | 存在確認済み、共通フッター |
| `src/lib/bookings/cancel.ts` | キャンセルオーケストレーター | ✓ VERIFIED | 255行, cancelBooking()、外部API削除、非ブロッキング処理 |
| `src/emails/BookingCancellation.tsx` | キャンセルメールテンプレート | ✓ VERIFIED | 170行, React Email |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| google-calendar.ts | oauth/google.ts | getOAuthClient() | ✓ WIRED | line 44でgetOAuthClient()呼び出し |
| slots API | google-calendar.ts | getCachedBusyTimes() | ✓ WIRED | route.ts line 123でgetCachedBusyTimes()使用 |
| oauth/google.ts | oauth/tokens.ts | saveEncryptedTokens() | ✓ WIRED | line 79でsaveEncryptedTokens()呼び出し |
| saga.ts | zoom.ts | createZoomMeeting() | ✓ WIRED | line 157でcreateZoomMeeting()呼び出し |
| saga.ts | google-calendar.ts | addCalendarEvent() | ✓ WIRED | line 184でaddCalendarEvent()呼び出し |
| saga.ts | email.ts | sendBookingConfirmationEmail() | ✓ WIRED | line 238でsendBookingConfirmationEmail()呼び出し |
| email.ts | BookingConfirmation.tsx | React Email template | ✓ WIRED | line 7でimport、line 104でレンダリング |
| cancel.ts | zoom.ts | deleteZoomMeeting() | ✓ WIRED | line 167でdeleteZoomMeeting()呼び出し |
| cancel.ts | google-calendar.ts | deleteCalendarEvent() | ✓ WIRED | line 180でdeleteCalendarEvent()呼び出し |
| cancel.ts | email.ts | sendBookingCancellationEmail() | ✓ WIRED | line 231でsendBookingCancellationEmail()呼び出し |
| api/bookings/[id]/route.ts | cancel.ts | cancelBooking() | ✓ WIRED | line 102でcancelBooking()呼び出し |
| api/guest/cancel/[token]/route.ts | cancel.ts | cancelBooking() | ✓ WIRED | line 71でcancelBooking()呼び出し |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SYS-02 | 04-02 | システムは予約確定時にZoom会議を自動生成する（メニューに応じてアカウントA/B使い分け） | ✓ SATISFIED | zoom.ts: createZoomMeeting()実装、saga.ts統合、meeting_menus.zoom_accountカラム |
| SYS-03 | 04-03 | システムはキャンセル時にZoom会議を削除する | ✓ SATISFIED | zoom.ts: deleteZoomMeeting()実装、cancel.ts統合 |
| SYS-04 | 04-02 | システムは予約確認メールを送信する（ユーザー+管理者宛） | ✓ SATISFIED | email.ts: sendBookingConfirmationEmail()実装、BookingConfirmation.tsx |
| SYS-06 | 04-03 | システムはキャンセル時にキャンセルメールを送信する | ✓ SATISFIED | email.ts: sendBookingCancellationEmail()実装、BookingCancellation.tsx |
| SYS-07 | 04-02, 04-03 | システムは予約時に管理者カレンダーにイベント追加、キャンセル時に削除する | ✓ SATISFIED | google-calendar.ts: addCalendarEvent(), deleteCalendarEvent()実装、saga.ts/cancel.ts統合 |
| ADMIN-02 | 04-01 | 管理者はGoogleカレンダーと同期して空き時間を自動反映できる | ✓ SATISFIED | google-calendar.ts: FreeBusy API実装、getCachedBusyTimes()、slots API統合 |

**Requirements Summary:** 6/6 (100%) Phase 4要件を満たす実装が存在

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | - | - | - |

**Anti-patterns:** なし - TODO/FIXME/placeholderコメントなし、空実装は環境変数未設定時のフォールバックのみ

### Human Verification Required

#### 1. Google OAuth認証フロー

**Test:**
1. 管理者として`GET /api/admin/oauth/google`にアクセス
2. 返却された認証URLでGoogleアカウント認証
3. コールバック後、oauth_tokensテーブルにトークンが保存されることを確認
4. `getOAuthClient()`でトークンが復号化されてクライアントに設定されることを確認

**Expected:** 認証後、oauth_tokensテーブルにgoogle providerの暗号化トークンが保存される。access_token, refresh_token, expiry_dateがすべて正しく保存される。

**Why human:** 実際のGoogle OAuth consent画面、トークン取得、DB保存の動作確認が必要。暗号化・復号化が正しく機能するかも含めて実際の認証フローが必要。

---

#### 2. Zoom会議作成（アカウントA/B切り替え）

**Test:**
1. 環境変数にZOOM_ACCOUNT_A/B_ID, CLIENT_ID, CLIENT_SECRETを設定
2. meeting_menusでzoom_account='A'のメニューで予約作成
3. meeting_menusでzoom_account='B'のメニューで予約作成
4. 各Zoomアカウントのダッシュボードで会議が作成されていることを確認
5. bookingsテーブルのzoom_meeting_id, zoom_join_url, zoom_start_urlが正しく保存されることを確認

**Expected:** メニュー設定に応じて、異なるZoomアカウントで会議が作成される。LRUキャッシュによりトークンが~1時間キャッシュされ、API呼び出しが削減される。

**Why human:** 実際のZoom Server-to-Server OAuth、会議作成API、複数アカウント切り替えの動作確認が必要。

---

#### 3. 予約確認メール送信

**Test:**
1. 環境変数にRESEND_API_KEY, FROM_EMAIL, ADMIN_EMAILを設定
2. 予約作成を実行
3. ユーザーと管理者のメールボックスを確認
4. メール内容（セッション名、日時、Zoomリンク、キャンセルURL、Googleカレンダーリンク）が正しく表示されることを確認
5. 管理者コピーではキャンセルURLが非表示になることを確認

**Expected:** 予約確定時に、ユーザーと管理者にBookingConfirmationテンプレートでメールが送信される。メール送信失敗しても予約は成功する（非ブロッキング）。

**Why human:** 実際のResend API、メール受信、React Emailテンプレートレンダリングの確認が必要。

---

#### 4. Googleカレンダーbusy時間反映

**Test:**
1. OAuth認証完了後、管理者カレンダーに手動でイベントを追加
2. `GET /api/public/slots?date=<イベント日>`にアクセス
3. イベント時間帯がスロット一覧から除外されることを確認
4. 15分以内に再度同じAPIを呼び出し、キャッシュから返却されることをログで確認

**Expected:** FreeBusy APIで取得したbusy時間が空きスロット計算から除外される。15分間キャッシュされ、API呼び出しが削減される。

**Why human:** 実際のGoogle Calendar API、FreeBusy取得、スロット計算、キャッシュ動作の確認が必要。

---

#### 5. キャンセル時の外部API連携

**Test:**
1. 予約作成でZoom会議、Googleカレンダーイベント、確認メールが正常に作成されることを確認
2. 会員としてキャンセルAPIを実行
3. Zoomダッシュボードで会議が削除されていることを確認
4. Googleカレンダーでイベントが削除されていることを確認
5. ユーザーと管理者にキャンセルメールが送信されることを確認
6. bookingsテーブルでstatus='canceled'になることを確認
7. 会員の場合、ポイントが返還されることを確認
8. ゲストキャンセルでも同様の動作を確認

**Expected:** キャンセル時にZoom会議削除、カレンダーイベント削除、キャンセルメール送信が実行される。外部API削除失敗時もキャンセルは成功する（非ブロッキング）。

**Why human:** 実際の外部API削除処理、非ブロッキング動作、エラーハンドリングの確認が必要。

---

#### 6. OAuthトークン自動リフレッシュ

**Test:**
1. OAuth認証後、oauth_tokensのexpiry_dateを現在時刻 - 1時間に更新（強制的に期限切れ）
2. Google Calendar APIを呼び出す操作（空きスロット取得など）を実行
3. googleapis 'tokens'イベントが発火することをログで確認
4. oauth_tokensテーブルの新しいaccess_tokenとexpiry_dateが自動更新されることを確認

**Expected:** 有効期限切れ時、googleapisライブラリが自動的にトークンをリフレッシュし、'tokens'イベントでDB更新される。

**Why human:** トークン有効期限切れシナリオの実動作確認が必要。googleapisの自動リフレッシュ機能との連携確認。

---

#### 7. APIレート制限時の指数バックオフ

**Test:**
1. 短時間に大量のGoogle Calendar API呼び出しを実行（10 QPSを超える）
2. 403または429エラーが発生することを確認
3. retryWithExponentialBackoff()によるリトライ動作をログで確認
4. 最大3回リトライ後、エラーが返却されることを確認
5. 指数バックオフ + jitterによる待機時間が正しく計算されることを確認

**Expected:** 403/429エラー時にリトライが動作し、指数バックオフで待機時間が増加する。最大3回リトライ後、最終的にエラーハンドリングされる。

**Why human:** 実際のレート制限発生、リトライ動作、指数バックオフの動作確認が必要。

---

### Phase Goal Assessment

**Goal:** Google Calendar、Zoom、Resendの統合と補償処理の実装

**Assessment:** ✓ ACHIEVED (コードレベル)

Phase 4のゴールは**コードレベルで完全に達成**されています:

- **Google Calendar統合:** OAuth認証、FreeBusy API、Events API、トークン自動リフレッシュ、LRUキャッシュ、指数バックオフリトライが完全実装
- **Zoom統合:** Server-to-Server OAuth、複数アカウント対応、会議作成・削除、LRUキャッシュが完全実装
- **Resend統合:** React Emailテンプレート、予約確認メール、キャンセルメール、並列送信が完全実装
- **補償処理:** Sagaパターンでの外部API統合、補償トランザクション、非ブロッキング処理が完全実装

すべてのartifact (16個) が存在し、key links (12個) が配線され、requirements (6個) が実装されています。Anti-patternsはなく、コード品質は高水準です。

**ただし、実際の外部サービス連携動作は環境変数設定と人間による検証が必要です。**

---

**Verified:** 2026-02-22T21:35:00Z
**Verifier:** Claude (gsd-verifier)
