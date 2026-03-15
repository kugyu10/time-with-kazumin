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
    - "予約完了画面でJST時刻が表示されていることをテストで検証できる"
    - "ゲストキャンセルフロー（キャンセルページ→確認→完了）のE2Eテストがパスする"
    - "Zoom/Calendar/Resend の実API呼び出しは page.route() でモック化されている"
  artifacts:
    - path: "e2e/specs/booking-flow.spec.ts"
      provides: "ゲスト予約フローE2Eテスト"
      min_lines: 80
    - path: "e2e/global-setup.ts"
      provides: "テスト用member_plans・weekly_schedulesデータ挿入"
      contains: "member_plans"
  key_links:
    - from: "e2e/specs/booking-flow.spec.ts"
      to: "/api/guest/bookings"
      via: "page.route() モック"
      pattern: "page\\.route.*guest/bookings"
    - from: "e2e/specs/booking-flow.spec.ts"
      to: "/api/public/slots/week"
      via: "page.route() モック"
      pattern: "page\\.route.*slots/week"
---

<objective>
ゲスト予約フロー（スロット選択→情報入力→予約完了→キャンセル）のE2Eテストを実装する。

Purpose: E2E-02 要件を満たし、ゲスト予約の回帰テストを確立する
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

Success page (Server Component):
- DB から guest_token で booking を取得して表示
- `<h1>ご予約ありがとうございます</h1>`
- Zoom URL: `<a href={zoom_join_url}>` で表示
- JST 時刻: toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
- キャンセルリンク: `<a href="/guest/cancel/{cancel_token}">予約をキャンセルする</a>`

CancelPageClient.tsx:
- `<h1>予約のキャンセル</h1>`
- CancelConfirmDialog コンポーネント
- 完了後: `<h1>キャンセルが完了しました</h1>`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: global-setup.ts 拡張と specs ディレクトリ作成</name>
  <files>e2e/global-setup.ts</files>
  <action>
e2e/global-setup.ts を拡張して以下を追加する:

1. **member_plans 挿入**（会員テストユーザー作成の直後）:
   - まず `plans` テーブルから `is_active=true` のプランを1件取得する
   - プランが存在する場合、`member_plans` テーブルに upsert する:
     - `user_id`: memberData.user.id
     - `plan_id`: 取得したプラン ID
     - `status`: 'active'
     - `current_points`: 100（テスト用に十分なポイント）
     - `monthly_points`: 10
   - プランが存在しない場合は console.warn でログ出力（テストは続行）

2. **weekly_schedules 存在確認**:
   - `weekly_schedules` テーブルの件数を確認
   - 0件の場合は console.warn で「weekly_schedules が空です。スロット表示テストが失敗する可能性があります」を出力

3. **e2e/specs/ ディレクトリ作成**:
   - `mkdir -p e2e/specs` を実行して specs ディレクトリを作成（既存なら何もしない）

既存の profiles upsert ロジックは変更しない。追加のみ。
  </action>
  <verify>
    <automated>cd /Users/kugyu10/work/かずみん/Time-with-Kazumin && grep -c "member_plans" e2e/global-setup.ts && test -d e2e/specs</automated>
  </verify>
  <done>global-setup.ts に member_plans 挿入ロジックが追加され、e2e/specs/ ディレクトリが存在する</done>
</task>

<task type="auto">
  <name>Task 2: ゲスト予約フロー E2E テスト実装</name>
  <files>e2e/specs/booking-flow.spec.ts</files>
  <action>
`e2e/specs/booking-flow.spec.ts` を作成する。`@playwright/test` から直接 import する（ゲストテストは認証不要）。

**重要な設計方針:**
- ゲスト予約の success ページは Server Component で Supabase DB に直接アクセスするため、page.route() では傍受できない
- そのため、success ページの検証は「フロー全体テスト」として `/api/guest/bookings` POST をモックしつつ、実際に DB に booking を挿入するアプローチではなく、クエリパラメータ付きの success ページ遷移後に Server Component が DB から取得するデータに依存する
- 解決策: `/api/guest/bookings` POST モックが返す `guest_token` と `cancel_token` を使って success ページへ遷移するが、success ページ自体は Server Component のため DB にデータがなければ「予約が見つかりません」が表示される。これを踏まえて、テストは以下の2段階で検証する:
  A) フロー遷移テスト: スロット選択→情報入力→送信→success ページ URL への遷移を検証
  B) success ページ表示テスト: テスト DB に実データがある場合のみスキップ可能とし、URL 遷移の検証をメインとする

**テスト構成:**

1. `test.describe('ゲスト予約フロー')`:
   - `test.beforeEach`: 以下の page.route() モックを設定
     - `**/api/public/settings` → `{ booking_min_hours_ahead: 0 }`
     - `**/api/public/slots/week*` → 2日後の日付で available=true のスロット3件を返す。スロットの startTime/endTime は ISO 文字列（例: `2026-04-01T01:00:00.000Z`）。日付は動的に計算する（`new Date()` + 2日後の月曜日を基準）
     - `**/api/guest/bookings` (POST) → `{ booking_id: 9999, guest_token: 'e2e-guest-token', cancel_token: 'e2e-cancel-token' }` を status 201 で返す

   - `test('スロット選択→情報入力→予約完了URLへ遷移')`:
     1. `page.goto('/guest/booking')`
     2. `page.getByText('日時を選択')` が visible であることを確認（SlotPicker の h2）
     3. スロット API モックが返した時刻テキスト（例: "10:00"）の `<button>` をクリック: `page.locator('button').filter({ hasText: '10:00' }).first().click()`
     4. Step 2 に遷移: `page.getByText('情報入力')` が visible
     5. `page.getByLabel('お名前')` に 'テスト太郎' を fill
     6. `page.getByLabel('メールアドレス')` に 'test-e2e@example.com' を fill
     7. `page.getByRole('button', { name: '予約する' })` をクリック
     8. URL が `/guest/booking/success` を含むことを確認: `await expect(page).toHaveURL(/\/guest\/booking\/success/)`
     9. クエリパラメータに `token=e2e-guest-token` が含まれることを確認

   - `test('キャンセルフローのURLへ遷移できる')`:
     - キャンセルページ (`/guest/cancel/e2e-cancel-token`) を page.route() でモックするのは不可能（Server Component）
     - 代わりに、success ページのキャンセルリンクの href を検証する
     - ただし success ページは Server Component で DB アクセスするため、フロー全体テストの後にキャンセル API をモックしてテストする
     - `/api/guest/cancel/**` DELETE を page.route() でモック（`{ success: true }`）
     - キャンセルページ自体の表示は Server Component のため DB 依存。テストとしては、キャンセル API のモックが呼ばれることを `page.route()` の handler 内でフラグ管理して確認する、または `/guest/cancel/[token]` ページへの遷移を検証する

2. **ヘルパー関数:**
   - `getNextWeekMonday()`: テスト用の日付を動的に計算する関数。現在日時から次の月曜日を計算し YYYY-MM-DD 形式で返す
   - `createSlotsResponse(dateStr: string)`: 指定日付のスロット3件（10:00, 10:30, 11:00 JST）を返す

**注意事項:**
- SlotPicker には data-testid がないため、時刻テキスト（"10:00" 等）で button を特定する
- `/api/public/slots/week` のレスポンス形式は `{ slots: { "YYYY-MM-DD": [...] } }` のオブジェクト形式
- スロットの startTime は ISO 文字列（例: "2026-04-01T01:00:00+09:00"）だが、SlotPicker は extractTime() で "HH:MM" 部分のみ表示する
  </action>
  <verify>
    <automated>cd /Users/kugyu10/work/かずみん/Time-with-Kazumin && test -f e2e/specs/booking-flow.spec.ts && grep -c "test(" e2e/specs/booking-flow.spec.ts</automated>
  </verify>
  <done>booking-flow.spec.ts が存在し、ゲスト予約フロー（スロット選択→情報入力→成功URL遷移）とキャンセルフローのテストが記述されている。外部APIは全て page.route() でモック化されている。</done>
</task>

</tasks>

<verification>
- `ls e2e/specs/booking-flow.spec.ts` でファイル存在確認
- `grep "page.route" e2e/specs/booking-flow.spec.ts` で page.route() モックが設定されていること
- `grep "member_plans" e2e/global-setup.ts` で member_plans 挿入が追加されていること
- `npx playwright test e2e/specs/booking-flow.spec.ts --project=chromium` でテスト実行（.env.test 設定済みの場合）
</verification>

<success_criteria>
- e2e/specs/booking-flow.spec.ts にゲスト予約フローの E2E テストが実装されている
- 外部 API（slots/week, guest/bookings, public/settings）が page.route() でモック化されている
- global-setup.ts に member_plans 挿入ロジックが追加されている（Plan 02 の前提条件）
- テストは `npx playwright test e2e/specs/booking-flow.spec.ts --project=chromium` で実行可能
</success_criteria>

<output>
After completion, create `.planning/phases/10-test-scenarios/10-test-scenarios-01-SUMMARY.md`
</output>
