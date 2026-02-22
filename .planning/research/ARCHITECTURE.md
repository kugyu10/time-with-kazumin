# Architecture Research

**Domain:** コーチングセッション予約システム（ポイント管理、カレンダー同期、ビデオ会議統合付き）
**Researched:** 2026-02-22
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Guest Pages  │  │ Member Pages │  │ Admin Pages  │            │
│  │ (SSR/RSC)    │  │ (SSR/RSC)    │  │ (SSR/RSC)    │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Application Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Route        │  │ Server       │  │ Server       │            │
│  │ Handlers     │  │ Actions      │  │ Components   │            │
│  │ (API)        │  │ (Mutations)  │  │ (Reads)      │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Business Logic Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Availability │  │ Booking      │  │ Point        │            │
│  │ Calculator   │  │ Manager      │  │ Manager      │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Integration Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Calendar     │  │ Video        │  │ Email        │            │
│  │ Sync         │  │ Meeting      │  │ Queue        │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ PostgreSQL   │  │ RLS          │  │ Edge         │            │
│  │ (Supabase)   │  │ Policies     │  │ Functions    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└───────────────────────────────────────────────────────────────────┘
         ↕                    ↕                    ↕
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Google       │  │ Zoom         │  │ Resend       │
│ Calendar API │  │ API          │  │ (Email)      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Presentation Layer** | UI表示、ユーザー入力受付 | Next.js App Router (RSC/SSR)、shadcn/ui components |
| **Route Handlers** | 外部APIエンドポイント（予約作成、キャンセル、スロット取得） | Next.js Route Handlers (`app/api/**/route.ts`) |
| **Server Actions** | フォーム送信、mutations | Next.js Server Actions (`use server`) |
| **Server Components** | データフェッチ、初期レンダリング | React Server Components (default in App Router) |
| **Availability Calculator** | 空き時間算出（営業時間、busy時間、既存予約、バッファ考慮） | TypeScript関数、PostgreSQL関数との組み合わせ |
| **Booking Manager** | 予約作成・キャンセルのオーケストレーション（トランザクション管理） | トランザクション処理、補償処理 |
| **Point Manager** | ポイント付与・消費・返還のロジック | PostgreSQL stored procedures（ACID保証） |
| **Calendar Sync** | Googleカレンダーとの同期（busy時間取得、イベント追加・削除） | Google Calendar API wrapper、キャッシュ機構 |
| **Video Meeting** | Zoom会議の作成・削除（アカウント切り替え） | Zoom API wrapper、Server-to-Server OAuth |
| **Email Queue** | メール送信の非同期処理 | Resend API、Edge Functions (cron) |
| **PostgreSQL** | データ永続化、トランザクション、RLS | Supabase PostgreSQL、ACID transactions |
| **Edge Functions** | スケジュールタスク（月次ポイント付与、リマインダー、サンキューメール） | Supabase Edge Functions + pg_cron |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認証画面グループ
│   │   └── login/                # ログインページ
│   ├── (guest)/                  # ゲスト用画面グループ
│   │   ├── page.tsx              # トップページ
│   │   └── booking/              # 予約フロー（ゲスト）
│   ├── (member)/                 # 会員用画面グループ
│   │   ├── dashboard/            # マイページ
│   │   ├── bookings/             # 予約一覧
│   │   └── booking/              # 予約フロー（会員）
│   ├── (admin)/                  # 管理者用画面グループ
│   │   └── admin/                # 管理画面
│   │       ├── dashboard/        # 管理者ダッシュボード
│   │       ├── bookings/         # 予約管理
│   │       ├── members/          # 会員管理
│   │       ├── plans/            # プラン管理
│   │       ├── menus/            # メニュー管理
│   │       └── schedule/         # スケジュール管理
│   └── api/                      # Route Handlers
│       ├── slots/                # 空きスロット取得
│       ├── bookings/             # 予約作成・キャンセル
│       └── webhooks/             # 外部Webhook受信
├── components/                   # Reactコンポーネント
│   ├── ui/                       # shadcn/ui基本コンポーネント
│   ├── booking/                  # 予約関連コンポーネント
│   ├── admin/                    # 管理画面コンポーネント
│   └── layouts/                  # レイアウトコンポーネント
├── lib/                          # ビジネスロジック・ユーティリティ
│   ├── supabase/                 # Supabaseクライアント
│   │   ├── client.ts             # クライアントサイド
│   │   ├── server.ts             # サーバーサイド
│   │   └── admin.ts              # 管理者権限
│   ├── availability/             # 空き時間計算ロジック
│   │   ├── calculator.ts         # 空きスロット算出
│   │   └── buffer.ts             # バッファ計算
│   ├── booking/                  # 予約管理ロジック
│   │   ├── create.ts             # 予約作成オーケストレーション
│   │   ├── cancel.ts             # キャンセル処理
│   │   └── validation.ts         # バリデーション
│   ├── points/                   # ポイント管理
│   │   ├── consume.ts            # ポイント消費
│   │   └── refund.ts             # ポイント返還
│   ├── integrations/             # 外部連携
│   │   ├── google-calendar.ts   # Googleカレンダー
│   │   ├── zoom.ts               # Zoom API
│   │   └── email.ts              # Resend (Email)
│   ├── types/                    # 型定義
│   └── utils/                    # ユーティリティ関数
├── emails/                       # React Emailテンプレート
│   ├── BookingConfirmed.tsx
│   ├── BookingCancelled.tsx
│   ├── Reminder.tsx
│   └── ThankYou.tsx
├── hooks/                        # カスタムReact Hooks
├── supabase/                     # Supabaseマイグレーション・関数
│   ├── migrations/               # DBマイグレーション
│   ├── functions/                # Edge Functions
│   │   ├── monthly-point-grant/  # 月次ポイント付与
│   │   ├── send-reminder/        # リマインダー送信
│   │   └── send-thankyou/        # サンキューメール送信
│   └── seed.sql                  # 初期データ
└── middleware.ts                 # Next.js middleware（認証など）
```

### Structure Rationale

- **(auth)/(guest)/(member)/(admin):** Route Groupsを活用して認証状態とロール別にレイアウトを分離。同じURLパスでも異なる認証要件を持つページを整理
- **lib/integrations/:** 外部API（Google Calendar、Zoom、Email）のラッパーを集約。テストモック化が容易で、API変更の影響範囲を限定
- **lib/availability/:** 空き時間計算の複雑なロジックを分離。営業時間、busy時間、既存予約、バッファを考慮した算出は独立テスト可能に
- **lib/booking/:** 予約作成・キャンセルのオーケストレーション層。複数の外部API呼び出しとトランザクション管理を統合し、補償処理を実装
- **supabase/functions/:** サーバーレス関数として非同期タスク（月次処理、メール送信）を分離。Next.jsのデプロイと独立したスケーリングが可能

## Architectural Patterns

### Pattern 1: Server-First Architecture with Strategic Client Components

**What:** Next.js App Routerのデフォルトはサーバーコンポーネント（RSC）。クライアントコンポーネント（`'use client'`）は必要な箇所のみに限定する。

**When to use:** ほぼすべてのページで使用。特に予約システムではデータの新鮮さとSEOが重要なため、サーバーサイドレンダリングを優先。

**Trade-offs:**
- **Pros:** 初期表示が高速、バンドルサイズ削減、データフェッチがシンプル、SEO対応が自然
- **Cons:** クライアント側のインタラクティブな機能（モーダル、フォームバリデーション）は個別に`'use client'`指定が必要

**Example:**
```typescript
// app/(member)/bookings/page.tsx
// デフォルトでServer Component
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function BookingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .order('start_time', { ascending: true })

  return (
    <div>
      <h1>予約一覧</h1>
      <BookingList bookings={bookings} />
      {/* BookingListはクライアントコンポーネントでもOK（use client） */}
    </div>
  )
}
```

### Pattern 2: PostgreSQL Stored Procedures for Critical Transactions

**What:** ポイント消費・返還などのクリティカルな処理はPostgreSQL関数で実装し、トランザクションとACID保証を活用する。

**When to use:** 残高チェックと更新が同時に必要な場合、複数テーブルの整合性が必須な場合。

**Trade-offs:**
- **Pros:** アトミック性保証、レースコンディション回避、ロジックがDB層に集約
- **Cons:** TypeScriptコードから分離するため、型安全性がやや低下。デバッグにはDB側のログ確認が必要

**Example:**
```sql
-- supabase/migrations/002_point_functions.sql
CREATE OR REPLACE FUNCTION consume_points(
  p_member_plan_id UUID,
  p_points INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- 排他ロックを取得してレースコンディション防止
  SELECT remaining_points INTO current_balance
  FROM member_plans
  WHERE id = p_member_plan_id
  FOR UPDATE;

  -- 残高不足チェック
  IF current_balance < p_points THEN
    RETURN FALSE;
  END IF;

  -- ポイント減算
  UPDATE member_plans
  SET remaining_points = remaining_points - p_points
  WHERE id = p_member_plan_id;

  RETURN TRUE;
END;
$$;
```

```typescript
// lib/points/consume.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function consumePoints(memberPlanId: string, points: number): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('consume_points', {
    p_member_plan_id: memberPlanId,
    p_points: points,
  })

  if (error) throw error
  return data // true = 成功、false = 残高不足
}
```

### Pattern 3: Optimistic Locking for Double Booking Prevention

**What:** 同時予約によるダブルブッキングを防ぐため、予約作成前に再度空き確認を行う。

**When to use:** 予約作成フロー全体。ユーザーがスロット選択してから実際に予約するまでに時間差がある場合。

**Trade-offs:**
- **Pros:** ダブルブッキングを確実に防止、ユーザーに明確なエラーメッセージを返せる
- **Cons:** 予約失敗の可能性があるため、UX設計で再選択フローを用意する必要がある

**Example:**
```typescript
// lib/booking/create.ts
export async function createBooking(params: BookingParams) {
  const supabase = createServerSupabaseClient()

  // 1. トランザクション開始（Supabaseの場合は複数クエリを順次実行）

  // 2. スロット空き確認（再度チェック）
  const isAvailable = await checkSlotAvailability(params.startTime, params.endTime)
  if (!isAvailable) {
    throw new Error('選択したスロットは既に予約されています')
  }

  // 3. ポイント消費（会員の場合）
  if (params.memberId) {
    const consumed = await consumePoints(params.memberPlanId, params.pointCost)
    if (!consumed) {
      throw new Error('ポイント残高が不足しています')
    }
  }

  // 4. Zoom会議作成
  const { joinUrl, meetingId } = await createZoomMeeting(params)

  // 5. Googleカレンダーにイベント追加
  const googleEventId = await addCalendarEvent(params, joinUrl)

  // 6. 予約をDBにINSERT
  const { data: booking } = await supabase
    .from('bookings')
    .insert({
      ...params,
      zoom_meeting_url: joinUrl,
      zoom_meeting_id: meetingId,
      google_event_id: googleEventId,
      status: 'confirmed',
    })
    .select()
    .single()

  // 7. 確認メール送信（非同期、失敗しても予約は成立させる）
  await sendBookingConfirmationEmail(booking).catch(console.error)

  return booking
}
```

### Pattern 4: Compensating Transactions for Rollback

**What:** 外部API呼び出し（Zoom、Google Calendar）が失敗した場合、既に実行した処理を補償トランザクションで巻き戻す。

**When to use:** 予約作成・キャンセルのような複数ステップのオーケストレーション処理。

**Trade-offs:**
- **Pros:** 整合性を保ちながら外部API統合が可能、エラー時の状態が予測可能
- **Cons:** 実装が複雑化、補償処理自体が失敗する可能性もあるため、ログとモニタリングが必須

**Example:**
```typescript
// lib/booking/create.ts (補償処理付き)
export async function createBooking(params: BookingParams) {
  let pointsConsumed = false
  let zoomMeetingCreated = false
  let calendarEventCreated = false

  try {
    // ステップ1: ポイント消費
    if (params.memberId) {
      const consumed = await consumePoints(params.memberPlanId, params.pointCost)
      if (!consumed) throw new Error('ポイント不足')
      pointsConsumed = true
    }

    // ステップ2: Zoom会議作成
    const { joinUrl, meetingId } = await createZoomMeeting(params)
    zoomMeetingCreated = true

    // ステップ3: Googleカレンダーイベント作成
    const googleEventId = await addCalendarEvent(params, joinUrl)
    calendarEventCreated = true

    // ステップ4: DB保存
    const { data: booking } = await supabase.from('bookings').insert({ ... })

    return booking

  } catch (error) {
    // 補償トランザクション（巻き戻し）
    if (calendarEventCreated) {
      await deleteCalendarEvent(googleEventId).catch(console.error)
    }
    if (zoomMeetingCreated) {
      await deleteZoomMeeting(meetingId, zoomAccountKey).catch(console.error)
    }
    if (pointsConsumed) {
      await refundPoints(params.memberPlanId, params.pointCost).catch(console.error)
    }

    throw error // エラーを再スロー
  }
}
```

### Pattern 5: On-Demand Calendar Sync with Cache

**What:** Googleカレンダーの同期はリアルタイムではなく、オンデマンド（ユーザーが予約ページを開いたとき）に実行。15分間キャッシュして無駄なAPI呼び出しを削減。

**When to use:** 現規模（週3〜5件予約）では十分。ユーザー数が増えたら（100人超）、cron式のバッチ同期に切り替え。

**Trade-offs:**
- **Pros:** 実装がシンプル、API呼び出し数を抑制、無料枠で運用可能
- **Cons:** 最大15分の遅延が発生する可能性、複数ユーザーが同時にアクセスすると同期が複数回走る（並行制御が必要）

**Example:**
```typescript
// lib/integrations/google-calendar.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'

const CACHE_DURATION_MS = 15 * 60 * 1000 // 15分

export async function syncCalendar(date: string): Promise<BusyTime[]> {
  const supabase = createServerSupabaseClient()

  // 1. 最終同期時刻を確認
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'last_calendar_sync')
    .single()

  const lastSync = settings?.value ? new Date(settings.value) : null
  const now = new Date()

  // 2. 15分以内なら再同期しない
  if (lastSync && (now.getTime() - lastSync.getTime()) < CACHE_DURATION_MS) {
    // キャッシュされたデータを返す
    return getCachedBusyTimes(date)
  }

  // 3. Google Calendar APIからbusy時間を取得
  const busyTimes = await fetchBusyTimesFromGoogle(date)

  // 4. キャッシュを更新
  await supabase
    .from('app_settings')
    .upsert({ key: 'last_calendar_sync', value: now.toISOString() })

  return busyTimes
}
```

### Pattern 6: Edge Functions for Scheduled Tasks

**What:** 月次ポイント付与、リマインダーメール、サンキューメールなどの定期実行タスクはSupabase Edge Functions + pg_cronで実装。

**When to use:** 時刻ベースの自動処理すべて。Next.jsのデプロイとは独立してスケーリング・実行。

**Trade-offs:**
- **Pros:** サーバーレス、スケーラブル、Vercelの実行時間制限（Hobby: 10秒）に依存しない
- **Cons:** デバッグがやや面倒（ログはSupabaseダッシュボードで確認）、ローカル開発環境のセットアップが必要

**Example:**
```typescript
// supabase/functions/monthly-point-grant/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // 1. 有効な会員プラン一覧を取得
    const { data: memberPlans } = await supabase
      .from('member_plans')
      .select('*, plans(*)')
      .eq('is_active', true)

    // 2. 各会員にポイント付与
    for (const plan of memberPlans || []) {
      await supabase
        .from('member_plans')
        .update({
          remaining_points: plan.remaining_points + plan.plans.monthly_points,
        })
        .eq('id', plan.id)

      // 3. ポイント履歴を記録
      await supabase.from('point_logs').insert({
        member_plan_id: plan.id,
        points: plan.plans.monthly_points,
        operation: 'grant',
        description: '月次ポイント自動付与',
      })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error('Monthly point grant failed:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

```sql
-- pg_cronでスケジュール登録（毎月1日の午前0時JST = UTC 15:00前日）
SELECT cron.schedule(
  'monthly-point-grant',
  '0 15 L * *', -- 毎月末日の15:00 UTC（翌月1日 0:00 JST）
  $$
  SELECT
    net.http_post(
        url:='https://YOUR_PROJECT.supabase.co/functions/v1/monthly-point-grant',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);
```

## Data Flow

### Request Flow: 予約作成（会員）

```
[ユーザー: スロット選択画面]
    ↓
[GET /api/slots?date=2026-03-01]
    ↓ (Server Component)
[Availability Calculator]
    ├─→ [Google Calendar Sync] → busy時間取得
    ├─→ [DB: weekly_schedules] → 営業時間取得
    ├─→ [DB: bookings] → 既存予約取得
    └─→ 空きスロット計算
    ↓
[Response: 空きスロット一覧]
    ↓
[ユーザー: スロット選択 + メニュー選択 + 予約ボタン押下]
    ↓
[POST /api/bookings] (Route Handler)
    ↓
[Booking Manager.createBooking()]
    ├─→ [1] スロット再確認（Optimistic Lock）
    ├─→ [2] Point Manager.consumePoints() → PostgreSQL関数実行
    ├─→ [3] Zoom.createMeeting() → Zoom API呼び出し
    ├─→ [4] GoogleCalendar.addEvent() → Google Calendar API呼び出し
    ├─→ [5] DB: bookingsにINSERT
    ├─→ [6] Email.sendConfirmation() → Resend API（非同期）
    └─→ [補償処理] エラー時は[2][3][4]をロールバック
    ↓
[Response: 予約確認データ + Zoomリンク]
    ↓
[予約完了画面表示]
```

### State Management: ポイント残高の整合性

```
[予約作成リクエスト]
    ↓
[BEGIN TRANSACTION] (PostgreSQL)
    ↓
[consume_points() function]
    ├─→ SELECT ... FOR UPDATE (排他ロック)
    ├─→ 残高チェック
    ├─→ UPDATE remaining_points = remaining_points - point_cost
    └─→ RETURN TRUE/FALSE
    ↓
[外部API呼び出し成功]
    ↓
[COMMIT TRANSACTION]
    ↓
[残高更新が確定]

--- エラー時 ---

[外部API呼び出し失敗]
    ↓
[refund_points() function]
    ├─→ UPDATE remaining_points = remaining_points + point_cost
    └─→ ポイントログ記録
    ↓
[ROLLBACK TRANSACTION] (必要に応じて)
```

### Key Data Flows

1. **空き時間算出フロー:**
   - ユーザーが日付選択 → Googleカレンダー同期（15分キャッシュ） → 営業時間・既存予約・busy時間を統合 → バッファを考慮してスロット生成 → UIに表示

2. **予約作成フロー:**
   - ユーザーが予約ボタン押下 → API Route Handler → ポイント消費（PostgreSQL関数） → Zoom会議作成 → カレンダーイベント追加 → DB保存 → メール送信（非同期） → レスポンス返却

3. **キャンセルフロー:**
   - ユーザーがキャンセルボタン押下 → API Route Handler → ポイント返還（PostgreSQL関数） → Zoom会議削除 → カレンダーイベント削除 → DB更新（status='cancelled'） → キャンセルメール送信

4. **月次ポイント付与フロー:**
   - pg_cron（毎月1日0時JST） → Edge Function起動 → 全会員プランを取得 → ポイント加算 → ポイントログ記録

5. **リマインダーメールフロー:**
   - pg_cron（毎日9:00 JST） → Edge Function起動 → 翌日の予約を抽出 → メール送信 → reminder_sent=trueに更新

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 users** | 現在の設計で十分。Supabase無料枠（500MB DB、Edge Functions 500k実行/月）、Vercel無料枠で運用可能。Googleカレンダー同期はオンデマンド方式（15分キャッシュ）。 |
| **100-1,000 users** | カレンダー同期をcronバッチに切り替え（5-10分ごとにバックグラウンド同期）。Supabase ProプランまたはVercel Proプランへアップグレード。PostgreSQLのコネクションプールサイズを増やす（Supabase pooler使用）。 |
| **1,000+ users** | Read Replicaの導入（読み取り専用クエリを分散）。Edge Functionsのメモリ・タイムアウト最適化。Zoom API呼び出しのレート制限対策（キュー導入）。CDN活用（静的アセット、画像最適化）。 |

### Scaling Priorities

1. **First bottleneck: Googleカレンダー同期の並行呼び出し**
   - 複数ユーザーが同時にスロット取得APIを叩くと、Google Calendar APIのレート制限（1秒あたり10リクエスト）に到達する可能性
   - **対策:** キャッシュを強化し、同期処理をバックグラウンドバッチに移行。pg_cronで5分ごとに全日付の空き時間を事前計算してDBに保存

2. **Second bottleneck: PostgreSQLコネクション数**
   - Supabase無料枠はコネクション数60。Next.jsのサーバーレス関数が多数起動すると枯渇
   - **対策:** Supabase Transaction Pooler（PgBouncer）を有効化。コネクションプールを適切に管理

3. **Third bottleneck: Zoom API呼び出しのレート制限**
   - Zoom APIは1秒あたり10リクエスト制限。予約作成が集中すると失敗する可能性
   - **対策:** Redis + Bullキューなどでリクエストをキューイングし、レート制限内で順次処理

## Anti-Patterns

### Anti-Pattern 1: クライアント側でビジネスロジックを実装

**What people do:** 予約可能かどうかの判定、ポイント残高チェックをクライアント側（React Component内）で実装してしまう。

**Why it's wrong:**
- セキュリティリスク（ブラウザのDevToolsで改ざん可能）
- サーバー側との二重実装が発生
- バリデーションの不整合が起きやすい

**Do this instead:** ビジネスロジックはすべてサーバー側（Route Handler、Server Actions、PostgreSQL関数）に集約。クライアント側はUI表示とユーザー入力収集のみ。

### Anti-Pattern 2: 外部APIエラーをそのままユーザーに返す

**What people do:** Zoom APIやGoogle Calendar APIのエラーレスポンスをそのままフロントエンドに返してしまう。

**Why it's wrong:**
- エラーメッセージが技術的すぎてユーザーに伝わらない
- APIキーなどの機密情報が漏れるリスク
- エラーハンドリングの一貫性がない

**Do this instead:** 外部APIエラーを統一フォーマットに変換し、ユーザーフレンドリーなメッセージを返す。詳細エラーはサーバーログに記録。

```typescript
// ❌ Bad
try {
  await createZoomMeeting(params)
} catch (error) {
  return NextResponse.json({ error }, { status: 500 })
}

// ✅ Good
try {
  await createZoomMeeting(params)
} catch (error) {
  console.error('[Zoom API Error]', error)
  return NextResponse.json(
    { error: 'ビデオ会議の作成に失敗しました。しばらくしてから再度お試しください。' },
    { status: 500 }
  )
}
```

### Anti-Pattern 3: RLSポリシーを設定せずに公開スキーマのテーブルを使う

**What people do:** SupabaseのテーブルをRow Level Security (RLS)なしで使い、アプリケーション層でアクセス制御を実装。

**Why it's wrong:**
- セキュリティホール（RLSなしだと誰でもデータにアクセス可能）
- Supabase Realtimeなどの機能が使えない（RLS必須）
- 将来的にマルチテナント対応が困難

**Do this instead:** すべてのpublicスキーマのテーブルにRLSポリシーを設定。`auth.uid()`や`role`カラムを使ってアクセス制御。

```sql
-- ✅ Good: bookingsテーブルのRLSポリシー
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 本人または管理者のみ閲覧可能
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() = member_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 会員のみ予約作成可能（ゲストは別ポリシー）
CREATE POLICY "Members can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = member_id);
```

### Anti-Pattern 4: トランザクション管理なしでポイント消費と予約作成を別々に実行

**What people do:** ポイント消費のUPDATEと予約作成のINSERTを別々のクエリで実行し、間にエラーが発生してもロールバックしない。

**Why it's wrong:**
- ポイントは減ったのに予約が作成されない（ユーザー損失）
- 予約は作成されたのにポイントが減らない（サービス損失）
- データ不整合が発生し、手動修正が必要になる

**Do this instead:** PostgreSQL関数でトランザクションを保証するか、補償トランザクションで巻き戻す。

```sql
-- ✅ Good: トランザクション内でポイント消費 + 予約作成を実行
CREATE OR REPLACE FUNCTION create_booking_with_points(
  p_member_plan_id UUID,
  p_points INTEGER,
  p_booking JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  -- ポイント消費（失敗時はトランザクション全体がROLLBACK）
  IF NOT consume_points(p_member_plan_id, p_points) THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  -- 予約作成
  INSERT INTO bookings (...)
  VALUES (...)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;
```

### Anti-Pattern 5: すべての処理を同期的に実行する

**What people do:** 予約作成時にZoom会議作成、Googleカレンダーイベント追加、メール送信をすべて同期的に実行し、レスポンスが遅くなる。

**Why it's wrong:**
- ユーザーの待ち時間が長い（5-10秒）
- 外部APIのタイムアウトでリクエスト全体が失敗する
- メール送信失敗で予約作成自体が失敗する（不要な制約）

**Do this instead:** クリティカルな処理（ポイント消費、DB保存）のみ同期実行し、メール送信などは非同期化。Edge Functionsやキューを活用。

```typescript
// ✅ Good: メール送信は非同期化（失敗しても予約は成立）
const booking = await createBooking(params)

// 非同期でメール送信（await不要）
sendBookingConfirmationEmail(booking).catch((error) => {
  console.error('[Email Error]', error)
  // 失敗してもユーザーには影響しない
})

return NextResponse.json({ booking })
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Google Calendar API** | REST API + Service Account OAuth | Googleカレンダーのbusy/free時間を取得、イベント追加・削除。15分間のキャッシュで無駄なAPI呼び出しを削減。レート制限: 1秒10リクエスト |
| **Zoom API** | REST API + Server-to-Server OAuth | アカウントA（有料）とB（無料）を環境変数で切り替え。会議作成・削除のみ使用。レート制限: 1秒10リクエスト |
| **Resend (Email)** | REST API + React Email | 月3,000通の無料枠。予約確認、キャンセル、リマインダー、サンキューメールを送信。React Emailでテンプレート管理 |
| **Supabase Auth** | Supabase Client SDK | Google OAuth + メール/パスワード認証。`profiles`テーブルとの自動連携（Auth trigger） |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Presentation ↔ Application** | Server Component → データフェッチ直接、Client Component → Route Handler | Server Componentsは直接Supabaseクライアントを使用。Client ComponentsはfetchでRoute Handlerを呼び出す |
| **Application ↔ Business Logic** | TypeScript関数呼び出し | Route Handlerから`lib/booking/create.ts`などを呼び出し。依存性注入は不要（サーバーレス前提） |
| **Business Logic ↔ Integration** | TypeScript関数呼び出し（async/await） | `lib/booking/create.ts`から`lib/integrations/zoom.ts`などを呼び出し。エラーハンドリングは各層で実施 |
| **Business Logic ↔ Data** | Supabase Client SDK + PostgreSQL関数 | クエリはSupabase JS SDK経由。トランザクションが必要な場合はPostgreSQL関数（`supabase.rpc()`）を使用 |
| **Edge Functions ↔ Data** | Supabase Service Role Key | 管理者権限でDB操作。RLSポリシーをバイパス可能（注意が必要） |

## Sources

- [Architecture Patterns For Booking Management Platform | Medium](https://medium.com/tuimm/architecture-patterns-for-booking-management-platform-53499c1e815e)
- [Solving Double Booking at Scale: System Design Patterns from Top Tech Companies](https://itnext.io/solving-double-booking-at-scale-system-design-patterns-from-top-tech-companies-4c5a3311d8ea)
- [Building a Real-Time Booking System with Next.js 14: A Practical Guide | Medium](https://medium.com/@abdulrehmanikram9710/building-a-real-time-booking-system-with-next-js-14-a-practical-guide-d67d7f944d76)
- [Architecture | Supabase Docs](https://supabase.com/docs/guides/getting-started/architecture)
- [Building Scalable Real-Time Systems: A Deep Dive into Supabase Realtime Architecture and Optimistic UI Patterns | Medium](https://medium.com/@ansh91627/building-scalable-real-time-systems-a-deep-dive-into-supabase-realtime-architecture-and-eccb01852f2b)
- [Next.js Architecture in 2026 — Server-First, Client-Islands, and Scalable App Router Patterns](https://www.yogijs.tech/blog/nextjs-project-architecture-app-router)
- [Next.js (App Router) — Advanced Patterns for 2026: Server Actions, PPR, Streaming & Edge-first Architectures | Medium](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- [PostgreSQL: Documentation: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [How Postgres Makes Transactions Atomic — brandur.org](https://brandur.org/postgres-atomicity)
- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron | Schedule Recurring Jobs in Postgres](https://supabase.com/modules/cron)
- [Supabase Row Level Security (RLS): Complete Guide (2026) | DesignRevision](https://designrevision.com/blog/supabase-row-level-security)
- [Transactions and RLS in Supabase Edge Functions](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html)
- [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [How We Built an Asynchronous Email Notification System Using Azure Queue Storage and Azure Functions in .NET | Medium](https://medium.com/@sahansaamarasinghe/how-we-built-an-asynchronous-email-notification-system-using-azure-queue-storage-and-azure-e92014630405)
- [Why Async Notifications Boost Performance by 1400%: A Senior Engineer's Guide | Medium](https://medium.com/@kiamars.mirzaee/why-async-notifications-boost-performance-by-1400-a-senior-engineers-guide-0a1620197e13)
- [How I Built My Own Meeting Booking System: From Expensive SaaS to Custom Google Calendar Integration](https://andriifurmanets.com/blogs/build-your-own-booking-system-comprehensive-guide)
- [Google Calendar API overview | Google for Developers](https://developers.google.com/workspace/calendar/api/guides/overview)
- [Zoom API Reference - Zoom Developer Docs](https://developers.zoom.us/docs/api/)
- [Membership Points Management: Driving More Impactful Loyalty Programs](https://www.subscriptionflow.com/2025/08/membership-reward-points-management/)
- [Separation of Concerns (SoC): The Cornerstone of Modern Software Development | Nordic APIs](https://nordicapis.com/separation-of-concerns-soc-the-cornerstone-of-modern-software-development/)
- [How I Designed My Backend Architecture for a Real-Time Booking Platform | Medium](https://medium.com/@trihartonoalvin/how-i-designed-my-backend-architecture-for-a-real-time-booking-platform-becc9f902749)

---
*Architecture research for: コーチングセッション予約システム（Time with Kazumin）*
*Researched: 2026-02-22*
