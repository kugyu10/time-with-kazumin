---
phase: 03-guest-booking-experience
plan: 02
subsystem: api, ui
tags: [jwt, jose, google-calendar, cancel-token, guest-booking]

# Dependency graph
requires:
  - phase: 03-01
    provides: service_role client, guest booking API
provides:
  - JWT cancel token generation/verification
  - Google Calendar URL generation
  - Guest cancel API endpoint
  - Enhanced booking success page with calendar button
  - Guest cancel confirmation page
affects: [04-external-integrations (email integration)]

# Tech tracking
tech-stack:
  added: [jose]
  patterns: [JWT cancel token with 7-day expiry, lazy secret initialization]

key-files:
  created:
    - src/lib/tokens/cancel-token.ts
    - src/lib/calendar/url-generator.ts
    - src/app/api/guest/cancel/[token]/route.ts
    - src/components/guest/AddToCalendarButton.tsx
    - src/components/guest/CancelConfirmDialog.tsx
    - src/app/(public)/guest/cancel/[token]/page.tsx
    - src/app/(public)/guest/cancel/[token]/CancelPageClient.tsx
  modified:
    - src/app/api/guest/bookings/route.ts
    - src/app/(public)/guest/booking/success/page.tsx
    - src/app/(public)/guest/booking/GuestBookingClient.tsx

key-decisions:
  - "jose for JWT: ESM-native, Edge-compatible"
  - "7-day cancel token expiry: reasonable window for guest cancellation"
  - "Lazy secret initialization: avoid build-time errors"

patterns-established:
  - "generateCancelToken/verifyCancelToken: JWT cancel token pattern"
  - "generateGoogleCalendarUrl: calendar URL generation"

requirements-completed: [GUEST-03, GUEST-04]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 03 Plan 02: キャンセルとカレンダー追加機能 Summary

**JWTキャンセルトークン(jose)によるセキュアなキャンセル機能と、1クリックGoogleカレンダー追加ボタンを実装**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T10:22:21Z
- **Completed:** 2026-02-22T10:26:11Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- JWTキャンセルトークン生成・検証（HS256、7日有効期限）
- Google Calendar URL生成でゲストが1クリックで予約をカレンダー追加可能
- キャンセルAPI（DELETE /api/guest/cancel/[token]）で安全なキャンセル処理
- 予約完了ページにGoogleカレンダー追加ボタンとキャンセルリンク表示
- キャンセルページでトークン検証、状態別エラー表示、キャンセル確認ダイアログ

## Task Commits

Each task was committed atomically:

1. **Task 1: JWTキャンセルトークンとGoogle Calendar URL生成** - `c950e17` (feat)
2. **Task 2: 予約完了ページとキャンセルページ** - `7a2a4f5` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified

- `src/lib/tokens/cancel-token.ts` - JWT cancel token generation/verification
- `src/lib/calendar/url-generator.ts` - Google Calendar URL generator
- `src/app/api/guest/cancel/[token]/route.ts` - Guest cancel API endpoint
- `src/components/guest/AddToCalendarButton.tsx` - Google Calendar add button
- `src/components/guest/CancelConfirmDialog.tsx` - Cancel confirmation dialog
- `src/app/(public)/guest/cancel/[token]/page.tsx` - Cancel page (server)
- `src/app/(public)/guest/cancel/[token]/CancelPageClient.tsx` - Cancel page (client)
- `src/app/api/guest/bookings/route.ts` - Added cancel_token to response
- `src/app/(public)/guest/booking/success/page.tsx` - Enhanced with calendar button and cancel link
- `src/app/(public)/guest/booking/GuestBookingClient.tsx` - Pass cancel_token to success page

## Decisions Made

- **jose for JWT**: ESM-native、Edge-compatible、Next.js 15と互換性あり
- **7日間のキャンセルトークン有効期限**: ゲストが予約後に十分な時間を持ってキャンセル可能
- **遅延シークレット初期化**: ビルド時に環境変数がない場合のエラーを回避

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**JWT_CANCEL_SECRET環境変数を本番環境で設定することを推奨:**
```bash
# .env.local
JWT_CANCEL_SECRET=your-secure-random-secret-here
```

設定しない場合、開発用のデフォルト値が使用されます（警告ログ出力）。

## Next Phase Readiness

- ゲスト予約フロー完了（予約作成、完了表示、カレンダー追加、キャンセル）
- Phase 04: 外部統合（メール送信、Zoom連携、Google Calendar連携）の実装準備完了
- cancel_tokenはメール送信時にキャンセルリンクとして含めることが可能

## Self-Check: PASSED

All 7 created files verified.
All 2 task commits verified: c950e17, 7a2a4f5

---
*Phase: 03-guest-booking-experience*
*Completed: 2026-02-22*
