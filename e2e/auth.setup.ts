import { test as setup, expect } from '@playwright/test'
import path from 'path'

const memberAuthFile = path.join(__dirname, '.auth/member.json')
const adminAuthFile = path.join(__dirname, '.auth/admin.json')

setup('authenticate as member', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(process.env.E2E_MEMBER_EMAIL!)
  await page.getByLabel('パスワード').fill(process.env.E2E_MEMBER_PASSWORD!)
  await page.getByRole('button', { name: 'メールアドレスでログイン' }).click()
  await page.waitForURL('/bookings/new')
  await page.context().storageState({ path: memberAuthFile })
})

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('パスワード').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'メールアドレスでログイン' }).click()
  // 管理者もログイン後は /bookings/new にリダイレクトされる（LoginForm実装の動作）
  await page.waitForURL('/bookings/new')
  await page.context().storageState({ path: adminAuthFile })
})
