# Phase 3: ゲスト予約体験 - Research

**Researched:** 2026-02-22
**Domain:** ゲスト向け予約システム、レート制限、セキュアなキャンセルトークン、Google Calendar統合
**Confidence:** HIGH

## Summary

Phase 3は非会員（ゲスト）向けのカジュアルセッション予約体験を構築します。会員登録なしで名前とメールアドレスのみで30分セッションを予約でき、Googleカレンダーへの1クリック登録とキャンセルが可能です。

既存のSupabase RLSとSagaパターンをベースに、ゲスト専用のセキュリティレイヤーを追加します。主な技術的課題は、(1) 認証なしユーザーのデータアクセス制御、(2) 悪意あるゲストによるレート制限攻撃の防止、(3) セキュアなキャンセルトークンの生成と検証です。

データベーススキーマは既にゲスト予約に対応（bookingsテーブルのguest_email, guest_name, guest_tokenカラム）しており、guest_tokenは自動生成トリガーで実装済みです。RLSポリシーはanonロールに対してfalseを返すため、ゲスト予約APIはservice_roleクライアントでバイパスする設計が採用されています。

**Primary recommendation:** Next.jsのAPI RouteでIP/emailベースのレート制限を実装し、service_roleクライアントで直接bookingsテーブルを操作。Google Calendar URL Schemeでクライアントサイド統合、JWTベースのキャンセルトークンで安全なキャンセルフローを実現する。

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GUEST-01 | ゲストは空き時間を日付指定で閲覧できる | weekly_schedulesとbookingsテーブルからの空きスロット計算（既存RLSポリシーでanon/authenticatedに公開済み） |
| GUEST-02 | ゲストは会員登録なしでカジュアル30分セッションを予約できる（名前+メール入力） | service_roleクライアントでのbookings INSERT + in-memoryレート制限 + guest_token自動生成トリガー |
| GUEST-03 | ゲストは自分のカジュアル予約をキャンセルできる | JWTベースのキャンセルトークンでセキュアなキャンセルAPI + refund不要（ゲストは無料） |
| GUEST-04 | ゲストは予約完了後、1クリックでGoogleカレンダーに登録できる | Google Calendar URL Scheme（text/dates/details/locationパラメータ）でクライアントサイド実装 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 | 15.3.3 | API Routes + Middleware | プロジェクト既存スタック、App Router対応 |
| Supabase JS | latest | service_roleクライアント | 既存Phase 1/2で確立、RLSバイパス用 |
| crypto (Node.js) | built-in | セキュアトークン生成 | CSPRNGでcrypto.randomBytes(32)、標準ライブラリ |
| jose | latest | JWTキャンセルトークン | 軽量JWT実装、標準化された署名検証 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lru-cache | ^10.x | In-memoryレート制限 | Upstash Redis不要な小規模運用（週3-5件予約） |
| validator | ^13.x | Email検証 | メールアドレス形式検証の標準ライブラリ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory lru-cache | Upstash Redis | Redisは分散環境で永続化可能だが、小規模MVP（週3-5件）では過剰。サーバーレス再起動時にキャッシュクリアされるが、厳密な制限より体験優先。 |
| JWT cancel token | crypto.randomBytes + DB保存 | DBルックアップが必要になり複雑化。JWTは署名検証のみで完結、有効期限内蔵。 |
| service_role直接操作 | Supabase Anonymous Sign-In | Anonymous Sign-Inは`authenticated`ロールを使用し、既存会員ポリシーと分離が複雑化。ゲストは一時的なため認証不要。 |

**Installation:**
```bash
npm install jose lru-cache validator
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (public)/              # ゲスト向け公開ページ
│   │   ├── guest/
│   │   │   ├── booking/
│   │   │   │   ├── page.tsx       # メニュー選択+スロット選択
│   │   │   │   └── success/page.tsx  # 予約完了+カレンダー追加
│   │   │   └── cancel/[token]/page.tsx  # キャンセル確認
│   └── api/
│       ├── guest/
│       │   ├── bookings/route.ts       # POST（予約作成）
│       │   └── cancel/[token]/route.ts # DELETE（キャンセル）
│       └── public/
│           └── slots/route.ts          # GET（空きスロット取得）
├── lib/
│   ├── supabase/
│   │   └── service-role.ts     # service_roleクライアント
│   ├── rate-limit/
│   │   └── guest-limiter.ts    # IP+emailベースレート制限
│   └── tokens/
│       └── cancel-token.ts      # JWT生成・検証
└── components/
    └── guest/
        ├── SlotPicker.tsx           # 日付指定カレンダー
        ├── GuestBookingForm.tsx     # 名前+メール入力
        └── AddToCalendarButton.tsx  # Google Calendar URLボタン
```

### Pattern 1: service_roleクライアントでRLSバイパス

**What:** ゲスト予約はSupabaseのservice_roleキーを使用してRLSポリシーをバイパスし、直接bookingsテーブルを操作する。

**When to use:** 認証なしユーザー（anon）のRLSポリシーがfalseを返す設計の場合。

**Example:**
```typescript
// src/lib/supabase/service-role.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase service role credentials')
}

export const supabaseServiceRole = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

**Security note:** service_roleキーは全RLSをバイパスするため、サーバーサイド専用（環境変数で保護）。クライアントに公開しない。

### Pattern 2: In-Memory Fixed Window Rate Limiter

**What:** Map構造とsetIntervalでメモリ内レート制限を実装。IP+emailの複合キーで制限。

**When to use:** MVP規模（週3-5件予約）で外部依存を減らしたい場合。

**Example:**
```typescript
// src/lib/rate-limit/guest-limiter.ts
import { LRUCache } from 'lru-cache'

type RateLimitKey = string // "ip:email"
type RateLimitValue = {
  count: number
  resetAt: number
}

const cache = new LRUCache<RateLimitKey, RateLimitValue>({
  max: 500,
  ttl: 60 * 60 * 1000, // 1時間
})

export async function checkGuestRateLimit(
  ip: string,
  email: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `${ip}:${email.toLowerCase()}`
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1時間
  const maxRequests = 3 // 1時間に3回まで

  const cached = cache.get(key)

  if (!cached || now > cached.resetAt) {
    // 新しいウィンドウ
    const resetAt = now + windowMs
    cache.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: maxRequests - 1, resetAt }
  }

  if (cached.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: cached.resetAt }
  }

  cached.count += 1
  cache.set(key, cached)
  return { allowed: true, remaining: maxRequests - cached.count, resetAt: cached.resetAt }
}
```

**Source:** [FreeCodeCamp - In-Memory Rate Limiter in Next.js](https://www.freecodecamp.org/news/how-to-build-an-in-memory-rate-limiter-in-nextjs/)

### Pattern 3: JWT Cancel Token with Expiration

**What:** JWTにbooking_id, guest_email, expを埋め込み、署名検証でキャンセル権限を確認。

**When to use:** DBルックアップなしでセキュアなキャンセルを実現したい場合。

**Example:**
```typescript
// src/lib/tokens/cancel-token.ts
import * as jose from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_CANCEL_SECRET || 'CHANGE_THIS_SECRET'
)

export async function generateCancelToken(
  bookingId: number,
  guestEmail: string
): Promise<string> {
  const token = await new jose.SignJWT({
    booking_id: bookingId,
    email: guestEmail.toLowerCase(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7日間有効
    .sign(JWT_SECRET)

  return token
}

export async function verifyCancelToken(
  token: string
): Promise<{ booking_id: number; email: string } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)

    if (typeof payload.booking_id !== 'number' || typeof payload.email !== 'string') {
      return null
    }

    return {
      booking_id: payload.booking_id,
      email: payload.email,
    }
  } catch {
    return null
  }
}
```

**Source:** [JWT Security Best Practices - Curity](https://curity.io/resources/learn/jwt-best-practices/)

### Pattern 4: Google Calendar URL Scheme Generation

**What:** サーバーサイドでURL生成、クライアントで`<a>`タグまたは`window.open()`でカレンダー追加。

**When to use:** OAuth審査回避、全ユーザー共通実装。

**Example:**
```typescript
// src/lib/calendar/url-generator.ts
export function generateGoogleCalendarUrl(params: {
  title: string
  startTime: Date
  endTime: Date
  description?: string
  location?: string
}): string {
  const baseUrl = 'https://calendar.google.com/calendar/r/eventedit'

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const searchParams = new URLSearchParams({
    text: params.title,
    dates: `${formatDate(params.startTime)}/${formatDate(params.endTime)}`,
  })

  if (params.description) {
    searchParams.set('details', params.description)
  }

  if (params.location) {
    searchParams.set('location', params.location)
  }

  // Zoom URL等を追加する場合
  searchParams.set('trp', 'false') // Show as available

  return `${baseUrl}?${searchParams.toString()}`
}
```

**Source:** [Google Calendar URL Parameters - GitHub Docs](https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/main/services/google.md)

### Anti-Patterns to Avoid

- **anon RLSポリシーでguest_emailを条件にする:** anonロールは認証前のため、auth.jwt()が使えず動的条件を適用できない。service_roleで完全バイパスする。
- **crypto.randomBytes()を直接モジュロ演算で使う:** バイアスが発生。crypto.randomInt()またはUUIDを使用。
- **キャンセルトークンをクエリパラメータで送信:** ブラウザ履歴やログに残る。URLパス（`/cancel/[token]`）またはPOSTボディで送信。
- **レート制限をIPのみに依存:** VPN/プロキシで回避可能。IP+email複合キーで制限。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT署名・検証 | 手動HMAC実装 | jose library | 署名アルゴリズム選択、クレーム検証、有効期限チェック、タイミング攻撃対策が必要。標準化された実装を使う。 |
| Email形式検証 | 正規表現パターン | validator.isEmail() | RFC 5322準拠の検証は複雑（TLD、IDN、コメント等）。validator.jsは実績あり。 |
| LRU Cache | Mapとタイマーの手動管理 | lru-cache | メモリリーク防止、TTL管理、最大サイズ制限が必要。lru-cacheは枯れたライブラリ。 |
| セキュアランダム生成 | Math.random() | crypto.randomBytes() | Math.random()は暗号学的に安全でない。CSPRNG（crypto.randomBytes）を使用。 |

**Key insight:** セキュリティ関連のプリミティブ（JWT、乱数、Email検証）は標準ライブラリを使う。自作するとエッジケース対応漏れで脆弱性が生まれる。

## Common Pitfalls

### Pitfall 1: service_roleキーの漏洩

**What goes wrong:** service_roleキーがクライアントに公開されると、全RLSがバイパスされ全データが操作可能になる。

**Why it happens:** 環境変数を誤ってバンドルに含める（process.env.*をクライアントコンポーネントで使用）。

**How to avoid:**
- service_roleクライアントはサーバーサイド専用（`src/lib/supabase/service-role.ts`）
- API Routeでのみimport、クライアントコンポーネントでは使用禁止
- `.env.local`に`SUPABASE_SERVICE_ROLE_KEY`を記載、Vercelでは環境変数に設定

**Warning signs:**
- ブラウザDevToolsのNetworkタブでservice_role keyがヘッダーに表示される
- Next.jsビルド警告："Environment variables used in browser code"

### Pitfall 2: 二重予約のrace condition

**What goes wrong:** 同じスロットに複数のゲストが同時に予約リクエストを送ると、EXCLUDE制約チェック前に両方が通過し片方がエラーになる。

**Why it happens:** 空きスロット確認と予約作成の間にタイムラグがあり、排他制御なし。

**How to avoid:**
- Phase 1で実装済みの`no_overlapping_bookings` EXCLUDE制約に依存
- 会員予約と同様のSagaパターンを適用（Phase 2実装済み）
- PostgreSQLの排他制約エラー（23P01）をキャッチし、ユーザーに「既に予約済み」を通知

**Warning signs:**
- 同じ時間帯に複数の予約が作成される
- PostgreSQLエラー: "conflicting key value violates exclusion constraint"

### Pitfall 3: IP取得の失敗（Vercel Edge環境）

**What goes wrong:** `request.ip`が常に`undefined`になり、レート制限が機能しない。

**Why it happens:** Next.js 15のMiddlewareやRoute HandlerでIPアドレス取得方法がVercel環境に依存する。

**How to avoid:**
- `x-forwarded-for`ヘッダーから取得: `req.headers.get('x-forwarded-for')?.split(',')[0]`
- フォールバックIP: `'127.0.0.1'`（ローカル開発用）
- Vercel本番環境では`x-forwarded-for`が自動設定される

**Warning signs:**
- レート制限が全ユーザーに適用されない（全員同じIPとして扱われる）
- IPが常に`undefined`または`::1`

**Source:** [Vercel Request Headers](https://vercel.com/docs/headers/request-headers)

### Pitfall 4: キャンセルトークンの有効期限設定ミス

**What goes wrong:** 有効期限が長すぎるとセキュリティリスク、短すぎるとユーザーがキャンセルできない。

**Why it happens:** 予約日時とトークン有効期限の関係を考慮していない。

**How to avoid:**
- トークン有効期限: 予約開始時刻 + 7日（デフォルト）
- 予約開始時刻を過ぎた予約はキャンセル不可（ビジネスロジック）
- JWT expクレームで自動検証

**Warning signs:**
- ユーザーから「キャンセルリンクが無効」の問い合わせ
- 過去の予約がキャンセルされる

### Pitfall 5: レート制限の回避（メールアドレス変更）

**What goes wrong:** 悪意あるユーザーがメールアドレスを変えて無限に予約する。

**Why it happens:** IP+emailの複合キーはemail部分を変えれば別ユーザーとして扱われる。

**How to avoid:**
- IP単独でも制限をかける（1時間に5件まで等）
- Email検証を強化（使い捨てメールドメインをブロック）
- CAPTCHA導入（Phase 4以降で検討）

**Warning signs:**
- 同じIPから異なるメールで大量予約
- 使い捨てメールサービスからの予約増加

**Source:** [API Abuse Prevention - Wiz](https://www.wiz.io/academy/api-security/api-abuse)

## Code Examples

Verified patterns from official sources:

### IP Address Extraction in Next.js 15 API Route

```typescript
// src/app/api/guest/bookings/route.ts
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Vercel環境でIPアドレスを取得
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

  // レート制限チェック
  const { allowed, remaining, resetAt } = await checkGuestRateLimit(ip, email)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetAt).toISOString(),
        },
      }
    )
  }

  // 予約作成処理...
}
```

**Source:** [Next.js Discussions - Get Client IP](https://github.com/vercel/next.js/discussions/55037)

### Secure Random Token Generation

```typescript
// src/lib/tokens/secure-random.ts
import { randomBytes } from 'crypto'

export function generateSecureToken(byteLength: number = 32): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(byteLength).toString('base64url')
}

// 使用例: ゲストトークンをDBでも再生成する場合
// const token = generateSecureToken(32)
```

**Source:** [Node.js Crypto randomBytes](https://markaicode.com/node-js-crypto-randombytes-secure-random-byte-generation/)

### Email Validation with validator.js

```typescript
// src/lib/validation/guest.ts
import validator from 'validator'

export function validateGuestBooking(data: {
  email: string
  name: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!validator.isEmail(data.email)) {
    errors.push('Invalid email address')
  }

  if (validator.isEmpty(data.name.trim())) {
    errors.push('Name is required')
  }

  if (data.name.trim().length < 2 || data.name.trim().length > 100) {
    errors.push('Name must be between 2 and 100 characters')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

**Source:** [Email Verification JavaScript Tutorial](https://mailfloss.com/step-by-step-email-verification-javascript-tutorial-best-practices-code-examples/)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Anonymous Sign-In | service_roleバイパス | Phase 1-2設計時 | Anonymous Sign-Inは`authenticated`ロールを使うため、会員ポリシーと分離が複雑。ゲストは一時的なため認証レス設計を採用。 |
| 個別トークンテーブル | JWT + 署名検証 | 現代的パターン | DBルックアップ不要、スケーラブル。有効期限内蔵、署名検証のみで完結。 |
| Google Calendar API | URL Scheme方式 | PROJECT.md決定済み | OAuth審査回避、ユーザーカレンダーwrite権限不要。クライアントサイド完結。 |

**Deprecated/outdated:**
- Supabase Anonymous Sign-In for guest bookings: authenticatedロールを使用するため既存会員RLSポリシーと衝突する。ゲストはservice_role直接操作が明確。

## Open Questions

1. **使い捨てメールサービスのブロック**
   - What we know: validator.jsはメール形式のみ検証、ドメインブラックリストは未対応
   - What's unclear: 使い捨てメールを検出するライブラリが必要か、MVP時点で対応すべきか
   - Recommendation: MVPではブロックせず、Phase 6自動化タスクで悪用パターンを監視。必要に応じて手動ブロックリスト追加。

2. **CAPTCHAの導入タイミング**
   - What we know: レート制限のみでは自動化ボット対策が不十分
   - What's unclear: Google reCAPTCHA v3またはCloudflare Turnstileをいつ導入すべきか
   - Recommendation: MVPでは導入せず、Phase 4以降で悪用が発覚した場合に検討（YAGNI原則）。

3. **ゲスト予約の通知タイミング**
   - What we know: Phase 2の会員予約ではSagaステップ8でメール送信（モック実装）
   - What's unclear: ゲスト予約も同様のSagaパターンを適用すべきか、簡略化すべきか
   - Recommendation: ゲスト予約もSagaパターンを適用（Phase 2実装を再利用）。Phase 4でモック→本実装に置換。

## Sources

### Primary (HIGH confidence)

- [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) - 匿名認証の仕組み、RLSでの`is_anonymous`判別
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) - anonロールとauthenticatedロールの扱い
- [Google Calendar URL Scheme - GitHub Docs](https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/main/services/google.md) - 全パラメータ仕様
- [JWT Best Practices - Curity](https://curity.io/resources/learn/jwt-best-practices/) - JWT署名、検証、セキュリティ

### Secondary (MEDIUM confidence)

- [Upstash Redis Rate Limiting](https://upstash.com/blog/nextjs-ratelimiting) - Next.js APIルートのレート制限実装
- [FreeCodeCamp - In-Memory Rate Limiter](https://www.freecodecamp.org/news/how-to-build-an-in-memory-rate-limiter-in-nextjs/) - lru-cacheでのレート制限
- [Vercel Request Headers](https://vercel.com/docs/headers/request-headers) - x-forwarded-for取得
- [Next.js Discussions - Get Client IP](https://github.com/vercel/next.js/discussions/55037) - Next.js 15でのIP取得方法
- [Email Verification JavaScript Tutorial](https://mailfloss.com/step-by-step-email-verification-javascript-tutorial-best-practices-code-examples/) - validator.js使用例
- [Node.js Crypto randomBytes](https://markaicode.com/node-js-crypto-randombytes-secure-random-byte-generation/) - セキュアトークン生成
- [API Abuse Prevention - Wiz](https://www.wiz.io/academy/api-security/api-abuse) - APIレート制限戦略

### Tertiary (LOW confidence)

- [Rate Limiting Strategies - API7.ai](https://api7.ai/learning-center/api-101/rate-limiting-strategies-for-api-management) - Fixed/Sliding Window等のアルゴリズム解説（一般論）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js 15 + Supabaseは既存Phase 1-2で確立、公式ドキュメント検証済み
- Architecture: HIGH - service_role直接操作は既存RLSポリシー（anonはfalse）と整合、Sagaパターンは再利用可能
- Pitfalls: MEDIUM - IP取得、レート制限回避、service_role漏洩は公式ドキュメント+コミュニティ情報で検証済み、CAPTCHAは未検証

**Research date:** 2026-02-22
**Valid until:** 2026-03-22（30日 - 安定技術スタック、Next.js 15は成熟）
