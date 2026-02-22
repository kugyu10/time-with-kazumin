---
phase: 03-guest-booking-experience
plan: 01
subsystem: api, ui
tags: [supabase, rate-limit, lru-cache, validator, guest-booking]

# Dependency graph
requires:
  - phase: 02-core-booking
    provides: bookings table, SlotPicker component
provides:
  - service_role client for RLS bypass
  - guest rate limiting with IP+email composite keys
  - guest booking validation
  - public slots API
  - guest booking API
  - guest booking UI flow
affects: [03-02 (guest confirmation/cancel), 04-external-integrations]

# Tech tracking
tech-stack:
  added: [lru-cache, validator]
  patterns: [lazy initialization for Supabase clients, force-dynamic for SSR pages]

key-files:
  created:
    - src/lib/supabase/service-role.ts
    - src/lib/rate-limit/guest-limiter.ts
    - src/lib/validation/guest.ts
    - src/app/api/public/slots/route.ts
    - src/app/api/guest/bookings/route.ts
    - src/app/(public)/layout.tsx
    - src/app/(public)/guest/booking/page.tsx
    - src/app/(public)/guest/booking/GuestBookingClient.tsx
    - src/app/(public)/guest/booking/success/page.tsx
    - src/components/guest/GuestBookingForm.tsx
  modified: []

key-decisions:
  - "Lazy initialization for Supabase clients to avoid build-time errors"
  - "LRU cache with max 500 entries and 1h TTL for rate limiting"
  - "IP limit 5/hour, IP+email composite limit 3/hour"
  - "force-dynamic export for guest pages to prevent static generation"

patterns-established:
  - "getSupabaseServiceRole(): lazy-init service_role client"
  - "checkGuestRateLimit(): IP+email rate limiting"
  - "validateGuestBooking(): guest input validation"

requirements-completed: [GUEST-01, GUEST-02]

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 03-01: ゲスト予約基盤インフラとUI Summary

**service_roleクライアント、LRUキャッシュベースのレート制限、ゲスト予約API、SlotPicker再利用のゲスト予約UIを実装**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T10:12:42Z
- **Completed:** 2026-02-22T10:19:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- service_roleクライアントでRLSバイパス可能に
- IP+emailベースのレート制限（LRUキャッシュ）で悪意あるアクセス防止
- GET /api/public/slots で空きスロット取得
- POST /api/guest/bookings でゲスト予約作成
- 既存SlotPickerを再利用したゲスト予約フローUI

## Task Commits

Each task was committed atomically:

1. **Task 1: service_roleクライアントとレート制限** - `bb007cc` (feat)
2. **Task 2: バリデーションユーティリティ** - `390a3ab` (feat)
3. **Task 3: ゲスト予約API・UI実装** - `c33d50f` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `src/lib/supabase/service-role.ts` - RLSバイパス用service_roleクライアント（遅延初期化）
- `src/lib/rate-limit/guest-limiter.ts` - LRUキャッシュベースのレート制限
- `src/lib/validation/guest.ts` - ゲスト入力バリデーション
- `src/app/api/public/slots/route.ts` - 空きスロット取得API
- `src/app/api/guest/bookings/route.ts` - ゲスト予約作成API
- `src/app/(public)/layout.tsx` - 認証不要のパブリックレイアウト
- `src/app/(public)/guest/booking/page.tsx` - ゲスト予約ページ
- `src/app/(public)/guest/booking/GuestBookingClient.tsx` - クライアントコンポーネント
- `src/app/(public)/guest/booking/success/page.tsx` - 予約完了ページ
- `src/components/guest/GuestBookingForm.tsx` - ゲスト入力フォーム

## Decisions Made
- **遅延初期化パターン**: ビルド時に環境変数がない場合のエラーを回避するため、Supabaseクライアントを関数呼び出し時に初期化
- **force-dynamic export**: SSRページで環境変数を使用するため静的生成を無効化
- **LRUキャッシュ**: 外部依存なしでインメモリレート制限を実現（max: 500, ttl: 1h）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ビルド時環境変数エラー対応**
- **Found during:** Task 3 (ゲスト予約API・UI実装)
- **Issue:** Supabaseクライアントをモジュールトップレベルで初期化すると、ビルド時に環境変数がなくエラー
- **Fix:** 遅延初期化パターンを適用（getSupabaseServiceRole()、getSupabase()関数）
- **Files modified:** src/lib/supabase/service-role.ts, src/app/api/public/slots/route.ts, src/app/(public)/guest/booking/page.tsx
- **Verification:** npm run build 成功
- **Committed in:** c33d50f

**2. [Rule 3 - Blocking] 静的生成エラー対応**
- **Found during:** Task 3 (ゲスト予約API・UI実装)
- **Issue:** ゲスト予約ページが静的生成されようとして環境変数エラー
- **Fix:** `export const dynamic = "force-dynamic"` を追加
- **Files modified:** src/app/(public)/guest/booking/page.tsx, src/app/(public)/guest/booking/success/page.tsx
- **Verification:** npm run build 成功
- **Committed in:** c33d50f

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Next.jsビルド要件への対応。スコープ外の変更なし。

## Issues Encountered
- TypeScript型エラー: Supabaseクエリ結果の型推論が`never`になる問題 → 明示的な型アサーションで解決

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ゲスト予約基盤完了、03-02（確認メール送信、キャンセル機能）の実装可能
- guest_tokenがbookingsテーブルに保存され、キャンセルリンク生成に使用可能

## Self-Check: PASSED

All 10 created files verified.
All 3 task commits verified: bb007cc, 390a3ab, c33d50f

---
*Phase: 03-guest-booking-experience*
*Completed: 2026-02-22*
