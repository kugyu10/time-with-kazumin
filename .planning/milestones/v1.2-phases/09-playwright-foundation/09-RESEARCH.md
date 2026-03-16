# Phase 9: Playwright基盤 - Research

**Researched:** 2026-03-15
**Domain:** Playwright E2E テスト基盤 / Vercel preview / Supabase dev 認証
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | Playwright環境が構築され、Vercel preview（developブランチ）+ Supabase dev環境を対象にテストが実行できる | playwright.config.ts デュアルモード設定、global-setup/teardown、storageState認証パターンで実現可能 |
</phase_requirements>

---

## Summary

Playwright 1.58.2 は Next.js 公式推奨 E2E フレームワークであり、`@playwright/test` パッケージ単体でインストール可能。プロジェクトの要件（Vercel preview + Supabase dev）を満たすには、**デュアルモード設定**（ローカル: webServer起動 / CI: Vercel preview URL直接接続）と、**project-dependencies パターン**による auth.setup.ts（storageState保存）が標準的なアプローチとなる。

テストユーザー管理には Supabase の `supabase.auth.admin.createUser()` / `deleteUser()` を service_role キーで呼び出す global-setup/teardown を実装する。セッションファイル（`e2e/.auth/*.json`）は `.gitignore` に追加して機密情報の誤コミットを防止する。

シリアル実行（`workers: 1`）は STATE.md の確定済み決定事項であり、Supabase dev 環境の接続数制限を回避するために必須。

**Primary recommendation:** `@playwright/test` の project-dependencies パターンで auth.setup.ts → テスト本体の順に実行し、global-setup/teardown で Supabase admin API によるテストユーザー管理を行う。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | E2E テスト実行エンジン | Next.js 公式推奨、STATE.md で確定済み |
| @supabase/supabase-js | ^2.97.0 (既存) | global-setup/teardown でテストユーザーCRUD | 既存プロジェクト依存関係を流用 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | (Node.js 標準 or --env-file) | .env.test から環境変数読み込み | global-setup 内で SUPABASE_SERVICE_ROLE_KEY を参照 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| project-dependencies パターン | globalSetup 関数 | project-dependencies の方が HTML report・trace に統合されるため採用 |
| UI ログイン（Supabase認証UI） | API ログイン（REST） | API の方が高速。ただし今回は `page.goto('/login')` + フォーム入力 → storageState 保存を採用（シンプルさ優先） |

**Installation:**
```bash
npm install --save-dev @playwright/test@1.58.2
npx playwright install chromium
```

---

## Architecture Patterns

### Recommended Project Structure

```
e2e/
├── .auth/                    # storageState ファイル（.gitignore 対象）
│   ├── member.json           # 会員ユーザーのセッション
│   └── admin.json            # 管理者ユーザーのセッション
├── fixtures.ts               # test.extend() によるカスタムフィクスチャ
├── auth.setup.ts             # storageState 保存（ログインUI操作）
├── global-setup.ts           # テストユーザー作成（Supabase admin API）
├── global-teardown.ts        # テストユーザー削除（Supabase admin API）
└── specs/                    # テストシナリオ（Phase 10 で追加）
playwright.config.ts          # プロジェクトルートに配置
```

### Pattern 1: デュアルモード設定（playwright.config.ts）

**What:** `process.env.CI` フラグで baseURL と webServer を切り替える
**When to use:** ローカル開発（Next.js dev server 起動）と CI（Vercel preview URL 直接接続）の両方をサポートする場合

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Supabase dev 接続数制限対策（STATE.md 確定済み）
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  // ローカルのみ: Next.js dev server を起動
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
      },
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),
})
```

### Pattern 2: global-setup.ts（テストユーザー作成）

**What:** Supabase `auth.admin.createUser()` で会員・管理者テストユーザーを作成
**When to use:** フェーズ開始時（全テスト実行前）に1回だけ実行

```typescript
// e2e/global-setup.ts
import { createClient } from '@supabase/supabase-js'

export default async function globalSetup() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service_role キーが必須
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 会員テストユーザー作成
  await supabase.auth.admin.createUser({
    email: process.env.E2E_MEMBER_EMAIL!,
    password: process.env.E2E_MEMBER_PASSWORD!,
    email_confirm: true, // 確認メール不要
    user_metadata: { name: 'E2E Test Member' },
  })

  // 管理者テストユーザー作成
  const { data: adminUser } = await supabase.auth.admin.createUser({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
    email_confirm: true,
  })

  // app_metadata に role: 'admin' を付与
  if (adminUser?.user) {
    await supabase.auth.admin.updateUserById(adminUser.user.id, {
      app_metadata: { role: 'admin' },
    })
  }
}
```

### Pattern 3: global-teardown.ts（テストユーザー削除）

```typescript
// e2e/global-teardown.ts
import { createClient } from '@supabase/supabase-js'

export default async function globalTeardown() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // メールアドレスでユーザーを検索して削除
  const emails = [
    process.env.E2E_MEMBER_EMAIL!,
    process.env.E2E_ADMIN_EMAIL!,
  ]

  for (const email of emails) {
    const { data } = await supabase.auth.admin.listUsers()
    const user = data?.users.find((u) => u.email === email)
    if (user) {
      await supabase.auth.admin.deleteUser(user.id)
    }
  }
}
```

### Pattern 4: auth.setup.ts（storageState 保存）

**What:** ログインページで実際にログインし、storageState をファイルに保存
**When to use:** global-setup 後、テスト本体の前（project-dependencies で自動実行）

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const memberAuthFile = path.join(__dirname, '.auth/member.json')
const adminAuthFile = path.join(__dirname, '.auth/admin.json')

setup('authenticate as member', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(process.env.E2E_MEMBER_EMAIL!)
  await page.getByLabel('パスワード').fill(process.env.E2E_MEMBER_PASSWORD!)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.waitForURL('/bookings/new')
  await page.context().storageState({ path: memberAuthFile })
})

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('パスワード').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await page.waitForURL('/bookings/new') // または /admin
  await page.context().storageState({ path: adminAuthFile })
})
```

### Pattern 5: fixtures.ts（カスタムフィクスチャ）

```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test'
import path from 'path'

type AuthFixtures = {
  memberPage: typeof base
  adminPage: typeof base
}

export const test = base.extend<AuthFixtures>({
  memberPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, '.auth/member.json'),
    })
    const page = await ctx.newPage()
    await use(page as any)
    await ctx.close()
  },
})

export { expect } from '@playwright/test'
```

### Pattern 6: package.json スクリプト

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report"
  }
}
```

### Anti-Patterns to Avoid

- **毎テストでログインを実行する:** storageState を再利用せず毎回 UI ログインするとテストが遅くなる。auth.setup.ts で1回だけ実行し storageState を保存する。
- **service_role キーを e2e テストファイル内にハードコードする:** 環境変数（`.env.test` / GitHub Secrets）経由で渡す。
- **`e2e/.auth/*.json` を git commit する:** セッション情報が含まれるため `.gitignore` に追加必須。
- **`workers > 1` でのシリアル依存テスト:** Supabase dev 環境の接続数制限・テストユーザー競合を招く。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ブラウザ操作の自動化 | カスタムスクリプト | `@playwright/test` | クロスブラウザ・待機・リトライが組み込み済み |
| テストユーザー作成 | SQL 直接実行 or 自前 HTTP クライアント | `supabase.auth.admin.createUser()` | RLS バイパス・email_confirm 設定・app_metadata 設定を1コールで完結 |
| storageState の形式管理 | カスタム JSON 設計 | Playwright 標準 `page.context().storageState()` | Cookie + localStorage を正しい形式で自動シリアライズ |
| Vercel preview URL 取得 | カスタム Vercel API 呼び出し | `patrickedqvist/wait-for-vercel-preview@v1.3.3` (Phase 11) | デプロイ完了待ち + URL 取得を統合（Phase 11 対象） |

**Key insight:** Playwright の project-dependencies パターンで setup → test の依存関係を宣言するだけで、Playwright が実行順序・storageState の受け渡しを自動管理する。手動オーケストレーション不要。

---

## Common Pitfalls

### Pitfall 1: Vercel Deployment Protection によるブロック

**What goes wrong:** Vercel preview URL に Deployment Protection（パスワード or Vercel 認証）が有効だと、Playwright が認証画面でブロックされてテストが実行できない
**Why it happens:** Vercel のデフォルト設定では preview deployment に認証が有効な場合がある
**How to avoid:** STATE.md に記載の「Phase 9 実装前に Vercel dashboard で develop ブランチの Deployment Protection 設定を確認・無効化」を最初に実施
**Warning signs:** `page.goto()` が /login に遷移せず Vercel の認証ページに到達する

### Pitfall 2: .env.test 未設定による global-setup 失敗

**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY`、`E2E_MEMBER_EMAIL` 等が未設定で global-setup がクラッシュする
**Why it happens:** Playwright は Next.js の `.env.local` を自動読み込みしない
**How to avoid:** `playwright.config.ts` の先頭で `dotenv.config({ path: '.env.test' })` または `require('dotenv').config()` を呼び出す。または `--env-file` オプションを使用
**Warning signs:** `Error: Missing SUPABASE_SERVICE_ROLE_KEY environment variable`

### Pitfall 3: storageState の `e2e/.auth/` ディレクトリ不在

**What goes wrong:** `e2e/.auth/member.json` への書き込み時にディレクトリが存在せずエラーになる
**Why it happens:** git は空ディレクトリを追跡しないため、`.gitignore` で `e2e/.auth/` を除外すると git clone 後にディレクトリが存在しない
**How to avoid:** global-setup.ts 内か auth.setup.ts 内で `fs.mkdirSync(path.join(__dirname, '.auth'), { recursive: true })` を実行
**Warning signs:** `ENOENT: no such file or directory, open 'e2e/.auth/member.json'`

### Pitfall 4: 管理者ユーザーの role 付与漏れ

**What goes wrong:** createUser だけでは `app_metadata.role` が設定されず、管理画面への認可チェックが失敗する
**Why it happens:** Supabase の `createUser()` は user_metadata のみ設定可能で `app_metadata` は別途 `updateUserById()` が必要
**How to avoid:** global-setup.ts で createUser 後に `auth.admin.updateUserById(id, { app_metadata: { role: 'admin' } })` を実行
**Warning signs:** 管理者でログインしても `/admin` が 403 または /login にリダイレクトされる

### Pitfall 5: LoginForm のセレクタ特定

**What goes wrong:** auth.setup.ts で `page.getByLabel('メールアドレス')` が要素を見つけられない
**Why it happens:** LoginForm コンポーネントの `<label>` テキストや `for` 属性を確認していない
**How to avoid:** 実装前に `src/components/auth/LoginForm.tsx` の実際の label テキストを確認し、セレクタを合わせる
**Warning signs:** `Error: locator.fill: Error: strict mode violation` または タイムアウト

---

## Code Examples

Verified patterns from official sources:

### playwright.config.ts（最小構成）

```typescript
// playwright.config.ts
// Source: https://playwright.dev/docs/test-configuration
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/member.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
      },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
})
```

### Supabase admin createUser

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-createuser
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@email.com',
  password: 'password',
  email_confirm: true,
  user_metadata: { name: 'Test User' },
})
```

### storageState 保存

```typescript
// Source: https://playwright.dev/docs/auth
const memberAuthFile = 'e2e/.auth/member.json'

setup('authenticate as member', async ({ page }) => {
  await page.goto('/login')
  // ... ログイン操作 ...
  await page.context().storageState({ path: memberAuthFile })
})
```

### .gitignore への追加

```gitignore
# Playwright auth state
e2e/.auth/
playwright-report/
test-results/
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `globalSetup` 関数のみ | project-dependencies + `globalSetup` の組み合わせ | Playwright v1.31+ | setup が HTML report・trace に統合され可視化が向上 |
| `playwright/test` ディレクトリ規約 | `e2e/` ディレクトリ（自由配置） | - | プロジェクト側で `testDir` を指定 |

**Deprecated/outdated:**
- `globalSetup` のみで auth を行うパターン: project-dependencies 方式の方が推奨（トレース・レポート統合）

---

## Open Questions

1. **LoginForm の label テキスト確認**
   - What we know: `src/components/auth/LoginForm.tsx` に LoginForm が存在し、`/login` ページで使用されている
   - What's unclear: `<label>` の実際のテキスト（「メールアドレス」「パスワード」「ログイン」等）を確認していない
   - Recommendation: 09-02-PLAN.md 実装時に `src/components/auth/LoginForm.tsx` を読んでセレクタを確認する

2. **管理者 role 判定ロジックの確認**
   - What we know: STATE.md に「Defense-in-Depth: 各Server Action内でrequireAdmin()呼び出し」とある
   - What's unclear: `app_metadata.role: 'admin'` で判定しているか、`profiles` テーブルの別カラムで判定しているか
   - Recommendation: `src/lib/` 内の requireAdmin 実装を確認し、global-setup の updateUserById 引数を調整する

3. **Vercel Deployment Protection の現在の設定**
   - What we know: STATE.md に「Vercel dashboard で develop ブランチの Deployment Protection 設定を確認・無効化が必要」と記載
   - What's unclear: 現時点で有効か無効かはコードから判断不可
   - Recommendation: 09-01-PLAN.md の最初のタスクとして「Vercel dashboard 確認」を追加する

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` (Wave 0 で新規作成) |
| Quick run command | `npx playwright test --project=setup` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-01 | `npm run test:e2e` が起動し Vercel preview URL に接続できる | smoke | `npm run test:e2e` | ❌ Wave 0 |
| E2E-01 | `npm run test:e2e:ui` で UI モードが起動する | manual | `npm run test:e2e:ui` | ❌ Wave 0 |
| E2E-01 | テストユーザーが global-setup で作成される | integration | `npx playwright test --project=setup` | ❌ Wave 0 |
| E2E-01 | `e2e/.auth/` が `.gitignore` に含まれる | smoke | `grep "e2e/.auth" .gitignore` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=setup`（auth.setup.ts のみ実行）
- **Per wave merge:** `npm run test:e2e`（全テスト）
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `playwright.config.ts` — Playwright 設定ファイル（09-01-PLAN.md で作成）
- [ ] `e2e/global-setup.ts` — テストユーザー作成（09-02-PLAN.md で作成）
- [ ] `e2e/global-teardown.ts` — テストユーザー削除（09-02-PLAN.md で作成）
- [ ] `e2e/auth.setup.ts` — storageState 保存（09-02-PLAN.md で作成）
- [ ] `e2e/fixtures.ts` — カスタムフィクスチャ（09-02-PLAN.md で作成）
- [ ] Framework install: `npm install --save-dev @playwright/test@1.58.2 && npx playwright install chromium`

---

## Sources

### Primary (HIGH confidence)

- https://playwright.dev/docs/auth — storageState パターン、project-dependencies
- https://playwright.dev/docs/test-global-setup-teardown — global-setup/teardown の実装パターン
- https://playwright.dev/docs/test-fixtures — カスタムフィクスチャの作成方法
- https://playwright.dev/docs/test-configuration — playwright.config.ts の全オプション
- https://supabase.com/docs/reference/javascript/auth-admin-createuser — createUser API リファレンス

### Secondary (MEDIUM confidence)

- https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test — Supabase + Playwright の実践パターン
- https://enreina.com/blog/e2e-testing-in-next-js-with-playwright-vercel-and-github-actions-a-guide-with-example/ — Next.js + Vercel + Playwright の構成例

### Tertiary (LOW confidence)

- なし

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @playwright/test の公式ドキュメント確認済み。バージョン 1.58.2 は STATE.md で確定済み
- Architecture: HIGH — project-dependencies パターンと storageState は公式ドキュメントで推奨されている標準パターン
- Pitfalls: MEDIUM — Vercel Deployment Protection と .env.test 問題は複数の実践記事で確認済み。LoginForm セレクタはコード確認が必要

**Research date:** 2026-03-15
**Valid until:** 2026-04-15（Playwright は頻繁にリリースされるが 1.58.2 固定のため安定）
