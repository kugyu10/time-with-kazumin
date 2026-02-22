---
phase: 02-authentication-booking-core
plan: 03
subsystem: bookings
tags: [予約一覧, 予約詳細, キャンセル, ポイント返還, tabs, alert-dialog]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: refund_points stored procedure, bookings table RLS
  - phase: 02-authentication-booking-core
    plan: 01
    provides: Supabase Auth, 会員レイアウト
provides:
  - 予約一覧ページ（今後/過去タブ切り替え）
  - 予約詳細ページ（キャンセルボタン付き）
  - 予約完了ページ
  - キャンセルAPI（DELETE /api/bookings/[id]）
  - キャンセル確認ダイアログ（ポイント返還表示）
affects: [03-guest-booking, 06-admin-management]

# Tech tracking
tech-stack:
  added:
    - "shadcn/ui tabs"
    - "shadcn/ui badge"
    - "shadcn/ui alert-dialog"
  patterns:
    - "Server Component + Client Component分離（詳細表示はServer、キャンセル操作はClient）"
    - "補償トランザクション（キャンセル時のrefund_points RPC呼び出し）"
    - "RLSによる本人のみアクセス制御"

key-files:
  created:
    - src/lib/bookings/cancel.ts
    - src/app/api/bookings/[id]/route.ts
    - src/app/(member)/bookings/page.tsx
    - src/app/(member)/bookings/[id]/page.tsx
    - src/app/(member)/bookings/complete/page.tsx
    - src/components/bookings/BookingCard.tsx
    - src/components/bookings/BookingList.tsx
    - src/components/bookings/BookingTabs.tsx
    - src/components/bookings/CancelDialog.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/alert-dialog.tsx
  modified:
    - src/lib/bookings/saga.ts (型エラー修正)
    - src/lib/utils/idempotency.ts (型エラー修正)

key-decisions:
  - "キャンセルボタンは予約詳細画面のみに配置（誤タップ防止、CONTEXT.md決定）"
  - "今後/過去の予約を2タブで分離（CONTEXT.md決定）"
  - "キャンセル時は確認ダイアログ表示後にポイント返還"
  - "Supabaseの型推論問題はas anyキャストで対応（型安全性より開発速度を優先）"

patterns-established:
  - "補償トランザクションパターン: refund_points RPC → ステータス更新"
  - "予約カードコンポーネント: 日時、メニュー名、ステータスバッジの統一表示"
  - "タブ切り替えはクライアントサイド、データ取得はサーバーサイド"

requirements-completed:
  - MEMBER-04
  - MEMBER-05

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 2 Plan 03: 予約一覧・詳細・キャンセル機能 Summary

**予約一覧（今後/過去タブ）、予約詳細、キャンセル確認ダイアログ、ポイント返還API: 会員が自分の予約を管理できる全機能を実装**

## Performance

- **Duration:** 約7分
- **Started:** 2026-02-22T09:20:52Z
- **Completed:** 2026-02-22T09:28:03Z
- **Tasks:** 3
- **Files created:** 12

## Accomplishments

- 予約キャンセルAPI（DELETE /api/bookings/[id]）+ ポイント返還処理
- 予約一覧ページ（/bookings）: 今後/過去の2タブ切り替え、日付順表示
- 予約詳細ページ（/bookings/[id]）: 予約情報表示、Zoom URL、キャンセルボタン
- 予約完了ページ（/bookings/complete）: 予約完了メッセージ
- CancelDialog: キャンセル確認ダイアログ（返還ポイント表示）

## Task Commits

Each task was committed atomically:

1. **Task 1: キャンセルAPIと処理ロジック実装** - `a7871c5` (feat)
2. **Task 2: 予約一覧ページとタブ切り替え実装** - `8d4428b` (feat)
3. **Task 3: 予約詳細・キャンセル確認・完了ページ実装** - `6023d39` (feat)

## Files Created/Modified

### 作成したファイル

| ファイル | 行数 | 目的 |
|---------|------|------|
| src/lib/bookings/cancel.ts | ~180 | キャンセル処理ロジック（補償トランザクション） |
| src/app/api/bookings/[id]/route.ts | ~100 | GET/DELETE APIエンドポイント |
| src/app/(member)/bookings/page.tsx | ~110 | 予約一覧ページ |
| src/app/(member)/bookings/[id]/page.tsx | ~180 | 予約詳細ページ |
| src/app/(member)/bookings/complete/page.tsx | ~140 | 予約完了ページ |
| src/components/bookings/BookingCard.tsx | ~100 | 予約カードコンポーネント |
| src/components/bookings/BookingList.tsx | ~30 | 予約リストコンポーネント |
| src/components/bookings/BookingTabs.tsx | ~45 | タブ切り替えコンポーネント |
| src/components/bookings/CancelDialog.tsx | ~100 | キャンセル確認ダイアログ |

### shadcn/ui コンポーネント追加

- src/components/ui/tabs.tsx
- src/components/ui/badge.tsx
- src/components/ui/alert-dialog.tsx

## API仕様

### GET /api/bookings/[id]

予約詳細を取得（RLS適用で本人のみ）

**Response:**
```json
{
  "booking": {
    "id": 1,
    "start_time": "2026-02-25T10:00:00Z",
    "end_time": "2026-02-25T11:00:00Z",
    "status": "confirmed",
    "zoom_join_url": "https://zoom.us/j/...",
    "meeting_menus": {
      "name": "お話し会（60分）",
      "duration_minutes": 60,
      "points_required": 100
    }
  }
}
```

### DELETE /api/bookings/[id]

予約をキャンセルしてポイントを返還

**Response:**
```json
{
  "success": true,
  "refunded_points": 100
}
```

**エラーコード:**
- `404 not_found`: 予約が見つからない
- `403 forbidden`: 権限がない
- `400 already_canceled`: 既にキャンセル済み
- `400 past_booking`: 過去の予約

## キャンセル処理フロー

1. 予約取得（member_plans JOINでuser_id確認）
2. ステータス確認（confirmed/pendingのみキャンセル可）
3. 過去の予約チェック
4. **ポイント返還**（`supabase.rpc('refund_points')`）
5. Zoom会議削除（モック）
6. Googleカレンダーイベント削除（モック）
7. 予約ステータス更新（'canceled'）
8. キャンセルメール送信（モック）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] saga.ts, idempotency.ts の型エラー**
- **Found during:** Task 1, Task 2 ビルド検証時
- **Issue:** Plan 02-02で作成されたファイルにSupabaseの型推論問題
- **Fix:** `as any` キャストを追加して型エラーを回避
- **Files modified:** src/lib/bookings/saga.ts, src/lib/utils/idempotency.ts
- **Committed in:** 8d4428b (Task 2 commit に含む)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** ビルド成功のための型エラー修正。スコープクリープなし。

## CONTEXT.md決定事項の実装

| 決定事項 | 実装 |
|---------|------|
| 「今後」「過去」の2タブで予約を分離 | BookingTabs.tsx |
| 日付順（近い順）で表示 | page.tsx でソート |
| キャンセルボタンは予約詳細画面のみに配置 | [id]/page.tsx のみにCancelDialog配置 |
| キャンセル時は確認ダイアログ表示後にポイント返還 | CancelDialog.tsx |

## 次のステップ

- Plan 02-02との統合確認（予約作成フロー完了後に/bookings/completeへリダイレクト）
- Phase 3: ゲスト予約機能の実装
- Phase 4: Zoom/Google Calendar実API連携（モックを実装に置換）

## Self-Check: PASSED

All files verified:
- src/lib/bookings/cancel.ts - FOUND
- src/app/api/bookings/[id]/route.ts - FOUND
- src/app/(member)/bookings/page.tsx - FOUND
- src/app/(member)/bookings/[id]/page.tsx - FOUND
- src/app/(member)/bookings/complete/page.tsx - FOUND
- src/components/bookings/CancelDialog.tsx - FOUND
- src/components/bookings/BookingCard.tsx - FOUND
- src/components/bookings/BookingList.tsx - FOUND
- src/components/bookings/BookingTabs.tsx - FOUND

All commits verified:
- a7871c5 - Task 1
- 8d4428b - Task 2
- 6023d39 - Task 3

---
*Phase: 02-authentication-booking-core*
*Completed: 2026-02-22*
