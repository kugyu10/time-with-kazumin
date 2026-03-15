import { test, expect } from '../fixtures'

test.describe('会員ログインフロー', () => {
  test('memberPage フィクスチャで認証済みページにアクセスできる', async ({ memberPage }) => {
    await memberPage.goto('/dashboard')

    // /login にリダイレクトされないこと
    await expect(memberPage).not.toHaveURL(/\/login/)

    // ダッシュボードのコンテンツが表示されること
    await expect(memberPage.getByText('かずみんとの時間を予約しましょう')).toBeVisible()
  })

  test('未認証ユーザーは /login へリダイレクトされる', async ({ page }) => {
    await page.goto('/dashboard')

    // /login にリダイレクトされること
    await expect(page).toHaveURL(/\/login/)
  })

  test('認証済み会員は /bookings/new にアクセスできる', async ({ memberPage }) => {
    await memberPage.goto('/bookings/new')

    // /login にリダイレクトされないこと
    await expect(memberPage).not.toHaveURL(/\/login/)

    // メニュー選択テキストが表示されること
    await expect(memberPage.getByText('メニューを選択')).toBeVisible()
  })
})
