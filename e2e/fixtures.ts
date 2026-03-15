import { test as base, type Page } from '@playwright/test'
import path from 'path'

type AuthFixtures = {
  memberPage: Page
  adminPage: Page
}

export const test = base.extend<AuthFixtures>({
  memberPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth/member.json'),
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth/admin.json'),
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
