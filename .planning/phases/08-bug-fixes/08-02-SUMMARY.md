---
phase: 08-bug-fixes
plan: "02"
subsystem: ui, email
tags: [jst, timezone, react-email, resend, welcome-email]

# Dependency graph
requires:
  - phase: 08-bug-fixes-01
    provides: BUG-01/BUG-05修正済みの状態
provides:
  - JST時刻表示統一（全画面: ゲスト/会員/管理者）
  - ウェルカムメール機能（WelcomeEmailテンプレート + sendWelcomeEmail関数）
  - UTC/JST変換コーディング規約（docs/rules.md）
affects: [09-e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "timeZone: 'Asia/Tokyo' を全日時フォーマット関数に必須指定"
    - "sendWelcomeEmail: 非ブロッキングで呼び出し（失敗しても会員作成成功）"
    - "React Email テンプレートをsrc/emails/に追加するパターン"

key-files:
  created:
    - src/emails/WelcomeEmail.tsx
    - docs/rules.md
  modified:
    - src/__tests__/lib/integrations/email.test.ts
    - src/lib/integrations/email.ts
    - src/lib/actions/admin/members.ts
    - src/app/(member)/bookings/[id]/page.tsx
    - src/components/bookings/BookingCard.tsx
    - src/app/admin/bookings/columns.tsx
    - src/app/(public)/guest/booking/success/page.tsx
    - src/app/(public)/guest/cancel/[token]/page.tsx

key-decisions:
  - "sendWelcomeEmailは非ブロッキング: 失敗しても会員作成は成功扱い（Resendメール送信ポリシーを踏襲）"
  - "date-fnsのformat()はtimeZone非対応のため日時フォーマットでは使用禁止（YAGNI: date-fns-tz追加せず）"
  - "全日時表示でtimeZone: 'Asia/Tokyo'を必須指定（Vercel環境はUTCで動作するため）"

patterns-established:
  - "JST表示パターン: toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })"
  - "メール送信パターン: isEmailConfigured()チェック → React Emailレンダリング → Resend APIコール"

requirements-completed: [BUG-02, BUG-03, BUG-04]

# Metrics
duration: 40min
completed: 2026-03-15
---

# Phase 8 Plan 02: BUG-02/BUG-03/BUG-04修正 Summary

**全画面JST統一（5ファイル）+ WelcomeEmailテンプレートとsendWelcomeEmail実装 + UTC/JST規約docs/rules.md作成**

## Performance

- **Duration:** 約40分
- **Started:** 2026-03-15T06:30:00Z
- **Completed:** 2026-03-15T07:10:00Z
- **Tasks:** 4（うち1件はcheckpoint:human-verify）
- **Files modified:** 9

## Accomplishments

- BUG-02/BUG-03: 全画面（ゲスト/会員/管理者）の時刻表示をJSTに統一。Vercel（UTC環境）でも正しいJST時刻が表示される
- BUG-04: WelcomeEmailテンプレート新規作成 + sendWelcomeEmail関数実装 + createMember()に非ブロッキング送信を追加
- docs/rules.md: UTC/JST変換コーディング規約を明文化。date-fns使用禁止とtimeZone必須指定を文書化

## Task Commits

各タスクをアトミックにコミット:

1. **Task 1: sendWelcomeEmailテストケース追加（TDD RED）** - `6611181` (test)
2. **Task 2: BUG-04 WelcomeEmailテンプレートとsendWelcomeEmail実装** - `3d33801` (feat)
3. **Task 3: BUG-02/BUG-03 全画面JST時刻表示統一 + docs/rules.md作成** - `1ee96f2` (fix)
4. **Task 4: Vercel preview目視確認（human-verify）** - 承認済み（コミットなし）

## Files Created/Modified

- `src/emails/WelcomeEmail.tsx` - ウェルカムメール用React Emailテンプレート（パスワード設定リンク付き）
- `src/lib/integrations/email.ts` - sendWelcomeEmail関数を追加（SendWelcomeEmailParams型定義含む）
- `src/lib/actions/admin/members.ts` - createMember()にsendWelcomeEmail非ブロッキング呼び出しを追加
- `src/__tests__/lib/integrations/email.test.ts` - sendWelcomeEmailのテストケース4件追加
- `src/app/(member)/bookings/[id]/page.tsx` - formatDateTimeFull()にtimeZone: 'Asia/Tokyo'追加
- `src/components/bookings/BookingCard.tsx` - formatDateTime()にtimeZone: 'Asia/Tokyo'追加
- `src/app/admin/bookings/columns.tsx` - date-fnsのformat()をtoLocaleString(ja-JP, {timeZone: Asia/Tokyo})に書き換え
- `src/app/(public)/guest/booking/success/page.tsx` - toLocaleDateString/toLocaleTimeStringにtimeZoneオプション追加
- `src/app/(public)/guest/cancel/[token]/page.tsx` - toLocaleDateString/toLocaleTimeStringにtimeZoneオプション追加
- `docs/rules.md` - UTC/JST変換規約（NGパターン/OKパターン/Vercel環境説明）

## Decisions Made

- sendWelcomeEmailの非ブロッキング実装: 既存のResendメール送信ポリシー（フェーズ1から「失敗しても予約成功」）を踏襲
- date-fns-tzは追加しない（YAGNI）: toLocaleStringベースの実装で完全にJST対応可能
- WelcomeEmailテンプレート: passwordResetUrlがnullの場合は「管理者にお問い合わせ」フォールバックテキストを表示

## Deviations from Plan

None — プランに記載の通り実行。TDDサイクル（RED→GREEN）も計画通り。

## Issues Encountered

None — 全タスクがスムーズに完了。

## User Setup Required

None — 既存のRESEND_API_KEY設定で動作。追加の環境変数設定不要。

## Next Phase Readiness

- BUG-02/BUG-03/BUG-04の修正完了。Phase 8のバグ修正フェーズ全体が完了
- Phase 9（E2Eテスト導入）の前提条件: Vercel developブランチのDeployment Protection設定確認が必要
- Phase 9の前提条件: `/login`ページにメール/パスワードフォームが存在するか確認が必要

---
*Phase: 08-bug-fixes*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: src/emails/WelcomeEmail.tsx
- FOUND: docs/rules.md
- FOUND: src/lib/integrations/email.ts
- FOUND commit 6611181 (Task 1 - test)
- FOUND commit 3d33801 (Task 2 - feat)
- FOUND commit 1ee96f2 (Task 3 - fix)
