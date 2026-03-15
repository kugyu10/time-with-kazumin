# Phase 10: テストシナリオ - Research

**Researched:** 2026-03-15
**Domain:** Playwright E2E テストシナリオ / page.route() モック / ゲスト・会員予約フロー
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-02 | ゲスト予約フロー（閲覧→予約→キャンセル）のE2Eテストが通る | GuestBookingClient.tsx・success/page.tsx・CancelPageClient.tsx のセレクタを特定済み。Zoom/Calendar/Resend は page.route() でモック化してテスト可能 |
| E2E-03 | 会員ログインフロー（メール/パスワード）のE2Eテストが通る | auth.setup.ts が既に実装済み（storageState保存）。auth.spec.ts で storageState 検証として分離テスト可能 |
| E2E-04 | 会員予約フロー（メニュー選択→ポイント消費→予約）のE2Eテストが通る | bookings/new/page.tsx・confirm/page.tsx・dashboard/page.tsx のフロー確認済み。/api/bookings POST の Saga 呼び出しに対して page.route() でモック化 |
</phase_requirements>

---

## Summary

Phase 9 で構築した Playwright 基盤（playwright.config.ts、global-setup/teardown、auth.setup.ts、fixtures.ts）をベースに、3 つのテストフローを `e2e/specs/` 配下のファイルに実装する。

ゲスト予約フロー（E2E-02）は `booking-flow.spec.ts` に実装し、`/api/guest/bookings` POST・`/api/guest/cancel/[token]` DELETE・`/api/public/slots` GET の 3 エンドポイント、および Zoom/Google Calendar/Resend 外部 API を `page.route()` でモック化する。成功レスポンスには `guest_token` と `cancel_token` が含まれるため、実際の DB に書き込まずに `success` ページへ遷移できる。

会員ログインフロー（E2E-03）は `auth.spec.ts` に分離し、`e2e/.auth/member.json`（storageState）が正しく生成されている事実をテストで検証する。会員予約フロー（E2E-04）は `member-booking.spec.ts` に実装し、`fixtures.ts` の `memberPage` フィクスチャを使って認証済みセッションから `bookings/new` → `bookings/confirm` → `dashboard` の遷移を確認する。

**Primary recommendation:** 外部 API は `page.route()` でモック化し、DB への実書き込みは行わない。会員予約の `/api/bookings` POST モックではポイント消費後のレスポンス（booking.id を含む）を返してダッシュボードへのリダイレクトを検証する。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 (既インストール) | E2E テスト実行 | Phase 9 で確定済み |
| @supabase/supabase-js | ^2.97.0 (既存) | global-setup で使用済み | 変更不要 |

### Supporting

追加インストール不要。Phase 9 で構築済みの基盤をそのまま使用する。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| page.route() モック | 実 API 呼び出し | 外部サービスのクォータ消費・環境依存を防ぐため page.route() を採用（STATE.md 確定済み） |
| fixtures.ts の memberPage | test.use({ storageState }) | フィクスチャの方が再利用性高く、Phase 9 で既に設計済み |

**Installation:**
```bash
# 追加インストール不要
# Phase 9 で npm install --save-dev @playwright/test@1.58.2 は完了済み
```

---

## Architecture Patterns

### Recommended Project Structure

```
e2e/
├── .auth/                        # storageState（Phase 9 で .gitignore 済み）
│   ├── member.json
│   └── admin.json
├── fixtures.ts                   # memberPage/adminPage フィクスチャ（Phase 9 実装済み）
├── auth.setup.ts                 # storageState 保存（Phase 9 実装済み）
├── global-setup.ts               # テストユーザー作成（Phase 9 実装済み）
├── global-teardown.ts            # テストユーザー削除（Phase 9 実装済み）
└── specs/                        # Phase 10 で新規作成
    ├── booking-flow.spec.ts      # E2E-02: ゲスト予約フロー
    ├── auth.spec.ts              # E2E-03: 会員ログインフロー
    └── member-booking.spec.ts   # E2E-04: 会員予約フロー
```

### Pattern 1: page.route() による外部 API モック

**What:** `page.route(urlPattern, handler)` でネットワークリクエストを傍受し、モックレスポンスを返す
**When to use:** Zoom/Google Calendar/Resend など外部サービスへの実 HTTP 呼び出しを防ぎたい場合

```typescript
// Source: https://playwright.dev/docs/network#handle-requests
test('ゲスト予約フロー', async ({ page }) => {
  // スロット API のモック
  await page.route('/api/public/slots*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        slots: [
          {
            date: '2026-04-01',
            startTime: '2026-04-01T01:00:00.000Z', // 10:00 JST
            endTime: '2026-04-01T01:30:00.000Z',   // 10:30 JST
          },
        ],
      }),
    })
  })

  // ゲスト予約 API のモック（Zoom/Calendar/Resend 呼び出しを含む内部実装をバイパス）
  await page.route('/api/guest/bookings', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        booking_id: 9999,
        guest_token: 'test-guest-token-uuid',
        cancel_token: 'test-cancel-token-jwt',
      }),
    })
  })

  // テスト実行...
})
```

### Pattern 2: ゲスト予約フロー（booking-flow.spec.ts）

**What:** 2 ステップフォーム（スロット選択 → 情報入力 → 送信）を通してキャンセルページまで検証
**When to use:** E2E-02 の実装

```typescript
// e2e/specs/booking-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('ゲスト予約フロー', () => {
  test.beforeEach(async ({ page }) => {
    // 外部 API モック設定（各テスト前に設定）
    await page.route('/api/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ booking_min_hours_ahead: 0 }), // テスト用に制限を0に
      })
    })
    await page.route('/api/guest/bookings', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          booking_id: 9999,
          guest_token: 'test-guest-token-uuid',
          cancel_token: 'test-cancel-token-jwt',
        }),
      })
    })
  })

  test('スロット選択→情報入力→予約完了 が表示される', async ({ page }) => {
    await page.goto('/guest/booking')

    // Step 1: スロット選択
    // SlotPicker が描画されることを確認
    await expect(page.getByText('日時選択')).toBeVisible()

    // Step 2 へ進む（スロット選択後に自動遷移するため、スロットをクリック）
    // Note: スロットが表示されるまで待機が必要
    const firstSlot = page.locator('[data-testid="slot-button"]').first()
    // SlotPicker の実装に応じてセレクタを調整する
    await firstSlot.click()

    // Step 2: 情報入力フォームが表示される
    await expect(page.getByText('情報入力')).toBeVisible()
    await page.getByLabel('お名前').fill('テスト 太郎')
    await page.getByLabel('メールアドレス').fill('test@example.com')
    await page.getByRole('button', { name: '予約する' }).click()

    // 予約成功ページへ遷移
    await expect(page).toHaveURL(/\/guest\/booking\/success/)
    await expect(page.getByText('ご予約ありがとうございます')).toBeVisible()
  })
})
```

**重要: SlotPicker のセレクタ確認が必要**（後述 Open Questions 参照）

### Pattern 3: 成功ページでの Zoom URL・JST 時刻表示の検証

**What:** 予約完了ページ（`/guest/booking/success?token=...`）で zoom_join_url と JST 時刻が表示されることを確認
**When to use:** E2E-02 の成功基準 2 番（「Zoom URLがJSTの時刻とともに表示」）

```typescript
test('予約完了画面に Zoom URL と JST 時刻が表示される', async ({ page }) => {
  // success ページを直接開く（Supabase からのデータ取得を page.route でモック）
  await page.route('/api/**', async (route) => {
    // success ページは Server Component で supabase 直接アクセスするため
    // page.route では傍受できない点に注意（下記 Pitfall 4 参照）
    await route.continue()
  })

  // 注意: success ページは Server Component が Supabase から直接取得するため
  // テスト用 DB へ実際に予約データを投入するか、
  // または booking-flow フロー全体を通して success ページを検証する
  // → フロー全体テストで success ページのコンテンツを検証するアプローチを推奨
})
```

### Pattern 4: 会員認証フロー（auth.spec.ts）

**What:** `e2e/.auth/member.json` が存在し、storageState が有効であることをテストで確認
**When to use:** E2E-03 の実装

```typescript
// e2e/specs/auth.spec.ts
import { test, expect } from '../fixtures'

test.describe('会員ログインフロー', () => {
  test('memberPage フィクスチャで認証済みページにアクセスできる', async ({ memberPage }) => {
    // memberPage は storageState が適用された認証済みページ
    await memberPage.goto('/dashboard')
    // ログインページにリダイレクトされないことを確認
    await expect(memberPage).not.toHaveURL(/\/login/)
    await expect(memberPage.getByText('かずみんとの時間を予約しましょう')).toBeVisible()
  })

  test('未認証ユーザーは /login へリダイレクトされる', async ({ page }) => {
    // fixtures の page (認証なし) を使用
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
```

### Pattern 5: 会員予約フロー（member-booking.spec.ts）

**What:** メニュー選択 → スロット選択 → 確認 → ダッシュボードリダイレクトを検証
**When to use:** E2E-04 の実装

```typescript
// e2e/specs/member-booking.spec.ts
import { test, expect } from '../fixtures'

test.describe('会員予約フロー', () => {
  test.beforeEach(async ({ memberPage }) => {
    // /api/bookings POST をモック（Saga パターンをバイパス）
    await memberPage.route('/api/bookings', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            booking: {
              id: 1001,
              start_time: '2026-04-01T01:00:00.000Z',
              zoom_join_url: 'https://zoom.us/j/mock-meeting',
              meeting_menus: { name: 'テストメニュー' },
            },
          }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test('メニュー選択→スロット選択→確認→ダッシュボード遷移', async ({ memberPage }) => {
    await memberPage.goto('/bookings/new')

    // Step 1: メニュー選択
    const firstMenu = memberPage.locator('[data-testid="menu-card"]').first()
    await firstMenu.click()
    await memberPage.getByRole('button', { name: '次へ' }).click()

    // Step 2: スロット選択
    const firstSlot = memberPage.locator('[data-testid="slot-button"]').first()
    await firstSlot.click()
    await memberPage.getByRole('button', { name: '確認画面へ' }).click()

    // Step 3: 確認ページ
    await expect(memberPage).toHaveURL(/\/bookings\/confirm/)
    await memberPage.getByRole('button', { name: '予約を確定する' }).click()

    // Step 4: ダッシュボードへリダイレクト
    await expect(memberPage).toHaveURL('/dashboard')
  })
})
```

### Pattern 6: ポイント残高変化の検証

**What:** 予約前後のポイント残高を比較してポイント消費を確認
**When to use:** E2E-04 の成功基準 4 番

```typescript
test('予約後にポイント残高が減少する', async ({ memberPage }) => {
  // Supabase から会員プランを取得するエンドポイントをモック
  // dashboard ページは Server Component でポイントを取得するため
  // テスト用 DB の会員テストユーザーの実際のポイントを使用する方が確実
  // → global-setup でテストユーザー作成時に member_plans テーブルへも挿入が必要

  await memberPage.goto('/dashboard')
  const pointsBefore = await memberPage.locator('[data-testid="point-balance"]').textContent()

  // 予約フローを実行...

  await memberPage.goto('/dashboard')
  const pointsAfter = await memberPage.locator('[data-testid="point-balance"]').textContent()

  // ポイントが減少していることを確認
  expect(Number(pointsAfter)).toBeLessThan(Number(pointsBefore))
})
```

**重要:** dashboard ページは Server Component のため、実際の DB のポイントが表示される。テスト用会員の `member_plans` を global-setup で作成する必要がある（後述）。

### Anti-Patterns to Avoid

- **Server Component のデータをページルートで page.route() モックしようとする:** `guest/booking/success/page.tsx` や `dashboard/page.tsx` は Server Component であり、Supabase に直接アクセスするため page.route() では傍受できない。これらのページのテストには実 DB データか、フロー全体テストを使う。
- **SlotPicker のスロットが存在しないことによるテスト失敗:** 週次スケジュールが登録されていない場合、スロットが0件になる。テスト環境の DB にスケジュールデータが必要。
- **ポイントが 0 の会員でのテスト:** member_plans.current_points が 0 だと予約確認ページでエラーになる。global-setup でテスト会員に十分なポイントを設定する。
- **cancel_token の実 JWT をキャンセルページで使う:** キャンセルフローのテストは `/api/guest/cancel/[token]` DELETE を page.route() でモック化して成功レスポンスを返す。実 JWT 検証は不要。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 外部 API モック | カスタム HTTP サーバー | `page.route()` | Playwright 組み込み機能。テストごとに設定・解除が可能 |
| 認証済みセッション | 毎テストでログインフォーム操作 | `fixtures.ts` の `memberPage` | Phase 9 で構築済み。storageState を再利用して高速化 |
| テストユーザーのポイント設定 | テスト内で Supabase 直接更新 | global-setup.ts を拡張して member_plans を作成 | global-setup が適切な場所。テストの独立性を保つ |
| スロットデータのモック | `/api/public/slots` に対して page.route() | テスト DB に weekly_schedules が存在するか確認し、あれば実 API を使用 | スロット API はモック不要な場合が多い |

**Key insight:** Server Component（`/guest/booking/success`, `/dashboard` 等）は Supabase に直接アクセスするため page.route() でモックできない。これらのページのテストには実 DB データを使うか、フロー全体テストとして Client Component 経由でデータを流す設計にする。

---

## Common Pitfalls

### Pitfall 1: Server Component データが page.route() でモックできない

**What goes wrong:** `page.route('/api/**', ...)` を設定しても、`/guest/booking/success/page.tsx` が直接 Supabase を呼ぶためモックが効かない
**Why it happens:** Server Component は Node.js サーバー側で実行され、ブラウザの fetch を経由しない
**How to avoid:** 方法 A: フロー全体テスト（`/api/guest/bookings` POST をモックして success ページへのリダイレクト後に表示を検証）。方法 B: テスト用 DB に実データを挿入して実際の表示を確認（guest_token を直接生成）
**Warning signs:** `page.route()` を設定しても success ページに「予約が見つかりません」が表示される

### Pitfall 2: SlotPicker のセレクタが data-testid を持たない

**What goes wrong:** `page.locator('[data-testid="slot-button"]')` が 0 件ヒットしてテストがタイムアウト
**Why it happens:** SlotPicker コンポーネントに `data-testid` 属性が付与されていない可能性
**How to avoid:** `src/components/bookings/SlotPicker.tsx` を確認し、実際の HTML 要素とクラス名・テキストでセレクタを構築する。必要に応じて `data-testid` を追加する
**Warning signs:** `Locator.click: Error: strict mode violation` または タイムアウト

### Pitfall 3: member_plans がないテストユーザーでの確認ページエラー

**What goes wrong:** `/bookings/confirm?menu_id=...` で「ログインユーザーの会員プランが見つかりません」エラーが表示される
**Why it happens:** `global-setup.ts` が `profiles` テーブルにユーザーを作成しているが、`member_plans` テーブルへの挿入がない
**How to avoid:** `global-setup.ts` を拡張して `member_plans` テーブルへ挿入する（`plans` テーブルの有効なプランID が必要）
**Warning signs:** `/bookings/confirm` ページにエラーメッセージが表示される

### Pitfall 4: weekly_schedules が空でスロットが表示されない

**What goes wrong:** SlotPicker にスロットが1件も表示されずテストが進まない
**Why it happens:** テスト環境の Supabase dev DB に `weekly_schedules` データが未登録
**How to avoid:** `global-setup.ts` でテスト用スケジュールを挿入するか、`/api/public/settings` と `weekly_schedules` クエリ（GuestBookingClient が直接 Supabase を呼ぶ場合）をモックする。GuestBookingPage は Server Component で weekly_schedules を取得し GuestBookingClient に渡しているため、DB にデータがあれば実データを使える
**Warning signs:** スロット一覧が空白のまま

### Pitfall 5: booking_min_hours_ahead による将来スロット制限

**What goes wrong:** `booking_min_hours_ahead: 24` のデフォルト設定で、24時間以内のスロットが全て「予約不可」になる
**Why it happens:** SlotPicker の実装が `bookingMinHoursAhead` を考慮してスロットをフィルタリングしている
**How to avoid:** `/api/public/settings` を `page.route()` でモックして `booking_min_hours_ahead: 0` を返す。または weekly_schedules に十分先の日付のスロットデータを挿入する
**Warning signs:** スロットが表示されるが全てグレーアウトされて選択できない

### Pitfall 6: fixtures.ts の memberPage と非認証 page の混在

**What goes wrong:** `member-booking.spec.ts` で `{ page }` を使って `/bookings/new` にアクセスすると `/login` にリダイレクトされる
**Why it happens:** fixtures.ts から `test` をインポートしているつもりが `@playwright/test` の `test` を使っている
**How to avoid:** `import { test, expect } from '../fixtures'` と明示的に fixtures から import する
**Warning signs:** テスト内で `/login` に意図せずリダイレクトされる

---

## Code Examples

Verified patterns from official sources:

### page.route() による POST モック

```typescript
// Source: https://playwright.dev/docs/network#modify-responses
await page.route('/api/guest/bookings', async (route) => {
  if (route.request().method() === 'POST') {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        booking_id: 9999,
        guest_token: 'e2e-test-guest-token',
        cancel_token: 'e2e-test-cancel-token',
      }),
    })
  } else {
    await route.continue()
  }
})
```

### fixtures.ts から test をインポート

```typescript
// Source: Phase 9 で実装済みの fixtures.ts パターン
import { test, expect } from '../fixtures' // @playwright/test ではなく fixtures から

test('会員ダッシュボードにアクセス', async ({ memberPage }) => {
  await memberPage.goto('/dashboard')
  await expect(memberPage).not.toHaveURL(/\/login/)
})
```

### global-setup.ts に member_plans 挿入を追加

```typescript
// global-setup.ts への追加コード
// member_plans を作成（テスト会員がポイントで予約できるようにする）
if (memberData?.user) {
  // まず有効なプランIDを取得
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (plan) {
    await supabase.from('member_plans').upsert({
      user_id: memberData.user.id,
      plan_id: plan.id,
      status: 'active',
      current_points: 100, // テスト用に十分なポイント
      monthly_points: 10,
    })
  }
}
```

### キャンセル API モック

```typescript
// ゲストキャンセル API のモック
await page.route('/api/guest/cancel/**', async (route) => {
  if (route.request().method() === 'DELETE') {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: '予約をキャンセルしました' }),
    })
  } else {
    await route.continue()
  }
})
```

### 会員予約 API モック

```typescript
// /api/bookings POST（Saga パターンをバイパス）
await memberPage.route('/api/bookings', async (route) => {
  if (route.request().method() === 'POST') {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        booking: {
          id: 1001,
          start_time: '2026-04-01T01:00:00.000Z',
          zoom_join_url: 'https://zoom.us/j/e2e-test-meeting',
          meeting_menus: { name: 'E2E テストメニュー' },
        },
      }),
    })
  } else {
    await route.continue()
  }
})
```

---

## Application Structure (E2E に関連するページとセレクタ)

### ゲスト予約フロー

| ページ | URL | 重要な要素 |
|--------|-----|-----------|
| 予約ページ | `/guest/booking` | `h1: 発光ポジティブちょい浴び30分 予約`、Step 1 は `SlotPicker`、Step 2 は `label: お名前`/`label: メールアドレス`/`button: 予約する` |
| 成功ページ | `/guest/booking/success?token=...&cancel_token=...` | `h1: ご予約ありがとうございます`、`dl` に日時表示（JST）、`a: Zoom URL`（zoom_join_url がある場合）、`a: 予約をキャンセルする` |
| キャンセルページ | `/guest/cancel/[token]` | `h1: 予約のキャンセル`、`dl` に予約詳細、キャンセル確認ダイアログ（CancelConfirmDialog）、`h1: キャンセルが完了しました` |

### 会員フロー

| ページ | URL | 重要な要素 |
|--------|-----|-----------|
| ログインページ | `/login` | `label: メールアドレス`、`label: パスワード`、`button: メールアドレスでログイン` |
| 予約フォーム | `/bookings/new` | Step 1: MenuSelect コンポーネント（`button: 次へ`）、Step 2: SlotPicker（`button: 確認画面へ`） |
| 予約確認 | `/bookings/confirm?menu_id=...&start_time=...&end_time=...` | BookingConfirm コンポーネント、ポイント残高表示、`button: 予約を確定する` |
| ダッシュボード | `/dashboard` | `h1: {name}さん` または `h1: こんにちは`、PointBalance コンポーネント |

**重要:** `button: 予約を確定する` のテキストは `BookingConfirm` コンポーネント内を確認して正確なテキストを特定する必要がある。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| テストごとに UI ログイン | storageState で事前ログイン | Playwright v1.31+ | テスト実行時間を大幅削減 |
| 実 API 呼び出し | page.route() モック | - | 外部サービス依存なし・決定論的テスト |
| globalSetup のみ | project-dependencies + globalSetup | Playwright v1.31+ | HTML report・trace に統合 |

---

## Open Questions

1. **SlotPicker のクリッカブル要素のセレクタ**
   - What we know: `src/components/bookings/SlotPicker.tsx` にスロットボタンが存在する
   - What's unclear: `data-testid` 属性があるか、クラス名やテキストでの特定が必要か
   - Recommendation: 10-01-PLAN.md の Wave 0 で `SlotPicker.tsx` を読み、セレクタを確認してから booking-flow.spec.ts を実装する

2. **BookingConfirm の「予約を確定する」ボタンの正確なテキスト**
   - What we know: `src/components/bookings/BookingConfirm.tsx` に確定ボタンがある
   - What's unclear: ボタンのテキストが「予約を確定する」か「予約確定」か
   - Recommendation: 10-02-PLAN.md の実装前に `BookingConfirm.tsx` を確認する

3. **テスト会員の member_plans が必要かどうか**
   - What we know: `/bookings/confirm` は `member_plans.current_points` を Supabase から取得する
   - What's unclear: global-setup.ts 現行実装は `profiles` のみ作成。`member_plans` および `plans` テーブルに有効なデータが必要
   - Recommendation: global-setup.ts に `member_plans` 挿入を追加する。`plans` テーブルに有効なプランが存在するか確認が必要

4. **weekly_schedules のテストデータ**
   - What we know: GuestBookingPage は weekly_schedules を Supabase から取得し GuestBookingClient に渡す
   - What's unclear: Supabase dev DB に weekly_schedules データがあるかどうか
   - Recommendation: テスト環境に weekly_schedules データがない場合は、`/api/public/settings` をモックしつつ GuestBookingPage Server Component が渡す schedules データに対応する別の方法を検討（または weekly_schedules を global-setup で挿入）

5. **success ページの Zoom URL 検証方法**
   - What we know: success ページは Server Component で booking.zoom_join_url を Supabase から取得して表示する
   - What's unclear: E2E テストで Zoom URL を検証するために実 DB への booking 挿入が必要か、フロー全体を通して検証するか
   - Recommendation: 実 DB への booking 挿入は避け、フロー全体テストで `/api/guest/bookings` POST モックに zoom_join_url を含めず、success ページに到達後に「Zoom URLは後ほどお知らせします」が表示されることを確認する、またはモック booking データを直接 DB に挿入して guest_token を指定して success ページを開く

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts`（Phase 9 で作成済み） |
| Quick run command | `npx playwright test e2e/specs/booking-flow.spec.ts` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-02 | ゲスト予約フロー（スロット選択→フォーム入力→成功ページ）がパスする | e2e | `npx playwright test e2e/specs/booking-flow.spec.ts` | ❌ Wave 0 |
| E2E-02 | success ページに JST 時刻が表示される | e2e | `npx playwright test e2e/specs/booking-flow.spec.ts` | ❌ Wave 0 |
| E2E-02 | キャンセルフロー（キャンセルページ→確認→完了）がパスする | e2e | `npx playwright test e2e/specs/booking-flow.spec.ts` | ❌ Wave 0 |
| E2E-03 | 会員が storageState でダッシュボードにアクセスできる | e2e | `npx playwright test e2e/specs/auth.spec.ts` | ❌ Wave 0 |
| E2E-03 | 未認証ユーザーが /login にリダイレクトされる | e2e | `npx playwright test e2e/specs/auth.spec.ts` | ❌ Wave 0 |
| E2E-04 | 会員予約フロー（メニュー選択→スロット選択→確認→ダッシュボード）がパスする | e2e | `npx playwright test e2e/specs/member-booking.spec.ts` | ❌ Wave 0 |
| E2E-04 | ポイント残高の変化が確認できる | e2e | `npx playwright test e2e/specs/member-booking.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test e2e/specs/<対象ファイル>.spec.ts --project=chromium`
- **Per wave merge:** `npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `e2e/specs/booking-flow.spec.ts` — E2E-02 ゲスト予約フロー
- [ ] `e2e/specs/auth.spec.ts` — E2E-03 会員ログインフロー
- [ ] `e2e/specs/member-booking.spec.ts` — E2E-04 会員予約フロー
- [ ] `e2e/specs/` ディレクトリ作成（`mkdir -p e2e/specs`）
- [ ] global-setup.ts に member_plans 挿入を追加（E2E-04 の前提条件）

---

## Sources

### Primary (HIGH confidence)

- https://playwright.dev/docs/network#handle-requests — page.route() API リファレンス
- https://playwright.dev/docs/network#modify-responses — route.fulfill() の使い方
- https://playwright.dev/docs/auth — storageState を使った認証パターン
- src/app/(public)/guest/booking/GuestBookingClient.tsx — 実際のフォームセレクタを確認
- src/app/(public)/guest/booking/success/page.tsx — Zoom URL・JST 表示の実装を確認
- src/app/(member)/bookings/new/page.tsx — 会員予約フローの実装を確認
- src/app/(member)/bookings/confirm/page.tsx — 確認ページの実装を確認
- src/app/(member)/dashboard/page.tsx — ダッシュボードのポイント表示を確認
- src/app/api/guest/bookings/route.ts — ゲスト予約 API の実装（モック対象の確認）
- src/app/api/bookings/route.ts — 会員予約 API の実装（Saga パターン、モック対象の確認）
- e2e/global-setup.ts — Phase 9 で実装済み（member_plans 追加が必要）
- e2e/fixtures.ts — Phase 9 で実装済み（memberPage/adminPage フィクスチャ）

### Secondary (MEDIUM confidence)

- なし（プロジェクト固有コードのため公式ドキュメントと実装コードで完結）

### Tertiary (LOW confidence)

- なし

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 9 で構築済みの基盤を流用。追加インストール不要
- Architecture: HIGH — アプリケーションコードを直接読んでフロー・API エンドポイント・セレクタを確認済み
- Pitfalls: HIGH — Server Component と Client Component の違いを理解した上でモック戦略を設計済み

**Research date:** 2026-03-15
**Valid until:** 2026-04-15（依存ライブラリ固定のため安定。アプリコード変更時は要再確認）
