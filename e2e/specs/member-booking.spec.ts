import { test, expect } from '../fixtures'

// ヘルパー: SlotPickerの表示範囲（今週の月曜から7日間）内にある平日を YYYY-MM-DD で返す
//
// 日付は必ずローカルタイムで整形する。SlotPickerは formatDateLocal（ローカル）で
// 日付キーを組み立てるため、toISOString()（UTC）を使うとJSTの09:00前に1日ずれて
// どの表示日にも一致しなくなる。
function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getNextWeekday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // SlotPickerと同じ「今週の月曜日」
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // 今週の月〜金のうち、明日以降で最も早い日を選ぶ
  for (let i = 0; i < 5; i++) {
    const candidate = new Date(monday)
    candidate.setDate(monday.getDate() + i)
    if (candidate > today) {
      return formatDateLocal(candidate)
    }
  }

  // 金・土・日は未来の平日が今週内に無いため今週の金曜へフォールバックする
  // （スロットAPIはモックしているため過去日でも表示・選択できる）
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return formatDateLocal(friday)
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
    await memberPage.getByRole('main').getByRole('button', { name: '予約する' }).click()

    // ダッシュボードへリダイレクト
    await expect(memberPage).toHaveURL(/\/dashboard/)
  })

  test('ダッシュボードにポイント残高が表示される', async ({ memberPage }) => {
    await memberPage.goto('/dashboard')

    // ポイント残高が表示されること
    await expect(memberPage.getByText('ポイント残高')).toBeVisible()

    // global-setup で設定した 100 ポイントが表示されること
    await expect(memberPage.getByRole('main').getByText('100')).toBeVisible()
  })
})
