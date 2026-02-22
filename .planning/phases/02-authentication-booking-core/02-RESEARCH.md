# Phase 2 Research: 認証と予約コア

**フェーズ:** Phase 2 - 認証と予約コア
**リサーチ日:** 2026-02-22
**信頼度:** HIGH（公式ドキュメント + 既存研究検証 + WebSearch）

---

## リサーチ質問

**「Phase 2を適切にプランニングするために何を知る必要があるか？」**

---

## エグゼクティブサマリー

Phase 2は、Sagaパターンによる分散トランザクション管理を核とした会員認証・予約フローの実装です。このフェーズの成否は、**予約作成フローにおける補償トランザクション設計の質**に直接依存します。

Phase 1で構築したデータベース基盤（8テーブル、SELECT FOR UPDATE NOWAIT、RLS）の上に、Google OAuth/Email認証、ポイント消費予約、予約一覧・キャンセル機能を実装します。外部API統合（Zoom、Google Calendar、Resend）はPhase 4で行うため、Phase 2ではモック実装で構造を準備します。

**最重要リスク:**
1. **分散トランザクション補償処理の設計不備** → Phase 2で完全に設計、Phase 4で実装
2. **Supabase Auth統合の認証フロー理解不足** → SSRパターン、JWTクレーム、RLSポリシー連携
3. **冪等性キーの実装漏れ** → 再試行時の二重予約防止

---

## 要件マッピング

### Phase 2で対応する要件

| REQ-ID | 要件 | 実装範囲 | 成功基準 |
|--------|------|---------|---------|
| MEMBER-01 | Google認証またはメール/パスワードでログイン | Supabase Auth統合、ログインページUI、認証ガード | ログイン成功後、予約ページへリダイレクト |
| MEMBER-02 | メニュー選択してポイント消費で予約 | 予約フローUI、`POST /api/bookings` API、`consume_points()`呼び出し | 予約確定後、ポイント減少確認 |
| MEMBER-03 | 現在のポイント残高を確認 | ヘッダー簡易表示、ダッシュボード詳細表示 | リアルタイム残高表示 |
| MEMBER-04 | 自分の予約一覧を確認 | 「今後」「過去」タブ分離、日付順（近い順）表示 | RLSによる本人予約のみ表示 |
| MEMBER-05 | 予約キャンセルでポイント返還 | キャンセル確認ダイアログ、`refund_points()`呼び出し | ポイント返還確認、予約status='canceled' |

### Phase 2でモック実装する外部API連携

Phase 4（外部API統合）で本実装を行うため、Phase 2では以下をモック化：

- **Zoom会議作成/削除** → モック関数で`{ zoom_meeting_id: "mock-123", zoom_join_url: "https://zoom.us/j/mock" }`を返却
- **Google Calendar追加/削除** → モック関数で`{ google_event_id: "mock-event-123" }`を返却
- **メール送信（予約確認、キャンセル）** → console.logで送信内容を出力

**理由:** Phase 2では予約フロー全体の構造（Saga補償処理、エラーハンドリング、リトライロジック）に集中し、外部API連携の詳細はPhase 4で完成させる。

---

## ドメイン知識

### 1. Supabase Authの認証フロー

#### Google OAuth vs メール/パスワード

**Google OAuth（推奨パターン）:**

```typescript
// クライアントサイド（app/login/page.tsx）
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}
```

**メール/パスワード:**

```typescript
async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
}
```

#### SSR対応の認証チェック（Next.js App Router）

**Server Component:**

```typescript
// app/dashboard/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ユーザー情報を使用
}
```

**認証コールバック処理:**

```typescript
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, request.url))
}
```

#### JWTクレームとRLSポリシーの連携

**app_metadataにroleを追加:**

```typescript
// 管理者がユーザーを招待する際（Phase 5実装）
const { data, error } = await supabase.auth.admin.inviteUserByEmail(
  'user@example.com',
  {
    data: {
      role: 'member', // app_metadataに追加
    },
  }
)
```

**RLSポリシーでJWTクレーム使用:**

```sql
-- Phase 1で実装済み
CREATE POLICY member_view_own_bookings ON bookings
FOR SELECT
USING (
  member_plan_id IN (
    SELECT id FROM member_plans WHERE user_id = auth.uid()
  )
);

-- JWT claimベースの管理者ポリシー
CREATE POLICY admin_all ON bookings
FOR ALL
USING (
  (auth.jwt() ->> 'user_role') = 'admin'
);
```

### 2. 予約作成フローのSagaパターン設計

#### Sagaパターンとは

Sagaパターンは、分散システムにおけるトランザクション整合性を保つための設計パターンです。各ステップに**補償トランザクション（compensating transaction）**を定義し、失敗時に逆順で実行してロールバックを行います。

**重要な原則:**
1. **各ステップは冪等であること** — 同じ操作を複数回実行しても結果が同じ
2. **補償トランザクションは逆順で実行** — B→A の順で削除（A→B で作成した場合）
3. **失敗は業務的な補正として扱う** — データベースロールバックではなく、業務ロジックでの取り消し

#### Phase 2の予約作成Sagaフロー（モック版）

```
┌─────────────────────────────────────────────────────────────┐
│ POST /api/bookings                                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: 冪等性キーチェック                                   │
│   - idempotency_keysテーブル確認                             │
│   - 既存キーなら前回レスポンスを返却                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: スロット空き確認                                     │
│   - bookingsテーブルで時間重複チェック                        │
│   - EXCLUDE制約で自動防止                                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: ポイント消費（DB Transaction）                       │
│   - consume_points() PostgreSQL関数呼び出し                  │
│   - SELECT FOR UPDATE NOWAITでロック取得                     │
│   - 残高不足ならエラー                                       │
│ 補償: refund_points()                                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: 予約レコード作成（status: 'pending'）                │
│   - bookingsテーブルにINSERT                                 │
│   - EXCLUDE制約で二重予約自動防止                            │
│ 補償: DELETE FROM bookings                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Zoom会議作成（モック）                               │
│   - Phase 2はモック、Phase 4で実装                          │
│   - モック: { zoom_meeting_id, zoom_join_url }返却          │
│ 補償: Zoom会議削除（Phase 4で実装）                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Google Calendar追加（モック）                        │
│   - Phase 2はモック、Phase 4で実装                          │
│   - モック: { google_event_id }返却                         │
│ 補償: Calendar削除（Phase 4で実装）                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 7: 予約確定（status: 'confirmed'）                      │
│   - bookings.status更新                                      │
│   - zoom_meeting_id, google_event_id保存                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 8: メール送信（非同期、モック）                          │
│   - Phase 2はconsole.log、Phase 4でResend実装               │
│   - メール失敗しても予約は成立                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                     成功レスポンス
```

#### 補償トランザクション実行例（失敗時）

**Zoom作成失敗（Step 5）の場合:**

```typescript
try {
  // Step 3: ポイント消費
  await consumePoints(memberPlanId, points)

  // Step 4: 予約レコード作成
  const booking = await createBookingRecord({ status: 'pending', ... })

  // Step 5: Zoom作成（失敗）
  const zoom = await createZoomMeeting() // ← エラー発生

} catch (error) {
  // 補償トランザクション実行（逆順）
  await deleteBookingRecord(booking.id)      // Step 4の補償
  await refundPoints(memberPlanId, points)   // Step 3の補償

  // ユーザーにエラー返却
  return NextResponse.json(
    { error: 'Zoom会議の作成に失敗しました。ポイントは返還されました。' },
    { status: 500 }
  )
}
```

### 3. 冪等性キーの実装

#### 冪等性とは

**同じ操作を複数回実行しても、結果が1回実行した場合と同じになること**。予約システムでは、ユーザーが予約ボタンを複数回押しても、予約は1回だけ作成されるべきです。

#### 実装パターン

**テーブル設計（Phase 2で追加）:**

```sql
CREATE TABLE idempotency_keys (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    request_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 期限切れキーの自動削除
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
```

**API実装:**

```typescript
// app/api/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key') || nanoid()
  const requestBody = await request.json()
  const requestHash = hashRequest(requestBody) // SHA-256等

  // 既存キーチェック
  const existingKey = await supabase
    .from('idempotency_keys')
    .select('*')
    .eq('key', idempotencyKey)
    .single()

  if (existingKey.data) {
    // リクエストハッシュ確認（同じリクエストか）
    if (existingKey.data.request_hash === requestHash) {
      // 前回のレスポンスを返却
      return NextResponse.json(existingKey.data.response)
    } else {
      // 異なるリクエストで同じキー → エラー
      return NextResponse.json(
        { error: 'Idempotency key already used with different request' },
        { status: 409 }
      )
    }
  }

  // 予約作成処理
  try {
    const booking = await createBooking(requestBody)

    // キー保存（24時間有効）
    await supabase.from('idempotency_keys').insert({
      key: idempotencyKey,
      request_hash: requestHash,
      response: booking,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    return NextResponse.json(booking)
  } catch (error) {
    // エラーもキャッシュ（同じエラーを複数回試行しない）
    await supabase.from('idempotency_keys').insert({
      key: idempotencyKey,
      request_hash: requestHash,
      response: { error: error.message },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    throw error
  }
}
```

**クライアント側:**

```typescript
// lib/api/bookings.ts
import { nanoid } from 'nanoid'

export async function createBooking(data: BookingRequest) {
  const idempotencyKey = nanoid() // 各リクエストで一意のキー生成

  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(data),
  })

  return response.json()
}
```

### 4. リトライロジックとエラーハンドリング

#### PostgreSQLデッドロック時のリトライ

**consume_points()関数がFOR UPDATE NOWAITで失敗した場合:**

```typescript
async function consumePointsWithRetry(
  memberPlanId: number,
  points: number,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.rpc('consume_points', {
        p_member_plan_id: memberPlanId,
        p_points: points,
      })

      if (error) throw error
      return data

    } catch (error) {
      // デッドロック（40P01）または行ロック取得失敗（55P03）
      if (
        (error.code === '40P01' || error.code === '55P03') &&
        attempt < maxRetries
      ) {
        // 指数バックオフ + ジッター
        const delay = Math.pow(2, attempt) * 100 + Math.random() * 100
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      throw error
    }
  }
}
```

#### ユーザーフレンドリーなエラーメッセージ

**エラー種別ごとのメッセージ:**

```typescript
function formatErrorMessage(error: any): string {
  // ポイント不足
  if (error.message.includes('Insufficient points')) {
    return 'ポイントが不足しています。現在の残高を確認してください。'
  }

  // 二重予約（EXCLUDE制約違反）
  if (error.code === '23P01') { // exclusion_violation
    return 'この時間はすでに予約が入っています。別の時間をお選びください。'
  }

  // デッドロック
  if (error.code === '40P01') {
    return '予約処理が混み合っています。もう一度お試しください。'
  }

  // その他
  return '予約の作成に失敗しました。しばらくしてからお試しください。'
}
```

### 5. キャンセルフローの補償処理

#### キャンセル時のポイント返還

**CONTEXTからのキャンセルポリシー:**
- キャンセル時は確認ダイアログ表示後にポイント返還
- 詳細な時間制限（24時間前まで100%等）はv2で検討

**Phase 2実装（シンプル版）:**

```typescript
// app/api/bookings/[id]/route.ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 予約取得
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, member_plans!inner(user_id)')
    .eq('id', params.id)
    .single()

  // 権限チェック（本人または管理者）
  const isOwner = booking.member_plans.user_id === user.id
  const isAdmin = user.user_metadata?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // ポイント返還（会員予約の場合）
    if (booking.member_plan_id) {
      await supabase.rpc('refund_points', {
        p_member_plan_id: booking.member_plan_id,
        p_points: booking.menu.points_required,
        p_reference_id: booking.id,
        p_notes: 'Booking canceled',
      })
    }

    // Zoom削除（モック）
    if (booking.zoom_meeting_id) {
      await deleteZoomMeeting(booking.zoom_meeting_id) // モック
    }

    // Calendar削除（モック）
    if (booking.google_event_id) {
      await deleteGoogleCalendarEvent(booking.google_event_id) // モック
    }

    // 予約ステータス更新
    await supabase
      .from('bookings')
      .update({ status: 'canceled' })
      .eq('id', params.id)

    // キャンセルメール送信（モック）
    await sendCancellationEmail(booking) // console.log

    return NextResponse.json({ success: true })

  } catch (error) {
    // 補償処理失敗時のロギング
    console.error('Failed to cancel booking:', error)
    return NextResponse.json(
      { error: 'キャンセル処理に失敗しました' },
      { status: 500 }
    )
  }
}
```

---

## 技術スタック決定事項

### Phase 2で使用する技術

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Next.js | 15.x | App Router、Route Handlers、Server Components |
| React | 19.x | UI、フォーム |
| TypeScript | 5.8.x | 型安全性 |
| Supabase.js | 2.79.0+ | 認証、DB接続（SSR対応） |
| @supabase/ssr | 最新 | SSR用クライアント作成 |
| Tailwind CSS | 4.x | スタイリング |
| shadcn/ui | 3.8.5+ | UIコンポーネント（Button, Card, Dialog等） |
| nanoid | 5.x | 冪等性キー生成 |
| zod | 3.x | バリデーション |

### インストールコマンド

```bash
npm install @supabase/supabase-js @supabase/ssr nanoid zod
```

---

## アーキテクチャ決定事項

### 1. ディレクトリ構造

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # ログインページ
│   │   └── signup/
│   │       └── page.tsx              # 新規登録ページ（v1は招待制のみ）
│   ├── (member)/
│   │   ├── dashboard/
│   │   │   └── page.tsx              # 会員ダッシュボード
│   │   ├── bookings/
│   │   │   ├── page.tsx              # 予約一覧
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # 予約作成フロー
│   │   │   └── [id]/
│   │   │       └── page.tsx          # 予約詳細
│   │   └── layout.tsx                # 認証ガード
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts              # OAuth コールバック
│   └── api/
│       └── bookings/
│           ├── route.ts              # POST: 予約作成、GET: 予約一覧
│           └── [id]/
│               └── route.ts          # DELETE: キャンセル
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # ブラウザ用クライアント
│   │   ├── server.ts                 # サーバー用クライアント
│   │   └── admin.ts                  # 管理者用クライアント（service_role）
│   ├── bookings/
│   │   ├── create.ts                 # 予約作成Saga実装
│   │   ├── cancel.ts                 # キャンセルフロー
│   │   └── types.ts                  # 型定義
│   ├── points/
│   │   ├── consume.ts                # ポイント消費
│   │   └── refund.ts                 # ポイント返還
│   ├── integrations/                 # Phase 4で実装（Phase 2はモック）
│   │   ├── zoom.ts                   # Zoomモック
│   │   ├── google-calendar.ts        # Calendarモック
│   │   └── email.ts                  # メールモック
│   └── utils/
│       ├── idempotency.ts            # 冪等性キー管理
│       └── errors.ts                 # エラーハンドリング
└── components/
    ├── auth/
    │   ├── LoginForm.tsx             # ログインフォーム
    │   └── GoogleSignInButton.tsx    # Google OAuthボタン
    └── bookings/
        ├── BookingForm.tsx           # 予約フォーム
        ├── BookingList.tsx           # 予約一覧
        └── CancelDialog.tsx          # キャンセル確認ダイアログ
```

### 2. データフロー

**予約作成フロー（Phase 2）:**

```
User → BookingForm (Client Component)
  ↓
POST /api/bookings (Route Handler)
  ↓
lib/bookings/create.ts (Saga Orchestrator)
  ↓
┌─────────────────────────────────────┐
│ Step 1: Idempotency Key Check      │
│ Step 2: Slot Availability Check    │
│ Step 3: consume_points()            │
│ Step 4: INSERT booking (pending)   │
│ Step 5: createZoomMeeting() [MOCK] │
│ Step 6: addToCalendar() [MOCK]     │
│ Step 7: UPDATE booking (confirmed) │
│ Step 8: sendEmail() [MOCK]         │
└─────────────────────────────────────┘
  ↓
Success Response → User
```

**失敗時の補償処理:**

```
Error at Step 5
  ↓
Step 4 Compensation: DELETE booking
  ↓
Step 3 Compensation: refund_points()
  ↓
Error Response → User（ポイント返還済み）
```

### 3. RLSポリシーとの連携

**Phase 1で実装済みのRLSポリシー（確認）:**

```sql
-- 会員は自分の予約のみ閲覧
CREATE POLICY member_view_own_bookings ON bookings
FOR SELECT
USING (
  member_plan_id IN (
    SELECT id FROM member_plans WHERE user_id = auth.uid()
  )
);

-- 会員は自分の予約のみキャンセル
CREATE POLICY member_cancel_own_bookings ON bookings
FOR UPDATE
USING (
  member_plan_id IN (
    SELECT id FROM member_plans WHERE user_id = auth.uid()
  )
);

-- 管理者は全予約を閲覧・操作可能
CREATE POLICY admin_all_bookings ON bookings
FOR ALL
USING (
  (auth.jwt() ->> 'user_role') = 'admin'
);
```

**Phase 2での確認事項:**
- `auth.uid()`が正しく機能するか（Server Components、Route Handlers）
- JWT claimに`user_role`が含まれるか（Supabase Auth設定）

---

## 実装優先度

### Must Have（Phase 2完了に必須）

1. **Supabase Auth統合**
   - Google OAuth設定
   - メール/パスワード認証
   - 認証コールバック処理
   - 認証ガード（middleware or layout）

2. **予約作成Saga実装（モック版）**
   - 冪等性キー管理
   - ポイント消費API
   - 予約レコード作成
   - 補償トランザクション実装
   - エラーハンドリング

3. **予約一覧・詳細**
   - 「今後」「過去」タブ分離
   - 日付順（近い順）表示
   - RLS連携確認

4. **キャンセルフロー**
   - キャンセル確認ダイアログ
   - ポイント返還API
   - 補償処理実装

5. **ポイント残高表示**
   - ヘッダー簡易表示
   - ダッシュボード詳細表示

### Should Have（Phase 2望ましい）

1. **リトライロジック**
   - デッドロック時の自動再試行
   - 指数バックオフ + ジッター

2. **エラーメッセージの改善**
   - ユーザーフレンドリーな日本語メッセージ
   - エラー種別ごとの適切な表示

3. **ローディング状態の表現**
   - ボタン無効化
   - スピナー表示

### Nice to Have（Phase 3以降）

1. **予約確認メール（実装）** → Phase 4
2. **Zoom会議作成（実装）** → Phase 4
3. **Google Calendar追加（実装）** → Phase 4

---

## 既知のリスクと緩和策

### Risk 1: Saga補償処理の設計不備

**リスク内容:**
Phase 2で補償処理の設計が不十分な場合、Phase 4で外部API統合時に大規模な書き換えが必要。

**緩和策:**
1. Phase 2でSaga Orchestratorを完全に実装（モック含む）
2. 各ステップに補償関数を定義（`compensate_step_3()`, `compensate_step_4()`等）
3. Phase 4では外部API呼び出しを実装するのみ（構造変更なし）

**検出方法:**
- Unit Test: 各ステップ失敗時に補償処理が正しく実行されるか
- Integration Test: 予約作成全フロー（モック含む）

### Risk 2: 冪等性キーの実装漏れ

**リスク内容:**
冪等性キーが実装されていない場合、ユーザーが予約ボタンを複数回押すと二重予約が発生。

**緩和策:**
1. Phase 2の最初に`idempotency_keys`テーブル作成
2. 全予約API（POST /api/bookings）で冪等性キーチェックを必須化
3. クライアント側で`nanoid()`を使用してキー生成

**検出方法:**
- Unit Test: 同じ冪等性キーで2回リクエストした場合、前回レスポンスが返却されるか
- Integration Test: ネットワーク遅延時に複数回リクエストが送信されるシナリオ

### Risk 3: RLSパフォーマンス劣化

**リスク内容:**
RLSポリシーで`EXISTS`サブクエリを多用すると、予約一覧取得時にパフォーマンスが劣化。

**緩和策:**
1. JWT claimベースの権限チェック（Phase 1で実装済み）
2. インデックス追加（Phase 1で実装済み）
3. Phase 2でパフォーマンステスト（500件の予約データで検証）

**検出方法:**
- Performance Test: 500件の予約データを作成し、`GET /api/bookings`のレスポンスタイムを計測
- 目標: 3秒以内

### Risk 4: Supabase Auth SSR統合の理解不足

**リスク内容:**
Next.js App RouterのSSRとSupabase Authの統合が複雑で、認証チェックが正しく動作しない。

**緩和策:**
1. 公式ドキュメント（[Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)）を参照
2. `@supabase/ssr`パッケージを使用（SSR専用クライアント）
3. Server ComponentとRoute Handlerで認証チェックパターンを統一

**検出方法:**
- Unit Test: 未認証状態で保護されたページにアクセスした場合、ログインページにリダイレクトされるか
- Integration Test: Google OAuth認証フロー全体（認証→コールバック→ダッシュボード表示）

---

## Phase 2完了の定義（Definition of Done）

### 機能要件

- [ ] Google OAuth認証が動作する（ログイン成功後、予約ページへリダイレクト）
- [ ] メール/パスワード認証が動作する
- [ ] 会員は自分の予約一覧を閲覧できる（「今後」「過去」タブ分離）
- [ ] 会員はポイント残高を確認できる（ヘッダー + ダッシュボード）
- [ ] 会員は予約を作成できる（ポイント消費、モック版Saga実装）
- [ ] 会員は予約をキャンセルできる（ポイント返還確認）
- [ ] 冪等性キーが実装されている（同じキーで再試行しても二重予約されない）

### 技術要件

- [ ] Saga Orchestratorが実装されている（モック含む、補償処理完備）
- [ ] リトライロジックが実装されている（デッドロック時の自動再試行）
- [ ] RLSポリシーが正しく機能している（本人予約のみ閲覧可能）
- [ ] エラーハンドリングが実装されている（ユーザーフレンドリーなメッセージ）
- [ ] `idempotency_keys`テーブルが作成されている

### テスト要件

- [ ] Unit Test: `consume_points()`成功・残高不足シナリオ
- [ ] Unit Test: 冪等性キー重複時の前回レスポンス返却
- [ ] Integration Test: 予約作成全フロー（モック含む）
- [ ] Integration Test: キャンセルフロー（ポイント返還確認）
- [ ] Performance Test: 500件予約データでの一覧取得（3秒以内）

### ドキュメント要件

- [ ] Phase 2実装ガイド（開発者向け）
- [ ] Saga設計ドキュメント（補償処理フロー図）
- [ ] エラーハンドリングガイド（エラーコード一覧）

---

## 次のフェーズへの引き継ぎ

### Phase 3（ゲスト予約体験）への引き継ぎ

- 予約作成APIは会員・ゲスト共用（`member_plan_id` or `guest_email`）
- ゲスト予約ではポイント消費スキップ
- Saga Orchestratorは会員/ゲストで共通構造

### Phase 4（外部API統合）への引き継ぎ

- Phase 2で実装したモック関数（`createZoomMeeting()`, `addToCalendar()`, `sendEmail()`）を実装に置き換え
- Saga構造は変更せず、外部API呼び出しのみ追加
- 補償処理（Zoom削除、Calendar削除）も実装

---

## 情報ソース

### 公式ドキュメント

- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Login with Google | Supabase Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Next.js Route Handlers | Next.js Docs](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js Error Handling | Next.js Docs](https://nextjs.org/docs/app/getting-started/error-handling)

### ベストプラクティス

- [Saga Design Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Understanding the Saga Pattern for Distributed Transactions](https://technori.com/2026/02/24410-understanding-the-saga-pattern-for-distributed-transactions/ava/)
- [Mastering the Saga Pattern: Building Resilient Distributed Transactions in Microservices](https://medium.com/skyro-tech/solving-distributed-transactions-with-the-saga-pattern-and-temporal-27ccba602833)
- [Mastering Idempotency: Building Reliable APIs](https://blog.bytebytego.com/p/mastering-idempotency-building-reliable)
- [Implementing Idempotency Keys in REST APIs](https://zuplo.com/learning-center/implementing-idempotency-keys-in-rest-apis-a-complete-guide)

### プロジェクト内部ドキュメント

- `.planning/phases/01-database-foundation/` - Phase 1 DB設計確認
- `.planning/research/PITFALLS.md` - 分散トランザクション、冪等性、RLSパフォーマンスの落とし穴
- `.planning/codebase/ARCHITECTURE.md` - Sagaパターン、Server-First設計
- `.planning/research/SUMMARY.md` - 技術スタック選定、Phase別リスク警告

---

**リサーチ完了日:** 2026-02-22
**次のステップ:** Phase 2プランニング（PLAN.md作成）
