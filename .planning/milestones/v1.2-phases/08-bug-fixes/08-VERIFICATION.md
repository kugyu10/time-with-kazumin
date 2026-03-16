---
phase: 08-bug-fixes
verified: 2026-03-15T15:46:00Z
status: gaps_found
score: 4/5 must-haves verified
re_verification: false
gaps:
  - truth: "全画面（ゲスト/会員/管理者）の時刻表示がJSTで統一されており、UTC表示が一切ない"
    status: partial
    reason: "src/app/(member)/bookings/complete/page.tsx の formatDateTime() に timeZone: 'Asia/Tokyo' が未指定。また src/app/admin/tasks/columns.tsx が date-fns の format() を timeZone 指定なしで使用しており、docs/rules.md の禁止パターンに該当する（ただし tasks は Phase 8 スコープ外の既存ファイル）"
    artifacts:
      - path: "src/app/(member)/bookings/complete/page.tsx"
        issue: "formatDateTime() に timeZone: 'Asia/Tokyo' が指定されていない（Vercel UTC環境では予約完了画面でUTC時刻が表示される）"
    missing:
      - "src/app/(member)/bookings/complete/page.tsx の toLocaleDateString/toLocaleTimeString に timeZone: 'Asia/Tokyo' を追加する"
human_verification:
  - test: "Vercel preview URL で各画面の時刻表示を目視確認"
    expected: "全ての日時表示が JST（例: 14:00）で表示され UTC 表示がないこと"
    why_human: "UIレンダリング結果は Vercel UTC 環境でのみ確認できる。ローカルは JST のため常に正しく見える"
  - test: "管理者画面から会員招待 → ウェルカムメール受信確認"
    expected: "招待した会員のメールボックスにウェルカムメール（件名: 「かずみん時間」へようこそ！）が届き、パスワード設定リンクが含まれていること"
    why_human: "実際のメール送信はVercel環境 + Resend実APIが必要"
  - test: "Googleカレンダーのスロットブロック確認"
    expected: "管理者カレンダーに登録した予定の時間帯が予約スロット一覧に反映されて予約不可になること"
    why_human: "BUG-05はログ強化のみ実施。実際のブロック動作はVercel環境でのみ確認できる"
---

# Phase 8: bug-fixes 検証レポート

**フェーズゴール:** 本番環境で発生している4つのバグを修正し、UTC/JST変換規約をコードに明文化する
**検証日時:** 2026-03-15T15:46:00Z
**ステータス:** gaps_found
**再検証:** No — 初回検証

---

## ゴール達成評価

### Observable Truths（観測可能な真実）

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 予約をキャンセルすると、Zoom側の会議が確実に削除されている | VERIFIED | `cancel.ts` L171: `const zoomAccountType = (booking.meeting_menus?.zoom_account as "A" \| "B") \|\| "A"` で menu_id から zoom_account を取得し `deleteZoomMeetingApi(booking.zoom_meeting_id!, zoomAccountType)` に渡している |
| 2 | 管理者Googleカレンダーに登録した予定がスロット一覧に反映されて予約不可になる | PARTIAL | コードロジックは正しい。`getCachedBusyTimes` に GOOGLE_CALENDAR_ID 診断ログを追加済み（L112）。ただし実際のブロック動作確認は Vercel 環境でのみ可能 |
| 3 | /booking/[id] の予約詳細画面で時刻が JST（例: 14:00）で表示される | VERIFIED | `formatDateTimeFull()` の両 toLocaleDateString/toLocaleTimeString に `timeZone: "Asia/Tokyo"` 追加済み（L60, L65） |
| 4 | 全画面（ゲスト/会員/管理者）の時刻表示が JST で統一されており、UTC 表示が一切ない | FAILED | 5ファイルへの修正は完了しているが `src/app/(member)/bookings/complete/page.tsx` の `formatDateTime()` が未修正。`timeZone: "Asia/Tokyo"` が未指定（Plan 08-02 の修正対象5ファイルには含まれていなかった） |
| 5 | docs/rules.md に UTC/JST 変換のコーディング規約が記載されている | VERIFIED | `docs/rules.md` 存在確認済み。NGパターン（timeZone未指定、date-fns format()）、OKパターン（toLocaleString with Asia/Tokyo）、Vercel環境説明、参照実装が記載されている |
| 6 | 会員を招待して承認すると、その会員にウェルカムメールが届く | VERIFIED | `WelcomeEmail.tsx` 実装済み、`sendWelcomeEmail` が `email.ts` に export済み、`createMember()` が非ブロッキングで呼び出し済み（L247-255） |

**スコア:** 4/5 truths verified（1件 FAILED、1件は人間確認必要）

---

## 必要アーティファクト検証

### Plan 08-01（BUG-01/BUG-05）

| アーティファクト | 期待内容 | 存在 | 実装 | 接続 | 総合 |
|--------------|---------|------|------|------|------|
| `src/lib/bookings/cancel.ts` | Zoom削除でmenu_idからaccount type取得 | FOUND | VERIFIED (`getMenuZoomAccount` パターンはインラインで実装) | WIRED | VERIFIED |
| `src/lib/integrations/google-calendar.ts` | FreeBusy API呼び出しのログ強化 | FOUND | VERIFIED (3箇所のログ追加: L79-80, L86, L112) | N/A | VERIFIED |
| `src/__tests__/lib/integrations/zoom.test.ts` | Zoom削除シナリオのユニットテスト | FOUND | VERIFIED (deleteZoomMeeting describe ブロックに6テスト) | WIRED | VERIFIED |

### Plan 08-02（BUG-02/BUG-03/BUG-04）

| アーティファクト | 期待内容 | 存在 | 実装 | 接続 | 総合 |
|--------------|---------|------|------|------|------|
| `src/emails/WelcomeEmail.tsx` | ウェルカムメールReact Emailテンプレート | FOUND | VERIFIED (WelcomeEmail コンポーネント、passwordResetUrl null対応済み) | WIRED (email.ts でインポート使用) | VERIFIED |
| `src/lib/integrations/email.ts` | sendWelcomeEmail関数 | FOUND | VERIFIED (SendWelcomeEmailParams型定義、isEmailConfigured()チェック、Resend API呼び出し) | WIRED | VERIFIED |
| `src/lib/actions/admin/members.ts` | createMember()でウェルカムメール送信 | FOUND | VERIFIED (非ブロッキング try/catch で sendWelcomeEmail 呼び出し L247-255) | WIRED | VERIFIED |
| `docs/rules.md` | UTC/JST変換コーディング規約 | FOUND | VERIFIED (Asia/Tokyo記述、NGパターン/OKパターン/禁止事項/参照実装すべて記載) | N/A | VERIFIED |

---

## キーリンク検証

### Plan 08-01

| From | To | Via | Status | 証拠 |
|------|-----|-----|--------|------|
| `src/lib/bookings/cancel.ts` | `src/lib/integrations/zoom.ts` | `deleteZoomMeeting(id, accountType)` | WIRED | L173: `deleteZoomMeetingApi(booking.zoom_meeting_id!, zoomAccountType)` |
| `src/lib/integrations/google-calendar.ts` | FreeBusy API | `getCalendarClient + freebusy.query` | WIRED | L66-74: `calendar.freebusy.query({...})` + L112: `getCachedBusyTimes` ログ |

### Plan 08-02

| From | To | Via | Status | 証拠 |
|------|-----|-----|--------|------|
| `src/lib/actions/admin/members.ts` | `src/lib/integrations/email.ts` | `sendWelcomeEmail()` | WIRED | L7: `import { sendWelcomeEmail }` + L248: `await sendWelcomeEmail({...})` |
| `src/app/(member)/bookings/[id]/page.tsx` | JST表示 | `toLocaleDateString with timeZone: Asia/Tokyo` | WIRED | L60, L65: `timeZone: "Asia/Tokyo"` 両箇所に指定済み |

---

## 要件カバレッジ

| 要件ID | ソースプラン | 説明 | ステータス | 証拠 |
|--------|------------|------|----------|------|
| BUG-01 | Plan 08-01 | キャンセル時にZoom側の会議が確実に削除される | SATISFIED | `cancel.ts` が `meeting_menus.zoom_account` から `zoomAccountType` を取得して `deleteZoomMeeting` に渡している |
| BUG-02 | Plan 08-02 | `/booking/[id]` の予約詳細画面の時刻がJSTで表示される | SATISFIED | `formatDateTimeFull()` に `timeZone: "Asia/Tokyo"` 追加済み |
| BUG-03 | Plan 08-02 | 全画面でJST表示を統一し、UTC/JST変換コード規約を `docs/rules.md` に明文化する | PARTIAL | 修正対象5ファイルは完了。ただし `src/app/(member)/bookings/complete/page.tsx` が未修正（Plan のスコープ外だったが「全画面統一」要件に照らして漏れに該当する） |
| BUG-04 | Plan 08-02 | 会員招待完了後にウェルカムメールが送信される | SATISFIED | WelcomeEmail.tsx 実装、sendWelcomeEmail 実装、createMember() への組み込み完了。テスト107件全通過 |
| BUG-05 | Plan 08-01 | 管理者Googleカレンダーの予定がスロットに正確にブロックされる | NEEDS HUMAN | コードロジックは正しい。診断ログ追加済み。実際のブロック動作確認は Vercel 環境必要 |

### 孤立要件

なし — REQUIREMENTS.md の Phase 8 に割り当てられた全5要件（BUG-01〜05）が両プランに記載されており、漏れなし。

---

## アンチパターン検出

### 対象ファイルスキャン結果

| ファイル | パターン | 重大度 | 影響 |
|--------|---------|-------|------|
| `src/app/(member)/bookings/complete/page.tsx` | `timeZone` 未指定の toLocaleDateString/toLocaleTimeString（L57-66） | BLOCKER | Vercel UTC 環境で予約完了後の時刻表示がUTCになる（BUG-03 の漏れ） |
| `src/app/admin/tasks/columns.tsx` | `date-fns format()` を timeZone 指定なしで使用（L48, L51）— docs/rules.md の禁止パターン | WARNING | 管理タスクログの時刻がUTC表示になる可能性あり。ただし Phase 8 スコープ外の既存ファイル |

### コミット検証

| コミット | 存在確認 | 内容 |
|--------|---------|------|
| `267d189` | FOUND | test(08-01): add deleteZoomMeeting test cases |
| `ddac1f8` | FOUND | fix(08-01): BUG-01 Zoom削除accountType修正 |
| `3945f2d` | FOUND | fix(08-01): BUG-05 Googleカレンダー診断ログ追加 |
| `6611181` | FOUND | test(08-02): add failing tests for sendWelcomeEmail |
| `3d33801` | FOUND | feat(08-02): implement BUG-04 welcome email |
| `1ee96f2` | FOUND | fix(08-02): fix BUG-02/BUG-03 JST timezone display |

全コミットが存在確認済み。

---

## テスト結果

```
Test Files: 11 passed (11)
Tests:      107 passed (107)
Duration:   2.33s
```

全107テストがパス。

---

## 人間による確認が必要な項目

### 1. Vercel preview 画面の JST 時刻確認

**テスト内容:** Vercel preview URL（develop ブランチ）にアクセスして各画面を確認する
**期待結果:**
- `/booking/[id]` — 時刻がJSTで表示（例: 14:00）
- `/guest/booking/success` — 時刻がJSTで表示
- `/admin/bookings` — 時刻がJSTで表示
- `/bookings/complete` — 時刻がJSTで表示（現在 **UNVERIFIED** — timeZone未指定のため失敗する可能性あり）

**人間が必要な理由:** UIレンダリング結果はVercel UTC環境でのみ確認できる。ローカルはJSTのため常に正しく見える

### 2. ウェルカムメール受信確認

**テスト内容:** 管理画面（/admin/members）から新規会員を招待し、招待したメールアドレスのメールボックスを確認
**期待結果:** 件名「「かずみん時間」へようこそ！」のメールが届き、パスワード設定ボタン（1時間有効）が含まれている
**人間が必要な理由:** 実際のメール送信は Vercel 環境 + Resend 実 API が必要

### 3. Googleカレンダースロットブロック動作確認

**テスト内容:** 管理者カレンダーに予定を登録し、予約スロット一覧でその時間帯が予約不可になるか確認
**期待結果:** 管理者カレンダーの予定時間帯がスロット一覧に反映されて予約不可になる
**人間が必要な理由:** BUG-05はログ強化のみ実施。実際のブロック動作はVercel環境でGOOGLE_CALENDAR_IDとOAuth設定確認が必要

---

## ギャップ要約

**1件のブロッカーが見つかりました:**

BUG-03（全画面JST統一）において、`src/app/(member)/bookings/complete/page.tsx`（会員予約完了ページ）の `formatDateTime()` 関数に `timeZone: "Asia/Tokyo"` が未指定です。

- Plan 08-02 に記載された5ファイルへの修正は完了しています
- しかし RESEARCH 段階で特定した「影響ファイル5箇所」に `complete/page.tsx` が含まれていなかったため、修正から漏れました
- このファイルは Vercel（UTC環境）で予約完了後の時刻をUTCで表示します
- BUG-03 の要件「全画面でJST表示を統一」を達成するには、このファイルへの修正も必要です

**なお、以下は Phase 8 スコープ外の既存課題として記録します（ブロッカー非該当）:**

- `src/app/admin/tasks/columns.tsx`: date-fns の `format()` を timeZone 未指定で使用（Phase 8 以前から存在）
- BUG-05: コードロジックは正しい。Vercel本番デプロイ後のログ確認が必要

---

_検証日時: 2026-03-15T15:46:00Z_
_検証者: Claude (gsd-verifier)_
