---
phase: 10-test-scenarios
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/global-setup.ts
  - e2e/specs/booking-flow.spec.ts
autonomous: true
requirements: [E2E-02]

must_haves:
  truths:
    - "ゲスト予約フロー（スロット選択→情報入力→予約完了）のE2Eテストがパスする"
    - "予約完了画面でZoom URLとJST時刻が表示されていることをテストで検証できる"
    - "ゲストキャンセルフロー（キャンセルページ表示→確認ダイアログ→キャンセル完了）のE2Eテストがパスする"
    - "Zoom/Calendar/Resend の実API呼び出しは page.route() でモック化されている"
  artifacts:
    - path: "e2e/specs/booking-flow.spec.ts"
      provides: "ゲスト予約フローE2Eテスト"
      min_lines: 120
    - path: "e2e/global-setup.ts"
      provides: "テスト用member_plans・ゲスト予約レコード挿入"
      contains: "member_plans"
  key_links:
    - from: "e2e/specs/booking-flow.spec.ts"
      to: "/api/guest/bookings"
      via: "page.route() モック"
      pattern: "page\\.route.*guest/bookings"
    - from: "e2e/specs/booking-flow.spec.ts"
      to: "/guest/booking/success"
      via: "global-setupで挿入したguest_tokenで直接アクセス"
      pattern: "guest/booking/success.*token=e2e-"
    - from: "e2e/specs/booking-flow.spec.ts"
      to: "/guest/cancel/"
      via: "global-setupで生成したcancel_tokenで直接アクセス"
      pattern: "guest/cancel/"
    - from: "e2e/specs/booking-flow.spec.ts"
      to: "/api/guest/cancel/"
      via: "page.route() モック"
      pattern: "page\\.route.*guest/cancel"
---

<objective>
ゲスト予約フロー（スロット選択→情報入力→予約完了→キャンセル）のE2Eテストを実装する。

Purpose: E2E-02 要件を満たし、ゲスト予約の回帰テストを確立する。ROADMAP Success Criteria 2番（Zoom URL + JST時刻表示の検証）を含む。
Output: e2e/specs/booking-flow.spec.ts、拡張版 e2e/global-setup.ts
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-playwright-foundation/09-playwright-foundation-01-SUMMARY.md
@.planning/phases/09-playwright-foundation/09-playwright-foundation-02-SUMMARY.md
@.planning/phases/10-test-scenarios/10-RESEARCH.md

<interfaces>
<!-- Phase 9 で構築済みの E2E 基盤 -->

From e2e/fixtures.ts:
```typescript
import { test as base, type Page } from '@playwright/test'
type AuthFixtures = { memberPage: Page; adminPage: Page }
export const test = base.extend<AuthFixtures>({...})
export { expect } from '@playwright/test'
```

From e2e/global-setup.ts:
```typescript
// 現在は profiles テーブルのみ作成。member_plans 未挿入。
export default async function globalSetup() {
  // 会員テストユーザー作成 → profiles upsert
  // 管理者テストユーザー作成 → profiles upsert
}
```

From e2e/auth.setup.ts:
```typescript
// /login で メールアドレス/パスワード入力 → storageState 保存
// member → e2e/.auth/member.json
// admin → e2e/.auth/admin.json
```

<!-- ゲスト予約フローの重要セレクタ -->

GuestBookingClient.tsx:
- Step 1: SlotPicker コンポーネント。スロットは `<button>` 要素で時刻テキスト（例: "10:00"）表示。data-testid なし。
- Step 2: `label[for="name"]` = "お名前"、`label[for="email"]` = "メールアドレス"
- 送信ボタン: `button[type="submit"]` テキスト "予約する"
- API: POST `/api/guest/bookings` → レスポンス `{ guest_token, cancel_token }`
- 成功時リダイレクト: `/guest/booking/success?token=...&cancel_token=...`

SlotPicker.tsx:
- API: GET `/api/public/slots/week?start=...&duration=...&minHours=...`
- レスポンス: `{ slots: { "YYYY-MM-DD": [{ date, startTime, endTime, available }] } }`
- スロットボタン: `<button>` に時刻テキスト（例: "10:00"）。available=true のボタンは bg-orange-100 クラス。
- ヘッダー: `<h2>日時を選択</h2>`

GuestBookingClient settings:
- API: GET `/api/public/settings` → `{ booking_min_hours_ahead: number }`

Success page (Server Component — DB直接アクセス):
- `getSupabaseServiceRole()` で DB から guest_token で booking を取得して表示
- `<h1>ご予約ありがとうございます</h1>`
- Zoom URL: `<a href={zoom_join_url}>` 内に zoom_join_url テキスト表示（zoom_join_url がある場合のみ表示）
- JST 時刻: toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) と toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" })
- `<dt>日時</dt><dd>` に日本語フォーマットの日付
- `<dt>時間</dt><dd>` に "HH:MM - HH:MM" フォーマットの時間
- キャンセルリンク: `<a href="/guest/cancel/{cancel_token}">予約をキャンセルする</a>`（cancel_token がある場合のみ）

Cancel page (Server Component → Client Component):
- Server Component: `verifyCancelToken(token)` で JWT 検証 → booking_id で DB から予約取得 → email 照合
- 有効な場合: `<CancelPageClient>` に予約情報を渡す
- CancelPageClient: `<h1>予約のキャンセル</h1>`、予約詳細表示、CancelConfirmDialog
- CancelConfirmDialog: `<Button>予約をキャンセル</Button>` → AlertDialog → `<AlertDialogAction>キャンセルする</AlertDialogAction>`
- キャンセル API: `fetch(/api/guest/cancel/${token}, { method: 'DELETE' })` — page.route() でモック可能
- 完了後: `<h1>キャンセルが完了しました</h1>`

cancel-token.ts:
- `generateCancelToken(bookingId, guestEmail)`: jose の SignJWT で HS256 署名、7日有効期限
- `verifyCancelToken(token)`: jwtVerify → `{ booking_id, email }`
- secret: `process.env.JWT_CANCEL_SECRET` || デフォルト値 "default-cancel-secret-do-not-use-in-production"
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: global-setup.ts 拡張（member_plans + ゲスト予約レコード挿入）</name>
  <files>e2e/global-setup.ts</files>
  <action>
e2e/global-setup.ts を拡張して以下を追加する:

**重要な設計方針:**
success ページとキャンセルページは Server Component で DB から直接データを取得する。page.route() では傍受できない。
そのため、global-setup で実際の bookings レコードを DB に挿入し、既知の guest_token と有効な cancel_token を持たせる。
テストではこれらのトークンを使って success/cancel ページに直接アクセスし、表示内容を検証する。

1. **jose ライブラリの import 追加**:
   - `import { SignJWT } from 'jose'` を追加（cancel_token 生成に使用）

2. **member_plans 挿入**（会員テストユーザー作成の直後）:
   - まず `plans` テーブルから `is_active=true` のプランを1件取得する
   - プランが存在する場合、`member_plans` テーブルに upsert する:
     - `user_id`: memberData.user.id
     - `plan_id`: 取得したプラン ID
     - `status`: 'active'
     - `current_points`: 100（テスト用に十分なポイント）
     - `monthly_points`: 10
   - プランが存在しない場合は console.warn でログ出力（テストは続行）

3. **weekly_schedules 存在確認**:
   - `weekly_schedules` テーブルの件数を確認
   - 0件の場合は console.warn で「weekly_schedules が空です。スロット表示テストが失敗する可能性があります」を出力

4. **ゲスト予約テスト用 booking レコード挿入**（管理者テストユーザー作成の後）:
   - `meeting_menus` テーブルから `is_active=true` のメニューを1件取得（ゲスト予約対象メニュー特定のため）
   - メニューが存在しない場合は console.warn で「meeting_menus が空です。success ページテストが失敗する可能性があります」を出力してスキップ
   - 存在する場合、以下の booking レコードを upsert する:
     - `guest_token`: `'e2e-test-guest-token'`（固定値。テストから参照する）
     - `guest_name`: `'E2E テストゲスト'`
     - `guest_email`: `'e2e-guest@example.com'`
     - `start_time`: 明日の 10:00 JST（`new Date()` で翌日を計算し、`T01:00:00.000Z` = 10:00 JST）
     - `end_time`: 明日の 10:30 JST（`T01:30:00.000Z`）
     - `status`: `'confirmed'`
     - `zoom_join_url`: `'https://zoom.us/j/e2e-mock-meeting-12345'`
     - `menu_id`: 取得したメニューの ID
     - `booking_type`: `'guest'`
   - upsert 条件: `guest_token` が `'e2e-test-guest-token'` の既存レコードがある場合は更新する。
     ただし bookings テーブルに guest_token の unique 制約がない可能性があるため、
     まず `supabase.from('bookings').select('id').eq('guest_token', 'e2e-test-guest-token').maybeSingle()` で既存チェックし、
     存在すれば update、なければ insert する。
   - 挿入後、booking の `id` を取得する

5. **cancel_token 生成と環境変数エクスポート**:
   - 挿入した booking の `id` と `guest_email` ('e2e-guest@example.com') を使って有効な cancel_token を生成する
   - cancel_token 生成方法（src/lib/tokens/cancel-token.ts と同じロジック）:
     ```typescript
     const secret = new TextEncoder().encode(
       process.env.JWT_CANCEL_SECRET || 'default-cancel-secret-do-not-use-in-production'
     )
     const cancelToken = await new SignJWT({
       booking_id: bookingId,
       email: 'e2e-guest@example.com',
     })
       .setProtectedHeader({ alg: 'HS256' })
       .setIssuedAt()
       .setExpirationTime('7d')
       .sign(secret)
     ```
   - 生成した cancel_token を JSON ファイルに書き出す:
     `fs.writeFileSync(path.join(__dirname, '.auth', 'e2e-tokens.json'), JSON.stringify({ guest_token: 'e2e-test-guest-token', cancel_token: cancelToken }))`
   - テストスペックファイルからはこの JSON を読み込んで cancel_token を取得する

6. **e2e/specs/ ディレクトリ作成**:
   - `fs.mkdirSync(path.join(__dirname, 'specs'), { recursive: true })` を実行

既存の profiles upsert ロジックは変更しない。追加のみ。
  </action>
  <verify>
    <automated>cd /Users/kugyu10/work/かずみん/Time-with-Kazumin && grep -c "member_plans" e2e/global-setup.ts && grep -c "guest_token" e2e/global-setup.ts && grep -c "SignJWT" e2e/global-setup.ts && test -d e2e/specs</automated>
  </verify>
  <done>global-setup.ts に member_plans 挿入ロジック、ゲスト予約レコード挿入（guest_token + zoom_join_url 付き）、cancel_token 生成・保存ロジックが追加されている。e2e/specs/ ディレクトリが存在する。</done>
</task>

<task type="auto">
  <name>Task 2: ゲスト予約フロー E2E テスト実装</name>
  <files>e2e/specs/booking-flow.spec.ts</files>
  <action>
`e2e/specs/booking-flow.spec.ts` を作成する。`@playwright/test` から直接 import する（ゲストテストは認証不要）。

**重要な設計方針:**
- 予約フロー（スロット選択→情報入力→送信→success URL遷移）は page.route() でAPIをモック化してテストする
- success ページの表示内容（Zoom URL + JST時刻）は Server Component で DB 直接アクセスするため、page.route() では傍受不可
- **解決策:** global-setup.ts で挿入済みのゲスト予約レコード（guest_token='e2e-test-guest-token', zoom_join_url 付き）を利用し、success ページに直接アクセスして表示内容を検証する
- キャンセルフローも同様: global-setup で生成した有効な cancel_token を使ってキャンセルページに直接アクセスし、Server Component が DB からデータを取得して表示→ CancelConfirmDialog の操作→ `/api/guest/cancel/` DELETE を page.route() でモック → 「キャンセルが完了しました」表示を検証する

**テスト構成:**

1. **ヘルパー関数（ファイル先頭）:**
   - `getNextWeekday()`: 現在日時から2日後の平日を計算し YYYY-MM-DD 形式で返す
   - `createSlotsResponse(dateStr: string)`: 指定日付のスロット3件（10:00, 10:30, 11:00 JST）を返す。形式: `{ slots: { [dateStr]: [{ date, startTime, endTime, available: true }] } }`
   - `loadE2ETokens()`: `path.join(__dirname, '../.auth/e2e-tokens.json')` を読み込み `{ guest_token, cancel_token }` を返す。ファイルが存在しない場合は `test.skip()` するためのフラグを返す

2. `test.describe('ゲスト予約フロー — 予約作成')`:
   - `test.beforeEach`: 以下の page.route() モックを設定
     - `**/api/public/settings` → `{ booking_min_hours_ahead: 0 }`
     - `**/api/public/slots/week*` → getNextWeekday() + createSlotsResponse() で動的にスロット返却
     - `**/api/guest/bookings` (POST) → `{ booking_id: 9999, guest_token: 'e2e-test-guest-token', cancel_token: 'e2e-mock-cancel-token' }` を status 201 で返す

   - `test('スロット選択→情報入力→予約完了URLへ遷移')`:
     1. `page.goto('/guest/booking')`
     2. `page.getByText('日時を選択')` が visible であることを確認（SlotPicker の h2）
     3. スロット API モックが返した時刻テキスト（例: "10:00"）の `<button>` をクリック: `page.locator('button').filter({ hasText: '10:00' }).first().click()`
     4. Step 2 遷移後: `page.getByLabel('お名前')` に 'テスト太郎' を fill
     5. `page.getByLabel('メールアドレス')` に 'test-e2e@example.com' を fill
     6. `page.getByRole('button', { name: '予約する' })` をクリック
     7. URL が `/guest/booking/success` を含むことを確認: `await expect(page).toHaveURL(/\/guest\/booking\/success/)`
     8. クエリパラメータに `token=e2e-test-guest-token` が含まれることを確認

3. `test.describe('予約完了画面 — Zoom URL・JST時刻表示')`:
   - `test('success ページに Zoom URL と JST 時刻が表示される')`:
     1. `const tokens = loadE2ETokens()` — ファイルがなければ `test.skip('global-setup でゲスト予約レコードが作成されていません')`
     2. `page.goto('/guest/booking/success?token=e2e-test-guest-token&cancel_token=' + tokens.cancel_token)`
     3. `await expect(page.getByText('ご予約ありがとうございます')).toBeVisible()` — h1 表示確認
     4. Zoom URL 検証: `await expect(page.getByText('https://zoom.us/j/e2e-mock-meeting-12345')).toBeVisible()` — zoom_join_url が表示されていること
     5. JST 時刻検証: `await expect(page.locator('dd').filter({ hasText: /\d{1,2}:\d{2}\s*-\s*\d{2}:\d{2}/ })).toBeVisible()` — "HH:MM - HH:MM" 形式の時刻表示があること
     6. 日付検証: `await expect(page.locator('dd').filter({ hasText: /\d{4}年\d{1,2}月\d{1,2}日/ })).toBeVisible()` — 日本語日付フォーマット
     7. キャンセルリンク検証: `await expect(page.getByText('予約をキャンセルする')).toBeVisible()` — キャンセルリンクが存在すること
     8. キャンセルリンクの href に cancel_token が含まれることを確認: `await expect(page.getByText('予約をキャンセルする')).toHaveAttribute('href', new RegExp('/guest/cancel/'))`

4. `test.describe('ゲストキャンセルフロー')`:
   - `test('キャンセルページ表示→確認→キャンセル完了')`:
     1. `const tokens = loadE2ETokens()` — ファイルがなければ `test.skip()`
     2. `/api/guest/cancel/**` DELETE を page.route() でモック: `{ success: true, message: '予約をキャンセルしました' }` を status 200 で返す
     3. `page.goto('/guest/cancel/' + tokens.cancel_token)` — Server Component が JWT 検証 → DB からデータ取得 → CancelPageClient 表示
     4. `await expect(page.getByText('予約のキャンセル')).toBeVisible()` — h1 表示確認
     5. 予約詳細が表示されていること: `await expect(page.getByText('E2E テストゲスト')).toBeVisible()` — guest_name が表示
     6. 「予約をキャンセル」ボタンをクリック: `await page.getByRole('button', { name: '予約をキャンセル' }).click()`
     7. AlertDialog が表示: `await expect(page.getByText('予約をキャンセルしますか?')).toBeVisible()`
     8. 「キャンセルする」をクリック: `await page.getByRole('button', { name: 'キャンセルする' }).click()`
     9. キャンセル完了: `await expect(page.getByText('キャンセルが完了しました')).toBeVisible()` — CancelPageClient の isCanceled=true 状態

**注意事項:**
- SlotPicker には data-testid がないため、時刻テキスト（"10:00" 等）で button を特定する
- `/api/public/slots/week` のレスポンス形式は `{ slots: { "YYYY-MM-DD": [...] } }` のオブジェクト形式
- success ページとキャンセルページの表示テストは global-setup で挿入した実 DB データに依存する。global-setup が失敗した場合は test.skip() でスキップする
- キャンセルページの Server Component は `verifyCancelToken()` で JWT を検証し、`booking.guest_email` と payload.email を照合する。global-setup で生成した cancel_token は同じ email ('e2e-guest@example.com') で署名されているため検証をパスする
- CancelConfirmDialog の DELETE API 呼び出し (`/api/guest/cancel/${token}`) は Client Component 内の fetch なので page.route() でモック可能
  </action>
  <verify>
    <automated>cd /Users/kugyu10/work/かずみん/Time-with-Kazumin && test -f e2e/specs/booking-flow.spec.ts && grep -c "test(" e2e/specs/booking-flow.spec.ts && npx playwright test e2e/specs/booking-flow.spec.ts --project=chromium 2>&1 | tail -5</automated>
  </verify>
  <done>booking-flow.spec.ts が存在し、以下の3カテゴリのテストが記述されている: (1) ゲスト予約フロー（スロット選択→情報入力→成功URL遷移）、(2) 予約完了画面のZoom URL + JST時刻表示検証、(3) キャンセルフロー（ページ表示→確認ダイアログ→API呼び出し→完了表示）。外部APIは全て page.route() でモック化されており、success/cancel ページの Server Component 表示は global-setup で挿入した実DBデータで検証する。</done>
</task>

</tasks>

<verification>
- `ls e2e/specs/booking-flow.spec.ts` でファイル存在確認
- `grep "page.route" e2e/specs/booking-flow.spec.ts` で page.route() モックが設定されていること
- `grep "member_plans" e2e/global-setup.ts` で member_plans 挿入が追加されていること
- `grep "guest_token" e2e/global-setup.ts` でゲスト予約レコード挿入が追加されていること
- `grep "zoom.us" e2e/specs/booking-flow.spec.ts` で Zoom URL 検証テストが存在すること
- `grep "キャンセルが完了しました" e2e/specs/booking-flow.spec.ts` でキャンセル完了テストが存在すること
- `npx playwright test e2e/specs/booking-flow.spec.ts --project=chromium` でテスト実行（.env.test 設定済みの場合）
</verification>

<success_criteria>
- e2e/specs/booking-flow.spec.ts にゲスト予約フローの E2E テストが実装されている
- 外部 API（slots/week, guest/bookings, public/settings, guest/cancel）が page.route() でモック化されている
- success ページに直接アクセスして Zoom URL（'https://zoom.us/j/e2e-mock-meeting-12345'）が表示されることを検証するテストがある
- success ページに直接アクセスして JST 時刻（日本語フォーマットの日付 + "HH:MM - HH:MM" 時間）が表示されることを検証するテストがある
- キャンセルフローの完全なテスト（ページ表示→確認ダイアログ→キャンセルAPIモック→完了表示）がある
- global-setup.ts に member_plans 挿入 + ゲスト予約レコード挿入 + cancel_token 生成ロジックが追加されている
- テストは `npx playwright test e2e/specs/booking-flow.spec.ts --project=chromium` で実行可能
</success_criteria>

<output>
After completion, create `.planning/phases/10-test-scenarios/10-test-scenarios-01-SUMMARY.md`
</output>
