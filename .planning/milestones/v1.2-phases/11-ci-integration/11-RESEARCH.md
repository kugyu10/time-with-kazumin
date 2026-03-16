# Phase 11: CI統合 - Research

**Researched:** 2026-03-16
**Domain:** GitHub Actions / Playwright CI / Vercel Preview URL取得
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- developブランチへのpush時にはE2Eテストは実行しない
- `develop → main` へのPR作成・更新時にE2Eテストを実行する
- GitHub Appsによる自動連携は未設定のため、`VERCEL_TOKEN` をGitHub Secretsに設定してVercel preview URLを取得する
- CI環境（GitHub Actions）から開発用Supabaseへの接続可否は未検証（global-setup.tsがSERVICE_ROLE_KEYでテストデータを投入するため、接続可能であることが前提）
- `patrickedqvist/wait-for-vercel-preview` アクションを使用してVercel preview URL取得
- `PLAYWRIGHT_BASE_URL` 環境変数でpreview URLを渡す（playwright.config.tsが対応済み）
- 必要なGitHub Secrets: `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`, `VERCEL_TOKEN`
- テスト失敗時はPlaywrightのHTML report + traceをアーティファクトとして保存

### Claude's Discretion
- GitHub Actionsワークフローの具体的なjob/step構成
- Playwright browserのインストール方法
- タイムアウト値の設定
- アーティファクト保存の詳細構成

### Deferred Ideas (OUT OF SCOPE)
- Slack/メール等の通知連携
- テスト結果のPRコメント自動投稿
- mainブランチへの自動マージ
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-05 | GitHub ActionsでE2EテストがVercel preview URL向けに自動実行される | workflow yaml構成、patrickedqvist/wait-for-vercel-preview@v1.3.3、GitHub Secretsの設定、アーティファクト保存パターンすべてをカバー |
</phase_requirements>

---

## Summary

GitHub ActionsでPlaywright E2EテストをVercel preview URL向けに自動実行するには、`pull_request`イベントをトリガーとし、`patrickedqvist/wait-for-vercel-preview@v1.3.3`でpreview URLが利用可能になるまで待機してから、Playwright testsを実行するパターンが標準的である。

このアクションはVercel GitHub Appが作成するGitHub deployment APIのイベントを監視することで動作する。Vercel GitHub Appは既にリポジトリと連携しているが、「GitHub Appsによる自動連携が未設定」というCONTEXT.mdの記述は、Vercel dashboardでのDeployment Protection設定（パスワード保護等）が有効になっている可能性を示唆している。これを回避するため`vercel_protection_bypass_header`オプションを使用するか、Deployment Protectionを無効化する必要がある。

Supabase開発用クラウドへの接続は、GitHub ActionsのIPアドレスからのアクセスを制限していない限りGitHub Actionsから直接可能であり、SUPABASE_DEV_URLとSUPABASE_DEV_SERVICE_ROLE_KEYをGitHub Secretsに設定することで接続できる。playwright.config.tsはすでに`CI`環境変数を参照して`webServer`を無効化する設定が含まれており、CI環境での実行に対応済みである。

**Primary recommendation:** `pull_request` トリガー + `patrickedqvist/wait-for-vercel-preview@v1.3.3` + 環境変数経由でのPreview URL受け渡し、Playwright HTML reportアーティファクト保存の3ステップ構成。

## Standard Stack

### Core
| Library / Action | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| `patrickedqvist/wait-for-vercel-preview` | v1.3.3 | Vercel preview URLが利用可能になるまで待機し、URLを出力 | 既にCONTEXT.mdで決定済み。GitHub deployment APIを使うためVercel App不要。最新安定版はv1.3.3（2026-01-21リリース） |
| `actions/checkout` | v4 | コードをチェックアウト | GitHub公式推奨の最新版 |
| `actions/setup-node` | v4 | Node.jsセットアップ | GitHub公式推奨の最新版 |
| `actions/upload-artifact` | v4 | テストレポート・トレースのアーティファクト保存 | Playwright公式推奨の最新版 |
| `@playwright/test` | 1.58.2 | E2Eテスト実行 | package.jsonで定義済み |

### Supporting
| Library / Action | Version | Purpose | When to Use |
|-----------------|---------|---------|-------------|
| `actions/cache` | v4 | Node modulesキャッシュ | 実行時間短縮が必要な場合 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `patrickedqvist/wait-for-vercel-preview` | `deployment_status`イベントトリガー | `deployment_status`は`pull_request`と組み合わせた分岐が複雑。wait-for-vercel-previewの方がシンプル |
| `patrickedqvist/wait-for-vercel-preview` | `zentered/vercel-preview-url` | VERCEL_TOKENとVERCEL_PROJECT_IDが追加で必要。今回はGITHUB_TOKENのみで動作するwait-for-vercel-previewを選択 |

**Installation:** 新規パッケージのインストールは不要。GitHub Actionsのyamlファイルのみ追加。

## Architecture Patterns

### Recommended Project Structure
```
.github/
└── workflows/
    └── e2e.yml     # E2Eテストワークフロー（Phase 11で新規作成）
```

### Pattern 1: pull_request トリガー + 2-job構成

**What:** `pull_request`イベントで発火し、Job1でVercel preview URLを待機・取得、Job2でPlaywright E2Eテストを実行する2-job構成。

**When to use:** 今回のような「PRマージ前にE2Eテストを自動実行する」ユースケース全般。

**Example:**
```yaml
# Source: https://blog.dylants.com/posts/20240305/playwright-tests-using-git-hub-actions-vercel
name: E2E Tests

on:
  pull_request:
    branches:
      - main

jobs:
  wait-for-preview:
    name: Wait for Vercel Preview
    runs-on: ubuntu-latest
    outputs:
      preview-url: ${{ steps.wait-for-preview.outputs.url }}
    steps:
      - name: Wait for Vercel Preview
        id: wait-for-preview
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300

  e2e:
    name: Run E2E Tests
    needs: wait-for-preview
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
      - name: Run Playwright tests
        env:
          PLAYWRIGHT_BASE_URL: ${{ needs.wait-for-preview.outputs.preview-url }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_DEV_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_DEV_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_DEV_SERVICE_ROLE_KEY }}
          JWT_CANCEL_SECRET: ${{ secrets.JWT_CANCEL_SECRET }}
          E2E_MEMBER_EMAIL: ${{ secrets.E2E_MEMBER_EMAIL }}
          E2E_MEMBER_PASSWORD: ${{ secrets.E2E_MEMBER_PASSWORD }}
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
          CI: true
        run: npx playwright test
      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Pattern 2: Vercel Deployment Protection対応（必要な場合）

**What:** Vercel preview URLがDeployment Protectionで保護されている場合、`vercel_protection_bypass_header`を使用してbypassする。

**When to use:** `wait-for-vercel-preview`が401エラーを返す場合。

**Example:**
```yaml
# Source: https://github.com/patrickedqvist/wait-for-vercel-preview (公式README)
- name: Wait for Vercel Preview
  id: wait-for-preview
  uses: patrickedqvist/wait-for-vercel-preview@v1.3.3
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    max_timeout: 300
    vercel_protection_bypass_header: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
```

### Pattern 3: アーティファクト保存

**What:** テスト失敗時にHTML reportとtraceを保存する。`!cancelled()`条件でテスト失敗時でも確実にアップロード。

**When to use:** 常に使用。

**Example:**
```yaml
# Source: https://playwright.dev/docs/ci-intro
- uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

### Anti-Patterns to Avoid

- **`push: branches: [develop]`をトリガーにする**: CONTEXT.mdで明示的に禁止。develop pushではなくdevelop→main PRが条件。
- **全ブラウザをインストールする**: `npx playwright install --with-deps`ではなく`npx playwright install chromium --with-deps`を使う。playwright.config.tsがchromiumのみを使用しているため不要なブラウザインストールはCI時間の無駄。
- **テスト失敗でもアーティファクトを保存しない**: `if: failure()`は不完全。`if: ${{ !cancelled() }}`を使う。
- **`npm install`の代わりに`npm ci`を使わない**: CI環境では`npm ci`が推奨（package-lock.jsonとの整合性チェック）。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vercel preview URL待機 | Vercel APIをポーリングするカスタムスクリプト | `patrickedqvist/wait-for-vercel-preview@v1.3.3` | deployment statusの変遷、タイムアウト処理、エラー処理を全て実装済み |
| Playwright browser依存関係インストール | 手動でaptでchromium依存インストール | `npx playwright install chromium --with-deps` | OSレベルの依存解決を全て自動化 |
| テストレポートのアーティファクト管理 | S3等のカスタムアップロード | `actions/upload-artifact@v4` | GitHub UI上でレポートが直接閲覧可能 |

**Key insight:** GitHub Actionsエコシステムには既製のアクションが豊富に存在し、Vercel+Playwright連携のためのものも確立済み。カスタム実装は複雑性のみを増加させる。

## Common Pitfalls

### Pitfall 1: Vercel Deployment Protectionによる401エラー
**What goes wrong:** `wait-for-vercel-preview`アクションがVercel preview URLに対してHTTPリクエストを送る際、Deployment Protectionが有効だと401が返り、URLが取得できない。
**Why it happens:** Vercel有料プランでDeployment Protectionがデフォルトで有効になっている場合がある。
**How to avoid:** VercelダッシュボードでDeployment Protectionを無効化するか、Vercel Automation Bypass SecretをGitHub Secretsに追加して`vercel_protection_bypass_header`に設定。
**Warning signs:** `patrickedqvist/wait-for-vercel-preview`ステップでタイムアウトまたは401エラーが発生。

### Pitfall 2: `wait-for-vercel-preview`の前提条件（Vercel GitHub App）
**What goes wrong:** Vercel GitHub Appがリポジトリに連携されていない場合、`wait-for-vercel-preview`はGitHub deployment APIにdeploymentレコードが作成されず、タイムアウトする。
**Why it happens:** このアクションはVercel GitHub Appが作成するGitHub deployment eventを監視する。Vercel CLIのみでデプロイしている場合は機能しない。
**How to avoid:** VercelダッシュボードでGitHubリポジトリ連携を確認する。連携済みであれば、PRをトリガーにVercelがdeploymentイベントを自動作成する。
**Warning signs:** アクションが300秒（max_timeout）待機後にタイムアウトエラーで終了。

### Pitfall 3: Supabase接続失敗（CI環境のIPアドレス制限）
**What goes wrong:** GitHub Actions（IPアドレスが動的）からSupabase devへの接続が失敗する。
**Why it happens:** Supabaseプロジェクトのネットワーク設定によっては、特定IPのみ許可している場合がある。Supabase cloudのデフォルトは制限なし。
**How to avoid:** Supabase dashboardでネットワーク制限設定を確認する。デフォルト設定であれば問題なし。
**Warning signs:** global-setup.tsでSupabaseクライアントのcreateUser呼び出しが失敗。

### Pitfall 4: `wait-for-vercel-preview`が間違ったdeploymentを拾う
**What goes wrong:** PRに紐づくdeploymentではなく、develop branchの前回のdeploymentを拾う可能性。
**Why it happens:** Vercel GitHub AppはPRのhead commitに対してdeploymentを作成するが、タイミングによっては古いdeploymentがpendingのまま残っていることがある。
**How to avoid:** `max_timeout`を300秒以上に設定し、Vercelのdeployが完了するまで待機。
**Warning signs:** E2Eテストが古いバージョンのUIに対して実行されているように見える場合。

### Pitfall 5: 環境変数の未設定
**What goes wrong:** global-setup.tsが`SUPABASE_SERVICE_ROLE_KEY`等を参照するが、GitHub Secretsへの設定漏れでundefinedになり、テストデータが投入できない。
**Why it happens:** .env.testはGitignoreされているためCIには存在しない。環境変数を明示的にGitHub Actionsのenv/secretsから渡す必要がある。
**How to avoid:** 必要な全環境変数をGitHub SecretsとActions yamlのenvブロックに明記する。
**Warning signs:** `global-setup.ts`内でSupabase APIコールが失敗。

## Code Examples

### playwright.config.ts確認（CI対応済み）
```typescript
// Source: /Users/kugyu10/work/かずみん/Time-with-Kazumin/playwright.config.ts
// CI環境ではwebServerを起動しない（すでに対応済み）
webServer: process.env.CI
  ? undefined
  : {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
    },
// PLAYWRIGHT_BASE_URLを参照（すでに対応済み）
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
```

### GitHub Actions: chromiumのみインストール（最適化）
```bash
# Source: playwright.config.ts のprojects設定より（chromiumのみ定義）
npx playwright install chromium --with-deps
```

### GitHub Secretsの設定リスト
```
SUPABASE_DEV_URL          = https://xxx.supabase.co  (.env.testのNEXT_PUBLIC_SUPABASE_URL)
SUPABASE_DEV_ANON_KEY     = eyJ...                   (.env.testのNEXT_PUBLIC_SUPABASE_ANON_KEY)
SUPABASE_DEV_SERVICE_ROLE_KEY = eyJ...               (.env.testのSUPABASE_SERVICE_ROLE_KEY)
JWT_CANCEL_SECRET         = ランダム文字列             (.env.testのJWT_CANCEL_SECRET)
E2E_MEMBER_EMAIL          = e2e-member@xxx.com
E2E_MEMBER_PASSWORD       = TestPassword123!
E2E_ADMIN_EMAIL           = e2e-admin@xxx.com
E2E_ADMIN_PASSWORD        = TestPassword123!
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pull_request`発火後に手動でVercel APIポーリング | `patrickedqvist/wait-for-vercel-preview@v1.3.3`で自動待機 | 2020年頃から一般化 | 設定量が大幅削減 |
| `if: failure()`でアーティファクト保存 | `if: ${{ !cancelled() }}`で保存 | 2022年頃 | テストがキャンセルされた場合でも確実にレポート保存 |
| `actions/upload-artifact@v3` | `actions/upload-artifact@v4` | 2023年 Node16非推奨以降 | v3はNode16で動作、v4はNode20推奨 |
| `actions/checkout@v3` | `actions/checkout@v4` | 2023年 | Node20サポート、パフォーマンス改善 |

**Deprecated/outdated:**
- `actions/checkout@v3`, `actions/setup-node@v3`, `actions/upload-artifact@v3`: Node16依存。v4を使用。

## Open Questions

1. **Vercel GitHub Appとの連携状態**
   - What we know: CONTEXT.mdに「GitHub Appsによる自動連携は未設定」とある。ただしVercel dashboardでGitHubリポジトリ連携はしている可能性が高い（既存フェーズでdevelop branchのpreview URLを参照している）。
   - What's unclear: Vercel dashboardでGitHub App連携済みかどうか。Deployment Protectionが有効かどうか。
   - Recommendation: ワークフロー実装時にVercel dashboardでGitHub App連携状態を確認。未連携ならVercel GitHub Appをインストールする。Deployment Protectionが有効なら、VercelダッシュボードでAutomation Bypass Secretを取得してGitHub Secretsに`VERCEL_AUTOMATION_BYPASS_SECRET`として追加。

2. **CIからSupabase dev接続の確認**
   - What we know: GitHub Actionsのrunner IPは動的。Supabase cloudのデフォルトはIP制限なし。
   - What's unclear: このプロジェクトのSupabase devプロジェクトでIP制限が設定されているかどうか。
   - Recommendation: 実装後に初回CIを実行し、global-setup.tsのSupabase接続ログを確認する。失敗した場合はSupabase dashboardのNetwork制限を確認する。

3. **VERCEL_TOKENの必要性**
   - What we know: `wait-for-vercel-preview`が必要とするのは`GITHUB_TOKEN`のみ。`VERCEL_TOKEN`はVercel APIを直接叩く別の方法（zentered/vercel-preview-url等）で必要。
   - What's unclear: CONTEXT.mdで「VERCEL_TOKEN」が必要とされているが、`wait-for-vercel-preview`には不要。
   - Recommendation: `wait-for-vercel-preview`を使う場合、`VERCEL_TOKEN`は不要。`GITHUB_TOKEN`は自動提供される。CONTEXT.mdの記述は誤解の可能性あり。ただし将来的にVercel API直接呼び出しが必要になる場合に備えてSecretとして設定しておくのも可。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | playwright.config.ts |
| Quick run command | `npx playwright test --reporter=list` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| E2E-05 | develop→main PRでGitHub ActionsがE2Eテストを実行する | smoke（手動確認） | PR作成後にGitHub Actions UIで確認 | ❌ Wave 0 (.github/workflows/e2e.yml) |

### Sampling Rate
- **Per task commit:** 該当なし（ワークフローファイルのみのフェーズ）
- **Per wave merge:** ワークフローが意図通り発火するかPR作成で手動確認
- **Phase gate:** develop→main PR作成時にGitHub Actions E2Eテストが成功すること

### Wave 0 Gaps
- [ ] `.github/workflows/e2e.yml` — E2E-05のCI統合ワークフロー本体
- [ ] GitHub Secretsの設定 — `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`, `JWT_CANCEL_SECRET`, `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`

## Sources

### Primary (HIGH confidence)
- [patrickedqvist/wait-for-vercel-preview GitHub公式README](https://github.com/patrickedqvist/wait-for-vercel-preview) - バージョン(v1.3.3)、inputs/outputs確認済み
- [Playwright CI Intro公式ドキュメント](https://playwright.dev/docs/ci-intro) - GitHub Actionsワークフロー、アーティファクト保存パターン確認済み

### Secondary (MEDIUM confidence)
- [dylants.com: Playwright Tests using GitHub Actions + Vercel](https://blog.dylants.com/posts/20240305/playwright-tests-using-git-hub-actions-vercel) - 2-job構成パターンを複数ソースで確認
- [cushionapp.com: Playwright with GitHub Actions for Vercel preview](https://cushionapp.com/journal/how-to-use-playwright-with-github-actions-for-e2e-testing-of-vercel-preview) - pull_requestトリガー設定を確認
- [focusreactive.com: Playwright testing on CI using Github Actions and Vercel](https://focusreactive.com/playwright-testing-on-ci-using-github-actions-and-vercel/) - deployment_statusトリガーとenvironment filter確認

### Tertiary (LOW confidence)
- WebSearch結果: Supabase + GitHub Actions接続はデフォルト設定で可能（IP制限なし）という情報（未検証のため実装時に確認が必要）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - patrickedqvist/wait-for-vercel-previewはv1.3.3が最新安定版として公式確認済み
- Architecture: HIGH - pull_request+2-job構成は複数公式ソースで確認
- Pitfalls: MEDIUM - Deployment Protectionの状況はプロジェクト固有のため現物確認が必要

**Research date:** 2026-03-16
**Valid until:** 2026-04-16（GitHub Actions/Vercel統合は比較的安定しているため30日）
