# Architecture Research

**Domain:** コーチングセッション予約サービス — v1.3 運用改善機能の既存アーキテクチャへの統合
**Researched:** 2026-03-27
**Confidence:** HIGH

## 既存アーキテクチャの概要

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js App Router (Vercel)                 │
├──────────────────┬──────────────────┬──────────────────────────┤
│  (public) Guest  │  (member) Auth   │  /admin Auth             │
│  /guest/booking  │  /dashboard      │  /members /menus         │
│  /api/public/    │  /bookings       │  /plans /schedules       │
│  slots           │                  │  /tasks /dashboard       │
├──────────────────┴──────────────────┴──────────────────────────┤
│                     Server Actions + API Routes                 │
│  src/lib/actions/admin/*.ts  |  src/app/api/public/slots/      │
├─────────────────────────────────────────────────────────────────┤
│                     External Integrations                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Zoom S2S     │  │ Google       │  │ Resend               │  │
│  │ Account A/B  │  │ Calendar API │  │ transactional email  │  │
│  │ LRU token    │  │ FreeBusy API │  │                      │  │
│  │ cache        │  │ 15min cache  │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                  Supabase (PostgreSQL + Edge Functions)         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Tables: profiles, plans, member_plans, meeting_menus,  │   │
│  │          bookings, point_transactions, weekly_schedules, │   │
│  │          task_execution_logs, idempotency_keys           │   │
│  │  RLS: 全テーブルにRow Level Security適用                │   │
│  │  Stored Procedures: consume_points, refund_points,       │   │
│  │          grant_monthly_points, manual_adjust_points      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno) + pg_cron                        │   │
│  │  monthly-point-grant  check-reminder-emails             │   │
│  │  check-thank-you-emails  auto-complete-bookings         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## v1.3 新機能の統合ポイント

### 機能1: Zoomカレンダーブロック (#12)

**統合対象:** `/api/public/slots/route.ts` および `/api/public/slots/week/route.ts`

**現在のデータフロー:**
```
GET /api/public/slots?date=YYYY-MM-DD
  ↓
getCachedBusyTimes() [Google Calendar FreeBusy API, 15分LRUキャッシュ]
  ↓
isSlotBusy() でスロット重複チェック
  ↓
DB bookings テーブルの既存予約チェック
  ↓
available: true/false スロット一覧を返す
```

**変更後のデータフロー:**
```
GET /api/public/slots?date=YYYY-MM-DD
  ↓
getCachedBusyTimes() [Google Calendar] --- 変更なし
  ↓
getZoomScheduledMeetings("A") [新規]  Zoom API: GET /users/me/meetings?type=scheduled
getZoomScheduledMeetings("B") [新規]  既存 getZoomAccessToken() のtoken cache再利用
  ↓ BusyTime[]として正規化
combinedBusyTimes = [...googleBusy, ...zoomBusyA, ...zoomBusyB]
  ↓
isSlotBusy() 既存ロジックをそのまま流用
  ↓
available: true/false スロット一覧
```

**新規コンポーネント:**
- `src/lib/integrations/zoom.ts` に `getZoomScheduledMeetings(accountType)` 関数を追加
  - 既存の `getZoomAccessToken(accountType)` を内部で呼ぶ（token cache再利用）
  - 戻り値は既存の `BusyTime[]` 型 (`{ start: string; end: string }[]`) に変換して返す
  - Zoom API: `GET https://api.zoom.us/v2/users/me/meetings?type=scheduled&page_size=100`
  - キャッシュ: Google Calendarと同じLRU Cache (15分TTL) を追加

**変更対象ファイル:**
- `src/lib/integrations/zoom.ts` — `getZoomScheduledMeetings` 関数を追加 (Modified)
- `src/app/api/public/slots/route.ts` — Zoom busy times マージ処理を追加 (Modified)
- `src/app/api/public/slots/week/route.ts` — 同上（週間ビュー用）(Modified)

---

### 機能2: プランタイプ別メニュー表示 (#10)

**統合対象:** `meeting_menus` テーブル + メニュー取得ロジック + 会員向け予約フロー

**現在のスキーマ:**
```sql
meeting_menus: id, name, duration_minutes, points_required, zoom_account,
               description, is_active, send_thank_you_email
```

**必要なスキーマ変更 (Migration):**
```sql
-- meeting_menus に allowed_plan_types カラムを追加
-- NULLは全プランに表示（既存メニューへの後方互換）
ALTER TABLE meeting_menus
  ADD COLUMN allowed_plan_types INTEGER[] DEFAULT NULL;

-- インデックス（フィルタリング高速化）
CREATE INDEX idx_meeting_menus_allowed_plan_types
  ON meeting_menus USING GIN (allowed_plan_types)
  WHERE allowed_plan_types IS NOT NULL;
```

**データフロー変更:**

会員向け予約 (変更前):
```
会員ログイン → 全is_active=trueメニュー取得 → 表示
```

会員向け予約 (変更後):
```
会員ログイン → member_plans.plan_id を取得
  ↓
meeting_menus を取得:
  WHERE is_active = true
    AND (allowed_plan_types IS NULL           -- 全プラン対象
         OR plan_id = ANY(allowed_plan_types)) -- 当該プランのみ
  ↓
フィルタ済みメニュー表示
```

ゲスト向け予約は変更なし（allowed_plan_types=NULLのメニューのみ表示）。

**変更対象ファイル:**
- `supabase/migrations/YYYYMMDD_add_allowed_plan_types.sql` — **New Migration**
- `src/lib/actions/admin/menus.ts` — `createMenu`/`updateMenu` に `allowed_plan_types` を追加 (Modified)
- `src/app/(member)/bookings/` — メニュー一覧取得クエリにplan_idフィルタ追加 (Modified)
- `src/app/admin/menus/` — 管理画面でプランタイプ選択UIを追加 (Modified)
- `src/types/database.ts` — `meeting_menus` 型に `allowed_plan_types: number[] | null` 追加 (Modified)

---

### 機能3: ポイント溢れ通知メール (#9)

**統合対象:** Edge Functions (Deno) + pg_cron + Resend

**既存パターンとの比較:**
```
monthly-point-grant (毎月1日 pg_cron)
  → grant_monthly_points() RPC
  → task_execution_logs 記録

[新規] point-overflow-notify (毎月20日 pg_cron)
  → 溢れ予定会員クエリ (SELECT)
  → Resend メール送信
  → task_execution_logs 記録
```

**溢れ判定クエリロジック:**
```sql
SELECT
  mp.id,
  mp.user_id,
  mp.current_points,
  mp.monthly_points,
  p.max_points,
  pr.email,
  pr.full_name,
  (mp.current_points + mp.monthly_points) - p.max_points as overflow_amount
FROM member_plans mp
JOIN plans p ON p.id = mp.plan_id
JOIN profiles pr ON pr.id = mp.user_id
WHERE mp.status = 'active'
  AND p.max_points IS NOT NULL
  AND (mp.current_points + mp.monthly_points) > p.max_points
```

**新規コンポーネント:**
- `supabase/functions/point-overflow-notify/index.ts` — **New Edge Function**
  - 既存 `monthly-point-grant/index.ts` のパターンを踏襲
  - 冪等性チェック: `task_execution_logs` で今月20日分が処理済みか確認
  - `task_execution_logs` に記録（既存テーブル流用）

**pg_cron設定 (新規):**
```sql
-- 毎月20日 9:00 JST (= UTC 0:00)
SELECT cron.schedule('point-overflow-notify', '0 0 20 * *', $$...$$);
```

**変更対象ファイル:**
- `supabase/functions/point-overflow-notify/index.ts` — **New**
- `supabase/migrations/YYYYMMDD_pg_cron_overflow_notify.sql` — **New** (pg_cron設定)

---

### 機能4: 会員アクティビティ表示 (#8)

**統合対象:** 管理画面の会員一覧 + ダッシュボード

**必要データ:** 各会員の最終予約日時（`bookings.start_time` の最大値）

スキーマ変更なし。クエリ時に集計（現規模10人では十分）。

**クエリアプローチ:**
```sql
SELECT
  pr.id,
  pr.email,
  pr.full_name,
  mp.current_points,
  p.name as plan_name,
  MAX(b.start_time) as last_booking_at
FROM profiles pr
LEFT JOIN member_plans mp ON mp.user_id = pr.id AND mp.status = 'active'
LEFT JOIN plans p ON p.id = mp.plan_id
LEFT JOIN bookings b ON b.member_plan_id = mp.id AND b.status = 'completed'
WHERE pr.role = 'member'
GROUP BY pr.id, pr.email, pr.full_name, mp.current_points, p.name
ORDER BY pr.created_at DESC
```

**アクティビティ分類ロジック (TypeScript側):**
```typescript
function getActivityStatus(lastBookingAt: string | null): 'active' | 'warning' | 'danger' {
  if (!lastBookingAt) return 'danger'
  const daysSince = differenceInDays(new Date(), new Date(lastBookingAt))
  if (daysSince <= 30) return 'active'
  if (daysSince <= 60) return 'warning'
  return 'danger'
}
```

**変更対象ファイル:**
- `src/lib/actions/admin/members.ts` — `getMembers()` に `last_booking_at` JOIN追加 (Modified)
- `src/app/admin/members/members-client.tsx` — アクティビティバッジ追加 (Modified)
- `src/app/admin/dashboard/page.tsx` — 未訪問会員リストセクション追加 (Modified)

---

## コンポーネント責務一覧

| コンポーネント | 責務 | 通信先 |
|----------------|------|--------|
| `zoom.ts` | Zoom S2S OAuth トークン管理、会議CRUD、スケジュール取得 | Zoom API |
| `google-calendar.ts` | FreeBusy取得、カレンダーイベントCRUD | Google Calendar API |
| `/api/public/slots/route.ts` | スロット空き判定統合 (DB + Google + Zoom) | Supabase, zoom.ts, google-calendar.ts |
| Edge Functions | バッチ処理 (ポイント付与, リマインダー, 通知) | Supabase RPC, Resend |
| Admin Server Actions | 管理者CRUD操作 | Supabase (service_role) |
| Server Components (admin) | 管理画面データフェッチ | Server Actions |

---

## 推奨ビルド順序

依存関係に基づいた実装順序:

```
Phase 1: DBスキーマ変更 (依存なし、最初に行う)
  └── meeting_menus に allowed_plan_types カラム追加 (Migration)

Phase 2: Zoomカレンダーブロック (スキーマ変更不要、独立)
  ├── zoom.ts に getZoomScheduledMeetings() 追加
  └── /api/public/slots/ にZoom busy times統合

Phase 3: プランタイプ別メニュー表示 (Phase 1のMigration完了後)
  ├── menus.ts Server Action に allowed_plan_types フィールド追加
  ├── 管理画面メニューフォームにプランタイプ選択UI
  └── 会員向け予約フローにフィルタ適用

Phase 4: ポイント溢れ通知 (スキーマ変更不要、独立)
  ├── point-overflow-notify Edge Function 作成
  └── pg_cron スケジュール設定

Phase 5: 会員アクティビティ表示 (スキーマ変更不要、独立)
  ├── getMembers() クエリに last_booking_at 追加
  ├── 会員一覧に色分けバッジ追加
  └── 管理ダッシュボードに未訪問リスト追加
```

**Phase 2, 4, 5 は並行実装可能。Phase 3 は Phase 1 完了後に着手。**

---

## データフロー: スロット空き判定の統合後全体像

```
ユーザーが日付を選択
    ↓
GET /api/public/slots?date=YYYY-MM-DD
    ↓
[並列取得]
  ├── getCachedBusyTimes()          Google Calendar FreeBusy (15分LRUキャッシュ)
  ├── getZoomScheduledMeetings("A") Zoom Account A スケジュール (15分LRUキャッシュ) [NEW]
  └── getZoomScheduledMeetings("B") Zoom Account B スケジュール (15分LRUキャッシュ) [NEW]
    ↓
BusyTime[] に正規化してマージ
    ↓
DB bookings テーブルの confirmed/completed 予約を取得
    ↓
30分スロットを生成 (営業時間 - 休憩時間)
    ↓
各スロットに対して isSlotBusy() チェック (バッファ適用)
    ↓
available: true/false スロット一覧をレスポンス
```

---

## アンチパターン

### Zoom スケジュールをcronで事前同期しない

**やりがちなこと:** pg_cronでZoomスケジュールをDBにキャッシュし、スロット計算時はDBを参照
**問題:** 同期ラグ、DBテーブル追加、処理複雑化
**正しいアプローチ:** 既存のGoogle CalendarパターンをZoomにも適用。オンデマンド取得 + 15分LRUキャッシュ。現規模（週3-5件）では十分。

### allowed_plan_types を別テーブルにしない

**やりがちなこと:** `menu_plan_permissions` などの中間テーブルを作る
**問題:** JOINが増える、KISS原則に反する
**正しいアプローチ:** `meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL` のGINインデックス付き配列カラム。NULLで「全プラン対象」、要素で制限。

### ポイント溢れ計算をアプリ側で行わない

**やりがちなこと:** TypeScript側でポイント計算してDBを複数回クエリ
**問題:** 一貫性リスク、パフォーマンス低下
**正しいアプローチ:** 溢れ判定SQLをEdge Function内で1クエリで実行。既存 `grant_monthly_points()` ストアドプロシージャのロジックを参照して数式を揃える。

### アクティビティ用に last_booking_at カラムを profiles に持たない

**やりがちなこと:** `profiles.last_booking_at` を追加してトリガーで更新
**問題:** 重複管理、トリガーの副作用リスク
**正しいアプローチ:** クエリ時に `MAX(bookings.start_time)` で集計。現規模10人では許容コスト。将来スケールする場合はマテリアライズドビューへ移行。

---

## スケーリング考慮事項

| 規模 | アーキテクチャ調整 |
|------|--------------------|
| 現在 (~10人) | オンデマンドAPI取得 + LRUキャッシュ、getMembers()でJOIN集計、Edge Functions |
| ~100人 | Zoomスケジュールのバッチ同期テーブル移行検討、getMembers()にpaginationを追加 |
| ~1000人 | マテリアライズドビューでアクティビティ集計、pg_cron頻度最適化 |

現在の規模では現行アーキテクチャの延長で全機能を実装可能。

---

## 外部統合ポイント

### 既存（変更なし）

| サービス | 統合パターン | 変更 |
|----------|-------------|------|
| Zoom S2S OAuth | `getZoomAccessToken()` + LRU token cache | なし（関数追加のみ） |
| Google Calendar | FreeBusy API + 15分LRUキャッシュ | なし |
| Resend | React Email テンプレート | 新規メールテンプレート追加のみ |
| Supabase RPC | `grant_monthly_points()` など | 変更なし |

### 新規追加

| サービス | 統合パターン | 詳細 |
|----------|-------------|------|
| Zoom Meetings List API | `GET /users/me/meetings?type=scheduled` | zoom.ts に関数追加 |

---

## Sources

- 既存コード: `src/lib/integrations/zoom.ts` (Server-to-Server OAuth実装、LRU token cache)
- 既存コード: `src/lib/integrations/google-calendar.ts` (FreeBusy API, 15分LRUキャッシュ)
- 既存コード: `src/app/api/public/slots/route.ts` (スロット生成・busy時間判定ロジック)
- 既存コード: `supabase/functions/monthly-point-grant/index.ts` (Edge Functionパターン)
- 既存コード: `supabase/migrations/20260222000003_stored_procedures.sql` (ポイント計算ロジック)
- 既存コード: `src/lib/actions/admin/members.ts` (getMembers クエリパターン)
- [Zoom API Reference](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/) (MEDIUM confidence — WebSearch確認)

---

*Architecture research for: Time with Kazumin v1.3 運用改善*
*Researched: 2026-03-27*
