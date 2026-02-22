---
phase: 02-authentication-booking-core
plan: 02
subsystem: booking-flow
tags: [saga, idempotency, booking, points, ui]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: consume_points, refund_points stored procedures, bookings table
  - phase: 02-authentication-booking-core
    plan: 01
    provides: Supabase Auth, SSR clients, middleware
provides:
  - idempotency_keys table for duplicate prevention
  - Saga orchestrator (createBookingSaga)
  - POST /api/bookings with idempotency support
  - Booking flow UI (menu select -> slot pick -> confirm)
  - PointBalance component (header + dashboard)
  - Header component with point display
affects: [02-03-booking-management, 03-guest-booking, 04-external-integrations]

# Tech tracking
tech-stack:
  added:
    - "nanoid (idempotency key generation)"
  patterns:
    - "Saga pattern with compensation transactions"
    - "Idempotency key with SHA-256 request hash"
    - "Client Component for booking flow (multi-step state)"
    - "Server Component for dashboard (data fetching)"

key-files:
  created:
    - supabase/migrations/20260222100001_idempotency_keys.sql
    - src/lib/utils/idempotency.ts
    - src/lib/bookings/types.ts
    - src/lib/bookings/saga.ts
    - src/lib/integrations/zoom.ts
    - src/lib/integrations/google-calendar.ts
    - src/lib/integrations/email.ts
    - src/app/api/bookings/route.ts
    - src/app/(member)/bookings/new/page.tsx
    - src/app/(member)/bookings/confirm/page.tsx
    - src/app/(member)/dashboard/SuccessMessage.tsx
    - src/components/bookings/MenuSelect.tsx
    - src/components/bookings/SlotPicker.tsx
    - src/components/bookings/BookingConfirm.tsx
    - src/components/dashboard/PointBalance.tsx
    - src/components/layout/Header.tsx
  modified:
    - src/app/(member)/layout.tsx
    - src/app/(member)/dashboard/page.tsx
    - src/types/database.ts

key-decisions:
  - "Sagaパターンで予約作成: 8ステップ（メニュー検証、スロット確認、ポイント消費、予約作成、Zoom作成、Calendar追加、確認、メール送信）"
  - "冪等性キーはIdempotency-Keyヘッダーから取得、なければnanoidで自動生成"
  - "外部API（Zoom, Calendar, Email）はPhase 4/5まではモック実装"
  - "メニュー選択→スロット選択→確認の3ステップフロー（CONTEXT.md決定に従う）"

patterns-established:
  - "Saga compensation: 各ステップに補償処理を定義、失敗時は逆順で実行"
  - "Lock conflict retry: PostgreSQL 55P03エラー時に指数バックオフリトライ（最大3回）"
  - "Idempotency: リクエストボディのSHA-256ハッシュで同一リクエスト検出"

requirements-completed:
  - MEMBER-02
  - MEMBER-03

# Metrics
duration: 11min
completed: 2026-02-22
---

# Phase 2 Plan 02: 予約作成フロー Summary

**Sagaパターンによる予約作成フロー: メニュー選択→スロット選択→確認→ポイント消費→予約確定、失敗時は自動補償でポイント返還**

## Performance

- **Duration:** 約11分
- **Started:** 2026-02-22T09:20:42Z
- **Completed:** 2026-02-22T09:31:48Z
- **Tasks:** 3
- **Files created:** 17
- **Files modified:** 3

## Accomplishments

- idempotency_keysテーブルとユーティリティ実装（SHA-256ハッシュによる重複検出）
- Sagaオーケストレーター実装（8ステップ、補償トランザクション付き）
- モック外部API（Zoom, Google Calendar, Email）Phase 4/5で本実装予定
- 予約作成API（POST /api/bookings）冪等性キー対応
- 予約フローUI（メニュー選択→週表示カレンダー→確認画面）
- PointBalanceコンポーネント（ヘッダー簡易版+ダッシュボード詳細版）
- Headerコンポーネント（ポイント残高表示、ログアウト）
- ダッシュボードページ（ポイント残高、クイックアクション、予約概要）

## Task Commits

Each task was committed atomically:

1. **Task 1: 冪等性キーテーブルとユーティリティ** - `5f83d2a` (feat)
2. **Task 2: Sagaオーケストレーターとモック統合** - `b8d3347` (feat)
3. **Task 3: 予約作成APIと予約フローUI** - `7cec6b1` (feat)

## Files Created/Modified

### Migration
- `supabase/migrations/20260222100001_idempotency_keys.sql` - 冪等性キーテーブル

### Utilities
- `src/lib/utils/idempotency.ts` - checkIdempotencyKey, saveIdempotencyKey, hashRequest
- `src/lib/bookings/types.ts` - BookingRequest, BookingResponse, SagaContext
- `src/lib/bookings/saga.ts` - createBookingSaga with compensation

### Mock Integrations (Phase 4/5で本実装に置換)
- `src/lib/integrations/zoom.ts` - createZoomMeeting, deleteZoomMeeting
- `src/lib/integrations/google-calendar.ts` - addCalendarEvent, deleteCalendarEvent
- `src/lib/integrations/email.ts` - sendBookingConfirmationEmail

### API
- `src/app/api/bookings/route.ts` - POST (create), GET (list)

### Pages
- `src/app/(member)/bookings/new/page.tsx` - メニュー選択+スロット選択
- `src/app/(member)/bookings/confirm/page.tsx` - 確認画面
- `src/app/(member)/dashboard/page.tsx` - ダッシュボード
- `src/app/(member)/dashboard/SuccessMessage.tsx` - 予約成功メッセージ

### Components
- `src/components/bookings/MenuSelect.tsx` - メニュー選択カード
- `src/components/bookings/SlotPicker.tsx` - 週表示カレンダー
- `src/components/bookings/BookingConfirm.tsx` - 確認カード
- `src/components/dashboard/PointBalance.tsx` - ポイント残高表示
- `src/components/layout/Header.tsx` - ヘッダー（ポイント+ログアウト）

### Modified
- `src/app/(member)/layout.tsx` - Header追加
- `src/types/database.ts` - idempotency_keys型追加

## Decisions Made

1. **Sagaステップ順序**: メニュー検証→スロット確認→ポイント消費→予約作成→Zoom→Calendar→確認→メール
2. **補償トランザクション**: 逆順実行（Calendar削除→Zoom削除→予約キャンセル→ポイント返還）
3. **冪等性キー有効期限**: 24時間（マイグレーションでデフォルト設定）
4. **予約ステータス**: DBスキーマに'pending'がないため、直接'confirmed'で作成

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Supabase型推論問題**
- **Found during:** 全タスク
- **Issue:** Database型でテーブルが'never'として推論される問題
- **Fix:** eslint-disable + anyキャストでワークアラウンド
- **Files modified:** saga.ts, dashboard/page.tsx, layout.tsx等
- **Note:** 型定義は正しいが、@supabase/supabase-jsの型推論制限

---

**Total deviations:** 1 auto-fixed (type workaround)
**Impact on plan:** なし。機能は正常に動作。

## Saga Flow Diagram

```
[Client] メニュー選択 → スロット選択 → 確認画面 → POST /api/bookings

[API]
  1. 認証チェック
  2. member_plan取得
  3. 冪等性キーチェック
  4. createBookingSaga()
     ├─ Step 1: メニュー検証
     ├─ Step 2: スロット空き確認
     ├─ Step 3: ポイント消費 (consume_points)
     ├─ Step 4: 予約レコード作成
     ├─ Step 5: Zoom会議作成 (MOCK)
     ├─ Step 6: Calendar追加 (MOCK)
     ├─ Step 7: 予約確定
     └─ Step 8: メール送信 (MOCK, 失敗しても継続)
  5. 冪等性キー保存
  6. レスポンス返却

[On Failure]
  → 逆順補償: Calendar削除 → Zoom削除 → 予約キャンセル → ポイント返還
```

## Next Phase Readiness

- 予約作成フロー完成、予約一覧・詳細・キャンセル（Plan 02-03）の準備完了
- 外部API統合（Zoom, Calendar, Email）はPhase 4/5で本実装に置換
- consume_points/refund_pointsのリトライロジック実装済み

## Self-Check: PASSED

All files verified:
- supabase/migrations/20260222100001_idempotency_keys.sql - FOUND
- src/lib/utils/idempotency.ts - FOUND
- src/lib/bookings/saga.ts - FOUND
- src/lib/bookings/types.ts - FOUND
- src/lib/integrations/zoom.ts - FOUND
- src/lib/integrations/google-calendar.ts - FOUND
- src/lib/integrations/email.ts - FOUND
- src/app/api/bookings/route.ts - FOUND
- src/app/(member)/bookings/new/page.tsx - FOUND
- src/app/(member)/bookings/confirm/page.tsx - FOUND
- src/components/bookings/MenuSelect.tsx - FOUND
- src/components/bookings/SlotPicker.tsx - FOUND
- src/components/bookings/BookingConfirm.tsx - FOUND
- src/components/dashboard/PointBalance.tsx - FOUND
- src/components/layout/Header.tsx - FOUND

All commits verified:
- 5f83d2a - Task 1
- b8d3347 - Task 2
- 7cec6b1 - Task 3

---
*Phase: 02-authentication-booking-core*
*Completed: 2026-02-22*
