---
phase: 10-test-scenarios
plan: 02
type: execute
wave: 2
depends_on: [10-test-scenarios-01]
files_modified:
  - e2e/specs/auth.spec.ts
  - e2e/specs/member-booking.spec.ts
autonomous: true
requirements: [E2E-03, E2E-04]

must_haves:
  truths:
    - "会員がメール/パスワードでログインしてダッシュボードにリダイレクトされることをテストで検証できる"
    - "未認証ユーザーが /login へリダイレクトされることをテストで検証できる"
    - "会員予約フロー（メニュー選択→スロット選択→確認→予約確定→ダッシュボードリダイレクト）のテストがパスする"
    - "予約前後のポイント残高の変化が確認できる"
    - "Zoom/Calendar/Resend の実API呼び出しは page.route() でモック化されている"
  artifacts:
    - path: "e2e/specs/auth.spec.ts"
      provides: "会員ログインフロー E2E テスト"
      min_lines: 20
    - path: "e2e/specs/member-booking.spec.ts"
      provides: "会員予約フロー E2E テスト"
      min_lines: 60
  key_links:
    - from: "e2e/specs/auth.spec.ts"
      to: "e2e/fixtures.ts"
      via: "import { test, expect } from '../fixtures'"
      pattern: "from.*fixtures"
    - from: "e2e/specs/member-booking.spec.ts"
      to: "/api/bookings"
      via: "page.route() モック"
      pattern: "route.*api/bookings"
    - from: "e2e/specs/member-booking.spec.ts"
      to: "e2e/fixtures.ts"
      via: "memberPage フィクスチャ"
      pattern: "memberPage"
---

<objective>
会員ログインフロー（E2E-03）と会員予約フロー（E2E-04）のE2Eテストを実装する。

Purpose: E2E-03、E2E-04 要件を満たし、認証済み会員の予約回帰テストを確立する
Output: e2e/specs/auth.spec.ts、e2e/specs/member-booking.spec.ts
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-playwright-foundation/09-playwright-foundation-02-SUMMARY.md
@.planning/phases/10-test-scenarios/10-RESEARCH.md
@.planning/phases/10-test-scenarios/10-test-scenarios-01-SUMMARY.md

<interfaces>
<!-- Phase 9 で構築済みの E2E 基盤 -->

From e2e/fixtures.ts:
```typescript
import { test as base, type Page } from '@playwright/test'
type AuthFixtures = { memberPage: Page; adminPage: Page }
export const test = base.extend<AuthFixtures>({
  memberPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth/member.json'),
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  // adminPage 同様
})
export { expect } from '@playwright/test'
```

From e2e/auth.setup.ts:
```typescript
// /login で メールアドレス/パスワード入力 → /bookings/new へリダイレクト → storageState 保存
```

<!-- 会員予約フローの重要セレクタ -->

BookingNewPage (/bookings/new) — Client Component:
- Step 1: MenuSelect コンポーネント。メニューは Card コンポーネントで表示。
  - カード内テキスト: `menu.name`（例: "テストメニュー"）、`menu.duration_minutes + "分"`、`menu.points_required + "ポイント"`
  - メニュー選択は Card の onClick
  - 「次へ」ボタン: `page.getByRole('button', { name: '次へ' })`
- Step 2: SlotPicker（ゲストと同じ）
  - 「確認画面へ」ボタン: `page.getByRole('button', { name: '確認画面へ' })`
- API: Supabase client で直接 meeting_menus、weekly_schedules を取得
- API: GET `/api/public/settings` → `{ booking_min_hours_ahead }`

BookingConfirmPage (/bookings/confirm) — Client Component:
- BookingConfirm コンポーネント
  - `<h2>予約内容の確認</h2>` (CardTitle)
  - メニュー名、日時、消費ポイント、残高表示
  - 「予約する」ボタン: `page.getByRole('button', { name: '予約する' })`
  - 「戻る」ボタン
- API: Supabase client で menu, member_plans を取得
- API: POST `/api/bookings` → Saga パターン → `{ booking: { id, start_time, zoom_join_url, meeting_menus } }`
- 成功時: `router.push("/dashboard?booking_success=true")`

DashboardPage (/dashboard) — Server Component:
- `<h1>{name}さん</h1>` or `<h1>こんにちは</h1>`
- `<p>かずみんとの時間を予約しましょう</p>`
- PointBalance コンポーネント: `<span class="text-3xl font-bold">{currentPoints}</span>` + "ポイント"
- member_plans.current_points を Supabase server client で直接取得

LoginPage (/login):
- `label: メールアドレス`、`label: パスワード`
- `button: メールアドレスでログイン`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: 会員ログインフロー E2E テスト実装</name>
  <files>e2e/specs/auth.spec.ts</files>
  <action>
`e2e/specs/auth.spec.ts` を作成する。**必ず `../fixtures` から test, expect を import する**（`@playwright/test` ではない）。

**テスト構成:**

1. `test.describe('会員ログインフロー')`:

   - `test('memberPage フィクスチャで認証済みページにアクセスできる')`:
     - `{ memberPage }` フィクスチャを使用
     - `memberPage.goto('/dashboard')` でダッシュボードに移動
     - `/login` にリダイレクトされないことを確認: `await expect(memberPage).not.toHaveURL(/\/login/)`
     - ダッシュボードのコンテンツが表示されることを確認: `await expect(memberPage.getByText('かずみんとの時間を予約しましょう')).toBeVisible()`

   - `test('未認証ユーザーは /login へリダイレクトされる')`:
     - `{ page }` を使用（認証なしの素の page）
     - `page.goto('/dashboard')` でダッシュボードに移動
     - `/login` にリダイレクトされることを確認: `await expect(page).toHaveURL(/\/login/)`

   - `test('認証済み会員は /bookings/new にアクセスできる')`:
     - `{ memberPage }` フィクスチャを使用
     - `memberPage.goto('/bookings/new')` で予約ページに移動
     - `/login` にリダイレクトされないことを確認
     - 「メニューを選択」テキストが表示されることを確認

**注意:**
- `import { test, expect } from '../fixtures'` を使うこと（Pitfall 6 対策）
- memberPage は storageState で認証済みなので、ログイン操作は不要
  </action>
  <verify>
    <automated>cd /Users/kugyu10/work/かずみん/Time-with-Kazumin && test -f e2e/specs/auth.spec.ts && grep -c "from.*fixtures" e2e/specs/auth.spec.ts</automated>
  </verify>
  <done>auth.spec.ts が存在し、fixtures.ts から import している。認証済み/未認証の両方のテストケースがある。</done>
</task>

<task type="auto">
  <name>Task 2: 会員予約フロー E2E テスト実装</name>
  <files>e2e/specs/member-booking.spec.ts</files>
  <action>
`e2e/specs/member-booking.spec.ts` を作成する。**必ず `../fixtures` から test, expect を import する。**

**重要な設計方針:**
- `/bookings/new` は Client Component で Supabase client から直接 `meeting_menus` と `weekly_schedules` を取得する
- これらは page.route() でモックできない（Supabase JS SDK は WebSocket/REST で直接通信するため、fetch 以外の方法で通信する場合がある）
- ただし、Supabase JS client は内部的に fetch API を使用するため、Supabase REST API エンドポイント (`**/rest/v1/**`) を page.route() でモックする方法も考えられる
- **最もシンプルなアプローチ:** テスト DB に実データ（meeting_menus, weekly_schedules, member_plans）が存在する前提でテストを実行する。もし DB にデータがない場合はテストをスキップする
- `/api/bookings` POST（Saga パターン）のみ page.route() でモックする
- `/api/public/settings` も page.route() でモックする（booking_min_hours_ahead: 0）
- `/dashboard` は Server Component のためポイント残高は実 DB の値が表示される

**テスト構成:**

1. `test.describe('会員予約フロー')`:

   - `test.beforeEach`:
     - `memberPage.route('**/api/public/settings', ...)` で `{ booking_min_hours_ahead: 0 }` を返す
     - `memberPage.route('**/api/bookings', ...)` で POST メソッドのみモック:
       ```
       status: 201
       body: { booking: { id: 1001, start_time: '2026-04-01T01:00:00.000Z', zoom_join_url: 'https://zoom.us/j/e2e-mock', meeting_menus: { name: 'E2E テストメニュー' } } }
       ```
       POST 以外は `route.continue()`

   - `test('メニュー選択→スロット選択→確認→ダッシュボード遷移')`:
     1. `memberPage.goto('/bookings/new')` で予約ページに移動
     2. 「メニューを選択」テキストが表示されるまで待機
     3. メニューカードをクリック: 最初のカード要素をクリックする。MenuSelect は Card コンポーネントで表示されるため `memberPage.locator('.cursor-pointer').first().click()` で最初のメニューを選択
     4. 「次へ」ボタンをクリック: `memberPage.getByRole('button', { name: '次へ' }).click()`
     5. Step 2: SlotPicker が表示される。「日時を選択」テキスト確認
     6. `/api/public/slots/week*` を page.route() でモック（beforeEach ではなくここで設定。理由: SlotPicker は Step 2 描画時に fetch するため、Step 2 表示前にモックを仕込む必要がある）
        - 実際には beforeEach で設定しておく方が安全。SlotPicker のスロット fetch は useEffect で行われるため、ページ遷移後すぐに発火する
        - **修正:** beforeEach に `memberPage.route('**/api/public/slots/week*', ...)` も追加する
     7. スロットボタン（時刻テキスト）をクリック
     8. 「確認画面へ」ボタンをクリック: `memberPage.getByRole('button', { name: '確認画面へ' }).click()`
     9. 確認ページ遷移を確認: `await expect(memberPage).toHaveURL(/\/bookings\/confirm/)`
     10. 「予約内容の確認」テキストが表示されることを確認
     11. 「予約する」ボタンをクリック: `memberPage.getByRole('button', { name: '予約する' }).click()`
     12. ダッシュボードへリダイレクト: `await expect(memberPage).toHaveURL(/\/dashboard/)`

   **注意:** ポイント残高の変化テストについて:
   - ダッシュボードは Server Component で実 DB のポイントを表示する
   - `/api/bookings` POST をモックしているため、実際にはポイントは消費されない
   - ポイント残高の「表示」自体は検証可能（PointBalance コンポーネントの存在確認）
   - ポイント「変化」の検証は、モック環境では不可能（実 DB を変更しないため）
   - **対応:** ポイント残高の表示が存在することを確認するテストを追加する。実際のポイント消費テストは実 API テスト（将来の統合テスト）で対応

   - `test('ダッシュボードにポイント残高が表示される')`:
     1. `memberPage.goto('/dashboard')`
     2. `memberPage.getByText('ポイント残高')` が visible であることを確認
     3. `memberPage.locator('text=/\\d+/').first()` でポイント数値が表示されていることを確認
     - 注意: PointBalance は `<span class="text-3xl font-bold">{currentPoints}</span>` で表示。member_plans が global-setup で挿入されているため、100 ポイントが表示されるはず
     - `memberPage.getByText('100')` で確認（global-setup で設定した値）

**重要: `/bookings/new` の Supabase 直接クエリについて:**
- `/bookings/new` (Client Component) は `createClient()` で Supabase に直接接続して `meeting_menus` と `weekly_schedules` を取得する
- これはブラウザの fetch API を使って Supabase REST API を呼ぶ
- `page.route('**/rest/v1/meeting_menus*', ...)` でモック可能だが、Supabase URL が環境変数依存のため URL パターンが不確定
- **最もシンプルなアプローチ:** テスト DB に実データが存在する前提。DB にメニューが1件もなければ「メニューを選択」の下にメニューカードが表示されない → テストが失敗する → これは期待通りの動作（テスト環境の問題として検出される）
  </action>
  <verify>
    <automated>cd /Users/kugyu10/work/かずみん/Time-with-Kazumin && test -f e2e/specs/member-booking.spec.ts && grep -c "memberPage" e2e/specs/member-booking.spec.ts</automated>
  </verify>
  <done>member-booking.spec.ts が存在し、memberPage フィクスチャを使用している。メニュー選択→スロット選択→確認→ダッシュボード遷移のテストと、ポイント残高表示テストが記述されている。外部 API（/api/bookings POST）は page.route() でモック化されている。</done>
</task>

</tasks>

<verification>
- `ls e2e/specs/auth.spec.ts e2e/specs/member-booking.spec.ts` でファイル存在確認
- `grep "from.*fixtures" e2e/specs/auth.spec.ts e2e/specs/member-booking.spec.ts` で fixtures から import していること
- `grep "memberPage" e2e/specs/member-booking.spec.ts` で memberPage フィクスチャ使用を確認
- `grep "page.route" e2e/specs/member-booking.spec.ts` で page.route() モックが設定されていること
- `npm run test:e2e` で全テスト実行（.env.test 設定済み + テスト DB にデータがある場合）
</verification>

<success_criteria>
- e2e/specs/auth.spec.ts に認証済み/未認証の E2E テストが実装されている
- e2e/specs/member-booking.spec.ts に会員予約フローの E2E テストが実装されている
- 両ファイルとも `../fixtures` から test/expect を import している
- /api/bookings POST が page.route() でモック化されている
- ポイント残高の表示テストが含まれている
- `npm run test:e2e` で全テスト実行可能
</success_criteria>

<output>
After completion, create `.planning/phases/10-test-scenarios/10-test-scenarios-02-SUMMARY.md`
</output>
