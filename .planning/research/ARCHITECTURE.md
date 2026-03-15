# Architecture Patterns

**Domain:** コーチングセッション予約システム（ポイント管理、カレンダー同期、ビデオ会議統合付き）
**Researched:** 2026-02-22 / Updated: 2026-03-15 (E2Eテスト統合アーキテクチャ追記)
**Confidence:** HIGH

---

## E2Eテスト統合アーキテクチャ（v1.2 追加セクション）

このセクションは v1.2 マイルストーン「Playwright E2Eテスト環境構築」の調査結果。
既存アーキテクチャ（Next.js 15 App Router + Supabase dev + Vercel）に対して、
E2Eテストをどう統合するかを答える。

---

### 質問1: Vercel Preview URLかローカルdevサーバーか

**推奨: CIではVercel Preview URL、ローカルではdev serverを自動起動**

理由:
- Vercel Preview は本番と同じインフラ（Edge Middleware、環境変数、Vercel関数の挙動）を再現する
- ローカルdev server (`next dev`) はMiddlewareやEdge Runtimeの挙動が微妙に異なる場合がある
- 既にdevelopブランチへのpushでVercelがPreview Deployを自動作成している

実装パターン:

```typescript
// playwright.config.ts
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000"

export default defineConfig({
  use: {
    baseURL: BASE_URL,
  },
  webServer: process.env.CI
    ? undefined  // CIではVercel PreviewURLを使うため不要
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
})
```

GitHub Actionsでは `patrickedqvist/wait-for-vercel-preview` アクション（または Vercel CLI）で
PreviewのURLを取得し、`PLAYWRIGHT_TEST_BASE_URL` に渡す。

**Vercel Preview URLの取得戦略:**

```yaml
# .github/workflows/e2e.yml (抜粋)
- name: Wait for Vercel Preview
  id: waitForVercel
  uses: patrickedqvist/wait-for-vercel-preview@v1.3.3
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    max_timeout: 300

- name: Run Playwright Tests
  run: npx playwright test
  env:
    PLAYWRIGHT_TEST_BASE_URL: ${{ steps.waitForVercel.outputs.url }}
    # Supabase dev環境の認証情報
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_DEV_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_DEV_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_DEV_SERVICE_ROLE_KEY }}
```

**注意:** `patrickedqvist/wait-for-vercel-preview` はGitHub DeploymentイベントをポーリングしてVercel PreviewのURLを取得する。Vercel側でGitHub連携が有効になっている必要がある（既に有効のはず）。

---

### 質問2: Supabase devのテストデータ管理（seed/teardown）

**推奨: テスト専用ユーザーを事前作成 + テストごとにbooking等の動的データをservice role経由でcleanup**

**前提:** 既存のSupabase devプロジェクト (`rvhivweztxowtjbivzhs.supabase.co`) を使用。
テスト専用の独立プロジェクトは作成しない（規模的にオーバーエンジニアリング）。

**戦略:**

```
テスト実行前 (global setup)
  → service roleでテストユーザーを作成 (会員ユーザー1人、ゲスト用はユーザー不要)
  → テストユーザーのmember_planを作成 (ポイント残高付き)
  → 認証セッションをauth.setup.tsで取得・保存

各テスト後 (afterEach / fixture teardown)
  → service roleでテストが作成したbookingsを削除
  → idempotency_keysをクリア

global teardown
  → テストユーザーを削除 (cascade削除でmember_plan, bookingsも消える)
```

**実装: グローバルセットアップ**

```typescript
// e2e/global-setup.ts
import { createClient } from "@supabase/supabase-js"

export default async function globalSetup() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // テストユーザー作成（会員向けテスト用）
  const { data: { user } } = await supabase.auth.admin.createUser({
    email: "e2e-member@test.kazumin.local",
    password: "e2e-test-password-123",
    email_confirm: true,
  })

  if (user) {
    // member_planを作成（ポイント残高300）
    await supabase.from("member_plans").insert({
      user_id: user.id,
      plan_id: /* ベーシックプランのID */,
      remaining_points: 300,
      is_active: true,
    })
  }

  // テストユーザーIDを環境変数に保存（teardown用）
  process.env.E2E_TEST_USER_ID = user?.id
}
```

**実装: テスト用フィクスチャ（booking cleanup付き）**

```typescript
// e2e/fixtures.ts
import { test as base } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const test = base.extend({
  serviceRole: async ({}, use) => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    await use(client)
    // テスト後にbookingsをクリーンアップ
    await client
      .from("bookings")
      .delete()
      .eq("member_id", process.env.E2E_TEST_USER_ID!)
  },
})
```

**重要な設計判断:**
- DBリセット全体（supabase db reset）はしない。既存のマスターデータ（plans, menus, schedules）が消えてしまう
- bookingsなどのテストデータのみを削除する
- CIのworkers: 1 にして並列実行による競合を避ける（Supabase devは接続数制限あり）

---

### 質問3: CIで実行するかローカルのみか

**推奨: CIとローカル両方で実行する。ただしCIはPRのdevelopブランチへのpush時のみ**

**理由:**
- developブランチが実際の開発ブランチ。mainへの直接pushはない
- mainブランチへのマージ前にE2Eを通過させることで本番品質を担保
- ローカルでも実行できることで開発中にも使える

**CIワークフロー設計:**

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Wait for Vercel Preview
        id: vercel
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

      - name: Run E2E tests
        run: npx playwright test
        env:
          PLAYWRIGHT_TEST_BASE_URL: ${{ steps.vercel.outputs.url }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_DEV_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_DEV_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_DEV_SERVICE_ROLE_KEY }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**GitHub Secrets に追加が必要なもの:**
- `SUPABASE_DEV_URL` — `https://rvhivweztxowtjbivzhs.supabase.co`
- `SUPABASE_DEV_ANON_KEY` — dev環境のanon key
- `SUPABASE_DEV_SERVICE_ROLE_KEY` — dev環境のservice role key（テストデータ操作用）

---

### 質問4: Supabase認証の扱い（バイパスかシミュレートか）

**推奨: REST APIでログインしてsession tokenをlocalStorageに注入する（UIログインは避ける）**

**根拠:** SupabaseはセッションをブラウザのlocalStorageに `sb-{project_ref}-auth-token` というキーで保存する。
このキーを直接セットすることで、UI上のログインフォームを経由せずに認証済み状態を再現できる。

**実装: auth.setup.ts（セッションをファイルに保存）**

```typescript
// e2e/auth.setup.ts
import { test as setup } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const AUTH_FILE = path.join(__dirname, ".auth/member.json")

setup("authenticate as member", async ({ page }) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // REST APIでログイン（UIを経由しない）
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: "e2e-member@test.kazumin.local",
    password: "e2e-test-password-123",
  })

  if (!session || error) throw new Error("E2E auth setup failed")

  // セッションをlocalStorageに注入
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]
  await page.goto(process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000")
  await page.evaluate(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${projectRef}-auth-token`, session }
  )

  // storageStateとして保存（以降のテストで再利用）
  await page.context().storageState({ path: AUTH_FILE })
})
```

**playwright.config.ts でのプロジェクト設定:**

```typescript
export default defineConfig({
  projects: [
    // 認証セットアッププロジェクト（先に実行）
    { name: "setup", testMatch: /.*\.setup\.ts/ },

    // ゲスト向けテスト（認証不要）
    {
      name: "guest",
      testMatch: /.*\/guest\/.*/,
    },

    // 会員向けテスト（認証あり）
    {
      name: "member",
      testMatch: /.*\/member\/.*/,
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth/member.json" },
    },

    // 管理者向けテスト（認証あり）
    {
      name: "admin",
      testMatch: /.*\/admin\/.*/,
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth/admin.json" },
    },
  ],
})
```

**MiddlewareとCookieについての注意:**
既存の `middleware.ts` はSupabase SSRのCookieベースセッション (`updateSession`) を使用している。
ブラウザのlocalStorageに加えて、`@supabase/ssr` のCookieも必要になる場合がある。
auth.setup.ts で `/login` ページを経由してUIログインする方法も有効だが、その場合は
メール/パスワード認証フォームが必要（Google OAuthはCIで使えない）。

**メール/パスワード認証フォームが存在するかの確認が必要。** 既存コードで `/login` ページに
email+passwordフォームがあればUIログインも選択肢。なければREST APIアプローチを採用。

---

### 質問5: Next.js App Routerに対するテストファイル構造

**推奨ディレクトリ構造:**

```
e2e/                              # E2Eテストルート（srcの外）
├── .auth/                        # 認証ステート（.gitignore対象）
│   ├── member.json
│   └── admin.json
├── fixtures.ts                   # テスト共通フィクスチャ（serviceRoleなど）
├── global-setup.ts               # テストユーザー作成
├── global-teardown.ts            # テストユーザー削除
├── auth.setup.ts                 # 認証セッション取得・保存
│
├── guest/                        # ゲスト向けフロー（認証不要）
│   ├── booking-flow.spec.ts      # ゲスト予約フロー（メインシナリオ）
│   └── slot-display.spec.ts      # スロット表示確認
│
├── member/                       # 会員向けフロー（認証あり）
│   ├── booking-flow.spec.ts      # 会員予約フロー（ポイント消費）
│   ├── cancel-flow.spec.ts       # キャンセルフロー（ポイント返還）
│   └── dashboard.spec.ts         # ダッシュボード表示
│
└── admin/                        # 管理者向けフロー（管理者認証あり）
    └── booking-management.spec.ts # 予約管理操作
```

**テストファイルの命名規則:**
- `{機能名}-flow.spec.ts` — ユーザーの完結したフローを1ファイルで記述
- 1ファイル = 1ユーザーストーリー（複数シナリオは `test.describe` で整理）

**ゲスト予約フローのサンプル構造:**

```typescript
// e2e/guest/booking-flow.spec.ts
import { test, expect } from "@playwright/test"

test.describe("ゲスト予約フロー", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/guest/booking")
  })

  test("スロットを選択して予約が完了する", async ({ page }) => {
    // 1. スロット選択
    await page.getByRole("button", { name: /10:00/ }).click()
    // 2. 情報入力
    await page.getByLabel("お名前").fill("テスト太郎")
    await page.getByLabel("メールアドレス").fill("test@example.com")
    // 3. 送信
    await page.getByRole("button", { name: "予約する" }).click()
    // 4. 完了画面確認
    await expect(page.getByText("予約が完了しました")).toBeVisible()
    await expect(page.getByText("Zoom")).toBeVisible()
  })
})
```

---

### 新規作成が必要なコンポーネント

| コンポーネント | 種別 | パス | 目的 |
|------------|-----|------|------|
| Playwright設定 | 新規作成 | `playwright.config.ts` | baseURL・project設定 |
| CIワークフロー | 新規作成 | `.github/workflows/e2e.yml` | GitHub Actions定義 |
| グローバルセットアップ | 新規作成 | `e2e/global-setup.ts` | テストユーザー作成 |
| グローバルティアダウン | 新規作成 | `e2e/global-teardown.ts` | テストユーザー削除 |
| 認証セットアップ | 新規作成 | `e2e/auth.setup.ts` | セッション取得・保存 |
| 共通フィクスチャ | 新規作成 | `e2e/fixtures.ts` | serviceRole、cleanup |
| ゲスト予約テスト | 新規作成 | `e2e/guest/booking-flow.spec.ts` | ゲスト予約フロー |
| 会員予約テスト | 新規作成 | `e2e/member/booking-flow.spec.ts` | 会員予約フロー |
| .gitignore追記 | 変更 | `.gitignore` | `e2e/.auth/` を追加 |

**既存ファイルの変更:**
- `package.json` — `playwright` devDependency追加、`test:e2e` スクリプト追加
- `vitest.config.ts` — `exclude` に `e2e/` を追加（既にある場合は不要）

---

### ビルド順序（依存関係考慮）

```
Phase 1: 基盤整備
  └─ Playwright インストール・設定 (playwright.config.ts)
  └─ .gitignore に e2e/.auth/ 追加

Phase 2: テストデータ管理
  └─ global-setup.ts（テストユーザー作成）
  └─ global-teardown.ts（テストユーザー削除）
  └─ fixtures.ts（serviceRoleフィクスチャ）
     ※ Phase 1 完了後

Phase 3: 認証セットアップ
  └─ auth.setup.ts（セッション取得・storageState保存）
     ※ Phase 2 完了後（テストユーザーが必要）

Phase 4: テストシナリオ実装
  └─ guest/booking-flow.spec.ts（認証不要で先に着手可能）
  └─ member/booking-flow.spec.ts（Phase 3 完了後）
     ※ ゲストテストは Phase 1 完了直後から着手可能

Phase 5: CI統合
  └─ .github/workflows/e2e.yml
  └─ GitHub Secrets 設定（SUPABASE_DEV_URL等）
     ※ Phase 4 完了後（テストが通ってからCIに乗せる）
```

---

### Vercel + Supabase 特有のゴッチャ

| 項目 | 問題 | 対策 |
|------|------|------|
| Vercel Preview URL | pushのたびにURLが変わる | `wait-for-vercel-preview` アクションでURLを動的取得 |
| Supabase dev環境変数 | Vercel PreviewはVercel側の環境変数を使う | Vercel dashboardでdevelopブランチ用に `NEXT_PUBLIC_SUPABASE_URL` 等が設定済みか確認 |
| service role key | CIからdev DBのデータを操作する | `SUPABASE_DEV_SERVICE_ROLE_KEY` をGitHub Secretsに追加 |
| Middleware + SSRクッキー | `@supabase/ssr` のCookieベースセッション | `auth.setup.ts` でUIログイン後の storageState 取得が確実 |
| 並列テスト実行 | Supabase dev無料枠は接続数制限 | `workers: 1` でシリアル実行 |
| Zoom API呼び出し | テスト時にZoom会議が実際に作成される | devのZoom資格情報を使うか、APIモックを検討 |
| Resend メール送信 | テスト時に実際のメールが飛ぶ可能性 | Resend devモード（`onboarding@resend.dev` ドメイン）か、テスト用メールアドレスのドメインを別途設定 |
| Vercel無料枠のタイムアウト | Hobby plan の関数タイムアウトは10秒 | `max_timeout: 300` で最大5分待機（Previewビルド時間を考慮） |
| RLS + service role | service roleはRLSをバイパスする | teardownで誤って他ユーザーデータを消さないよう `user_id` でフィルタリング必須 |

---

### 既存テスト環境との共存

現在の構成:
- `vitest` — ユニットテスト (`src/__tests__/`, `src/lib/utils.test.ts`)
- `playwright` — E2Eテスト (`e2e/`) を追加予定

両者は独立して動作し、干渉しない。

**package.json スクリプト案:**
```json
{
  "scripts": {
    "test": "vitest run",           // 既存: unitテスト
    "test:watch": "vitest",          // 既存
    "test:e2e": "playwright test",   // 新規: E2Eテスト
    "test:e2e:ui": "playwright test --ui",  // 新規: PlaywrightのUIモード
    "test:all": "npm run test && npm run test:e2e"  // 新規: 全テスト
  }
}
```

---

## 既存アーキテクチャ（v1.0〜v1.1 研究内容）

以下のセクションは元のアーキテクチャ研究内容（変更なし）。

---

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Guest Pages  │  │ Member Pages │  │ Admin Pages  │            │
│  │ (SSR/RSC)    │  │ (SSR/RSC)    │  │ (SSR/RSC)    │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Application Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Route        │  │ Server       │  │ Server       │            │
│  │ Handlers     │  │ Actions      │  │ Components   │            │
│  │ (API)        │  │ (Mutations)  │  │ (Reads)      │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Business Logic Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Availability │  │ Booking      │  │ Point        │            │
│  │ Calculator   │  │ Manager      │  │ Manager      │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Integration Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Calendar     │  │ Video        │  │ Email        │            │
│  │ Sync         │  │ Meeting      │  │ Queue        │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                    │
├─────────┴──────────────────┴──────────────────┴────────────────────┤
│                        Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ PostgreSQL   │  │ RLS          │  │ Edge         │            │
│  │ (Supabase)   │  │ Policies     │  │ Functions    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└───────────────────────────────────────────────────────────────────┘
         ↕                    ↕                    ↕
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Google       │  │ Zoom         │  │ Resend       │
│ Calendar API │  │ API          │  │ (Email)      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Presentation Layer** | UI表示、ユーザー入力受付 | Next.js App Router (RSC/SSR)、shadcn/ui components |
| **Route Handlers** | 外部APIエンドポイント（予約作成、キャンセル、スロット取得） | Next.js Route Handlers (`app/api/**/route.ts`) |
| **Server Actions** | フォーム送信、mutations | Next.js Server Actions (`use server`) |
| **Server Components** | データフェッチ、初期レンダリング | React Server Components (default in App Router) |
| **Availability Calculator** | 空き時間算出（営業時間、busy時間、既存予約、バッファ考慮） | TypeScript関数、PostgreSQL関数との組み合わせ |
| **Booking Manager** | 予約作成・キャンセルのオーケストレーション（トランザクション管理） | トランザクション処理、補償処理 |
| **Point Manager** | ポイント付与・消費・返還のロジック | PostgreSQL stored procedures（ACID保証） |
| **Calendar Sync** | Googleカレンダーとの同期（busy時間取得、イベント追加・削除） | Google Calendar API wrapper、キャッシュ機構 |
| **Video Meeting** | Zoom会議の作成・削除（アカウント切り替え） | Zoom API wrapper、Server-to-Server OAuth |
| **Email Queue** | メール送信の非同期処理 | Resend API、Edge Functions (cron) |
| **PostgreSQL** | データ永続化、トランザクション、RLS | Supabase PostgreSQL、ACID transactions |
| **Edge Functions** | スケジュールタスク（月次ポイント付与、リマインダー、サンキューメール） | Supabase Edge Functions + pg_cron |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 認証画面グループ
│   │   └── login/                # ログインページ
│   ├── (guest)/                  # ゲスト用画面グループ
│   │   ├── page.tsx              # トップページ
│   │   └── booking/              # 予約フロー（ゲスト）
│   ├── (member)/                 # 会員用画面グループ
│   │   ├── dashboard/            # マイページ
│   │   ├── bookings/             # 予約一覧
│   │   └── booking/              # 予約フロー（会員）
│   ├── (admin)/                  # 管理者用画面グループ
│   │   └── admin/                # 管理画面
│   │       ├── dashboard/        # 管理者ダッシュボード
│   │       ├── bookings/         # 予約管理
│   │       ├── members/          # 会員管理
│   │       ├── plans/            # プラン管理
│   │       ├── menus/            # メニュー管理
│   │       └── schedule/         # スケジュール管理
│   └── api/                      # Route Handlers
│       ├── slots/                # 空きスロット取得
│       ├── bookings/             # 予約作成・キャンセル
│       └── webhooks/             # 外部Webhook受信
├── components/                   # Reactコンポーネント
├── lib/                          # ビジネスロジック・ユーティリティ
├── emails/                       # React Emailテンプレート
└── middleware.ts                 # Next.js middleware（認証など）
e2e/                              # Playwright E2Eテスト（srcの外）
├── .auth/                        # 認証ステート（.gitignore）
├── fixtures.ts
├── global-setup.ts
├── global-teardown.ts
├── auth.setup.ts
├── guest/
│   └── booking-flow.spec.ts
├── member/
│   └── booking-flow.spec.ts
└── admin/
    └── booking-management.spec.ts
supabase/                         # Supabaseマイグレーション・関数
.github/
└── workflows/
    └── e2e.yml                   # 新規追加
playwright.config.ts              # 新規追加
```

## Architectural Patterns

### Pattern 1: Server-First Architecture with Strategic Client Components

**What:** Next.js App Routerのデフォルトはサーバーコンポーネント（RSC）。クライアントコンポーネント（`'use client'`）は必要な箇所のみに限定する。

**When to use:** ほぼすべてのページで使用。特に予約システムではデータの新鮮さとSEOが重要なため、サーバーサイドレンダリングを優先。

**Trade-offs:**
- **Pros:** 初期表示が高速、バンドルサイズ削減、データフェッチがシンプル、SEO対応が自然
- **Cons:** クライアント側のインタラクティブな機能（モーダル、フォームバリデーション）は個別に`'use client'`指定が必要

### Pattern 2: PostgreSQL Stored Procedures for Critical Transactions

**What:** ポイント消費・返還などのクリティカルな処理はPostgreSQL関数で実装し、トランザクションとACID保証を活用する。

### Pattern 3: Optimistic Locking for Double Booking Prevention

**What:** 同時予約によるダブルブッキングを防ぐため、予約作成前に再度空き確認を行う。

### Pattern 4: Compensating Transactions for Rollback

**What:** 外部API呼び出し（Zoom、Google Calendar）が失敗した場合、既に実行した処理を補償トランザクションで巻き戻す。

### Pattern 5: On-Demand Calendar Sync with Cache

**What:** Googleカレンダーの同期はリアルタイムではなく、オンデマンド（ユーザーが予約ページを開いたとき）に実行。15分間キャッシュして無駄なAPI呼び出しを削減。

### Pattern 6: Edge Functions for Scheduled Tasks

**What:** 月次ポイント付与、リマインダーメール、サンキューメールなどの定期実行タスクはSupabase Edge Functions + pg_cronで実装。

## Data Flow

### Request Flow: 予約作成（会員）

```
[ユーザー: スロット選択画面]
    ↓
[GET /api/slots?date=2026-03-01]
    ↓ (Server Component)
[Availability Calculator]
    ├─→ [Google Calendar Sync] → busy時間取得
    ├─→ [DB: weekly_schedules] → 営業時間取得
    ├─→ [DB: bookings] → 既存予約取得
    └─→ 空きスロット計算
    ↓
[Response: 空きスロット一覧]
    ↓
[ユーザー: スロット選択 + メニュー選択 + 予約ボタン押下]
    ↓
[POST /api/bookings] (Route Handler)
    ↓
[Booking Manager.createBooking()]
    ├─→ [1] スロット再確認（Optimistic Lock）
    ├─→ [2] Point Manager.consumePoints() → PostgreSQL関数実行
    ├─→ [3] Zoom.createMeeting() → Zoom API呼び出し
    ├─→ [4] GoogleCalendar.addEvent() → Google Calendar API呼び出し
    ├─→ [5] DB: bookingsにINSERT
    ├─→ [6] Email.sendConfirmation() → Resend API（非同期）
    └─→ [補償処理] エラー時は[2][3][4]をロールバック
    ↓
[Response: 予約確認データ + Zoomリンク]
    ↓
[予約完了画面表示]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 users** | 現在の設計で十分。Supabase無料枠（500MB DB、Edge Functions 500k実行/月）、Vercel無料枠で運用可能。Googleカレンダー同期はオンデマンド方式（15分キャッシュ）。 |
| **100-1,000 users** | カレンダー同期をcronバッチに切り替え（5-10分ごとにバックグラウンド同期）。Supabase ProプランまたはVercel Proプランへアップグレード。PostgreSQLのコネクションプールサイズを増やす（Supabase pooler使用）。 |
| **1,000+ users** | Read Replicaの導入（読み取り専用クエリを分散）。Edge Functionsのメモリ・タイムアウト最適化。Zoom API呼び出しのレート制限対策（キュー導入）。CDN活用（静的アセット、画像最適化）。 |

## Anti-Patterns

### Anti-Pattern 1: クライアント側でビジネスロジックを実装

ビジネスロジックはすべてサーバー側（Route Handler、Server Actions、PostgreSQL関数）に集約。

### Anti-Pattern 2: 外部APIエラーをそのままユーザーに返す

外部APIエラーを統一フォーマットに変換し、ユーザーフレンドリーなメッセージを返す。詳細エラーはサーバーログに記録。

### Anti-Pattern 3: RLSポリシーを設定せずに公開スキーマのテーブルを使う

すべてのpublicスキーマのテーブルにRLSポリシーを設定。

### Anti-Pattern 4: トランザクション管理なしでポイント消費と予約作成を別々に実行

PostgreSQL関数でトランザクションを保証するか、補償トランザクションで巻き戻す。

### Anti-Pattern 5: すべての処理を同期的に実行する

クリティカルな処理（ポイント消費、DB保存）のみ同期実行し、メール送信などは非同期化。

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Google Calendar API** | REST API + Service Account OAuth | Googleカレンダーのbusy/free時間を取得、イベント追加・削除。15分間のキャッシュで無駄なAPI呼び出しを削減。レート制限: 1秒10リクエスト |
| **Zoom API** | REST API + Server-to-Server OAuth | アカウントA（有料）とB（無料）を環境変数で切り替え。会議作成・削除のみ使用。レート制限: 1秒10リクエスト |
| **Resend (Email)** | REST API + React Email | 月3,000通の無料枠。予約確認、キャンセル、リマインダー、サンキューメールを送信。React Emailでテンプレート管理 |
| **Supabase Auth** | Supabase Client SDK | Google OAuth + メール/パスワード認証。`profiles`テーブルとの自動連携（Auth trigger） |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Presentation ↔ Application** | Server Component → データフェッチ直接、Client Component → Route Handler | Server Componentsは直接Supabaseクライアントを使用。Client ComponentsはfetchでRoute Handlerを呼び出す |
| **Application ↔ Business Logic** | TypeScript関数呼び出し | Route Handlerから`lib/booking/create.ts`などを呼び出し。依存性注入は不要（サーバーレス前提） |
| **Business Logic ↔ Integration** | TypeScript関数呼び出し（async/await） | `lib/booking/create.ts`から`lib/integrations/zoom.ts`などを呼び出し。エラーハンドリングは各層で実施 |
| **Business Logic ↔ Data** | Supabase Client SDK + PostgreSQL関数 | クエリはSupabase JS SDK経由。トランザクションが必要な場合はPostgreSQL関数（`supabase.rpc()`）を使用 |
| **Edge Functions ↔ Data** | Supabase Service Role Key | 管理者権限でDB操作。RLSポリシーをバイパス可能（注意が必要） |

## Sources

### E2Eテスト統合（v1.2追加）
- [E2E Testing in Next.js with Playwright, Vercel, and GitHub Actions](https://enreina.com/blog/e2e-testing-in-next-js-with-playwright-vercel-and-github-actions-a-guide-with-example/)
- [Login at Supabase via REST API in Playwright E2E Test](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test)
- [Authentication | Playwright](https://playwright.dev/docs/auth)
- [End-to-End Testing Your SaaS with Playwright | MakerKit](https://makerkit.dev/blog/tutorials/playwright-testing)
- [supawright: A Playwright test harness for E2E testing with Supabase](https://github.com/isaacharrisholt/supawright)
- [Wait for Vercel Preview Action](https://github.com/patrickedqvist/wait-for-vercel-preview)
- [Testing Overview | Supabase Docs](https://supabase.com/docs/guides/local-development/testing/overview)
- [Testing Supabase Magic Login in CI with Playwright](https://www.bekapod.dev/articles/supabase-magic-login-testing-with-playwright/)

### 既存アーキテクチャ（v1.0〜v1.1）
- [Architecture Patterns For Booking Management Platform | Medium](https://medium.com/tuimm/architecture-patterns-for-booking-management-platform-53499c1e815e)
- [Supabase Architecture | Supabase Docs](https://supabase.com/docs/guides/getting-started/architecture)
- [Next.js Architecture in 2026 — Server-First, Client-Islands, and Scalable App Router Patterns](https://www.yogijs.tech/blog/nextjs-project-architecture-app-router)

---
*アーキテクチャ研究: コーチングセッション予約システム（Time with Kazumin）*
*初回調査: 2026-02-22 / E2Eテスト統合追記: 2026-03-15*
