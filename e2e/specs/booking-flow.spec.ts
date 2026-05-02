import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ヘルパー: 今週の表示範囲内にある翌平日を YYYY-MM-DD 形式で返す
// SlotPickerは今週月曜日から7日間を表示するため、その範囲内の日付を返す
function getNextWeekday(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // 今週の月曜日を計算
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  // 今週の金曜日
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  // 明日が今週の範囲内（月〜日）であればそれを使う
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  // 土日ならその週の金曜に戻す
  if (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    return friday.toISOString().slice(0, 10)
  }
  return tomorrow.toISOString().slice(0, 10)
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

// ヘルパー: e2e-tokens.json を読み込む
function loadE2ETokens(): { guest_token: string; cancel_token: string } | null {
  const tokenPath = path.join(__dirname, '../.auth/e2e-tokens.json')
  if (!fs.existsSync(tokenPath)) {
    return null
  }
  try {
    const content = fs.readFileSync(tokenPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

test.describe('ゲスト予約フロー — 予約作成', () => {
  test.beforeEach(async ({ page }) => {
    const dateStr = getNextWeekday()

    await page.route('**/api/public/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ booking_min_hours_ahead: 0 }),
      })
    })

    await page.route('**/api/public/slots/week*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createSlotsResponse(dateStr)),
      })
    })

    await page.route('**/api/guest/bookings', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            booking_id: 9999,
            guest_token: 'e2e-test-guest-token',
            cancel_token: 'e2e-mock-cancel-token',
          }),
        })
      } else {
        await route.continue()
      }
    })
  })

  test('スロット選択→情報入力→予約完了URLへ遷移', async ({ page }) => {
    await page.goto('/guest/booking')

    // SlotPicker の h2 が表示されていること
    await expect(page.getByText('日時を選択')).toBeVisible()

    // スロットボタン "10:00" をクリック
    await page.locator('button').filter({ hasText: '10:00' }).first().click()

    // Step 2: フォーム入力
    await page.getByLabel('お名前').fill('テスト太郎')
    await page.getByLabel('メールアドレス').fill('test-e2e@example.com')

    // 予約する ボタンをクリック
    await page.getByRole('button', { name: '予約する' }).click()

    // success URL へ遷移したことを確認
    await expect(page).toHaveURL(/\/guest\/booking\/success/)

    // クエリパラメータに token=e2e-test-guest-token が含まれること
    await expect(page).toHaveURL(/token=e2e-test-guest-token/)
  })
})

test.describe('予約完了画面 — Zoom URL・JST時刻表示', () => {
  test('success ページに Zoom URL と JST 時刻が表示される', async ({ page }) => {
    const tokens = loadE2ETokens()
    if (!tokens) {
      test.skip(true, 'global-setup でゲスト予約レコードが作成されていません')
      return
    }

    await page.goto(`/guest/booking/success?token=e2e-test-guest-token&cancel_token=${tokens.cancel_token}`)

    // h1 表示確認
    await expect(page.getByText('ご予約ありがとうございます')).toBeVisible()

    // Zoom URL が表示されていること
    await expect(page.getByText('https://zoom.us/j/e2e-mock-meeting-12345')).toBeVisible()

    // JST 時刻 "HH:MM - HH:MM" 形式の時刻表示
    await expect(page.locator('dd').filter({ hasText: /\d{1,2}:\d{2}\s*-\s*\d{2}:\d{2}/ })).toBeVisible()

    // 日本語日付フォーマット
    await expect(page.locator('dd').filter({ hasText: /\d{4}年\d{1,2}月\d{1,2}日/ })).toBeVisible()

    // キャンセルリンクが存在すること
    await expect(page.getByText('予約をキャンセルする')).toBeVisible()

    // キャンセルリンクの href に /guest/cancel/ が含まれること
    await expect(page.getByText('予約をキャンセルする')).toHaveAttribute('href', new RegExp('/guest/cancel/'))
  })
})

test.describe('ゲストキャンセルフロー', () => {
  test('キャンセルページ表示→確認→キャンセル完了', async ({ page }) => {
    const tokens = loadE2ETokens()
    if (!tokens) {
      test.skip(true, 'global-setup でゲスト予約レコードが作成されていません')
      return
    }

    // /api/guest/cancel/** DELETE をモック
    await page.route('**/api/guest/cancel/**', async (route) => {
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

    // キャンセルページへ直接アクセス（Server Component が JWT 検証 → DB からデータ取得）
    await page.goto(`/guest/cancel/${tokens.cancel_token}`)

    // h1 表示確認
    await expect(page.getByText('予約のキャンセル')).toBeVisible()

    // 予約詳細（guest_name）が表示されていること
    await expect(page.getByText('E2E テストゲスト')).toBeVisible()

    // 「予約をキャンセル」ボタンをクリック
    await page.getByRole('button', { name: '予約をキャンセル' }).click()

    // AlertDialog が表示されること
    await expect(page.getByRole('heading', { name: '予約をキャンセルしますか?' })).toBeVisible()

    // 「キャンセルする」をクリック
    await page.getByRole('button', { name: 'キャンセルする' }).click()

    // キャンセル完了表示
    await expect(page.getByText('キャンセルが完了しました')).toBeVisible()
  })
})
