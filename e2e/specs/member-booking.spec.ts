import { test, expect } from '../fixtures'

// ヘルパー: 2日後の平日を YYYY-MM-DD 形式で返す
function getNextWeekday(): string {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  if (date.getDay() === 0) date.setDate(date.getDate() + 1)
  if (date.getDay() === 6) date.setDate(date.getDate() + 2)
  return date.toISOString().slice(0, 10)
}

// ヘルパー: 指定日付のスロット3件を返す
function createSlotsResponse(dateStr: string) {
  return {
    slots: {
      [dateStr]: [
        { date: dateStr, startTime: '10:00', endTime: '10:30', available: true },
        { date: dateStr, startTime: '10:30', endTime: '11:00', available: true },
        { date: dateStr, startTime: '11:00', endTime: '11:30', available: true },
      ],
    },
  }
}

test.describe('会員予約フロー', () => {
  test.beforeEach(async ({ memberPage }) => {
    const dateStr = getNextWeekday()

    await memberPage.route('**/api/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ booking_min_hours_ahead: 0 }),
      })
    })

    await memberPage.route('**/api/public/slots/week*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createSlotsResponse(dateStr)),
      })
    })

    await memberPage.route('**/api/bookings', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            booking: {
              id: 1001,
              start_time: '2026-04-01T01:00:00.000Z',
              zoom_join_url: 'https://zoom.us/j/e2e-mock',
              meeting_menus: { name: 'E2E テストメニュー' },
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

    // メニュー選択ステップが表示されること
    await expect(memberPage.getByText('メニューを選択')).toBeVisible()

    // 最初のメニューカードをクリック
    await memberPage.locator('.cursor-pointer').first().click()

    // 「次へ」ボタンをクリック
    await memberPage.getByRole('button', { name: '次へ' }).click()

    // Step 2: SlotPicker が表示されること
    await expect(memberPage.getByText('日時を選択')).toBeVisible()

    // スロットボタン "10:00" をクリック
    await memberPage.locator('button').filter({ hasText: '10:00' }).first().click()

    // 「確認画面へ」ボタンをクリック
    await memberPage.getByRole('button', { name: '確認画面へ' }).click()

    // 確認ページへ遷移したことを確認
    await expect(memberPage).toHaveURL(/\/bookings\/confirm/)

    // 「予約内容の確認」が表示されること
    await expect(memberPage.getByText('予約内容の確認')).toBeVisible()

    // 「予約する」ボタンをクリック
    await memberPage.getByRole('button', { name: '予約する' }).click()

    // ダッシュボードへリダイレクト
    await expect(memberPage).toHaveURL(/\/dashboard/)
  })

  test('ダッシュボードにポイント残高が表示される', async ({ memberPage }) => {
    await memberPage.goto('/dashboard')

    // ポイント残高が表示されること
    await expect(memberPage.getByText('ポイント残高')).toBeVisible()

    // global-setup で設定した 100 ポイントが表示されること
    await expect(memberPage.getByText('100')).toBeVisible()
  })
})
