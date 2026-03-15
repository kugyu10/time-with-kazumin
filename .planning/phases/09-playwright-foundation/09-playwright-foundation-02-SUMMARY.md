---
phase: 09-playwright-foundation
plan: 02
subsystem: testing
tags: [playwright, e2e, supabase, auth, storageState, fixtures]

# Dependency graph
requires:
  - phase: 09-playwright-foundation-01
    provides: playwright.config.ts、npm scripts、e2eスタブファイル群
provides:
  - global-setup.ts: Supabase admin APIでテストユーザー2名（会員・管理者）を作成しprofilesテーブルにrole設定
  - global-teardown.ts: テストユーザーをメールアドレスで検索してauth/profilesから削除
  - auth.setup.ts: LoginFormの実UIセレクタで /login にログインし storageState を e2e/.auth/ に保存
  - fixtures.ts: memberPage / adminPage カスタムフィクスチャ（Phase 10で使用）
affects:
  - 10-e2e-tests

# Tech tracking
tech-stack:
  added: []
  patterns:
    - global-setup/teardownパターン: Supabase admin APIでテストユーザーのライフサイクル管理
    - storageState再利用パターン: ログインセッションをJSONファイルに保存してテスト間で再利用
    - カスタムフィクスチャパターン: base.extend<T>でmemberPage/adminPageを型安全に定義

key-files:
  created:
    - e2e/global-setup.ts
    - e2e/global-teardown.ts
    - e2e/auth.setup.ts
    - e2e/fixtures.ts
  modified: []

key-decisions:
  - "requireAdmin()はapp_metadataではなくprofilesテーブルのroleカラムで判定するため、global-setupではauth.admin.createUser()後にprofilesテーブルへupsertが必要"
  - "auth.setup.tsのセレクタはLoginFormの実装に合わせてpage.getByLabel('メールアドレス')等を使用"
  - "管理者ユーザーもログイン後は/bookings/newにリダイレクトされる（LoginForm実装の動作）"

patterns-established:
  - "E2Eテストユーザー作成: Supabase admin API（service role key）でcreateUser + profilesテーブルupsert"
  - "storageState保存先: e2e/.auth/member.json, e2e/.auth/admin.json"
  - "Phase 10テスト記述時はe2e/fixtures.tsのtest（memberPage/adminPage付き）をimportする"

requirements-completed:
  - E2E-01

# Metrics
duration: 継続実行（チェックポイント込み）
completed: 2026-03-15
---

# Phase 9 Plan 02: Playwright E2E認証基盤 Summary

**Supabase admin APIによるテストユーザー自動管理とstorageState再利用パターンを確立し、Phase 10のE2Eテスト記述に必要な認証基盤を構築した**

## Performance

- **Duration:** チェックポイント込み（Task 1-2: 自動実行、Task 3: 人間確認）
- **Started:** Task 1 commit: 2fe6265
- **Completed:** 2026-03-15
- **Tasks:** 3（Task 1: auto、Task 2: auto、Task 3: human-verify承認済み）
- **Files modified:** 4ファイル新規作成

## Accomplishments

- global-setup.ts: Supabase admin APIでテストユーザー2名を作成し、profilesテーブルにrole（member/admin）を設定する
- global-teardown.ts: テストユーザーをメールで検索してauth/profilesから削除する（テスト後クリーンアップ）
- auth.setup.ts: LoginFormの実UIセレクタを使ってブラウザ経由でログインし、storageStateをe2e/.auth/に保存する
- fixtures.ts: memberPage/adminPageカスタムフィクスチャを定義し、Phase 10での認証済みテスト記述を型安全にサポート

## Task Commits

各タスクはアトミックにコミット済み:

1. **Task 1: global-setup.ts と global-teardown.ts 作成** - `2fe6265` (feat)
2. **Task 2: auth.setup.ts と fixtures.ts 作成** - `5523860` (feat)
3. **Task 3: E2E基盤の動作確認** - 人間確認済み（コミット不要）

## Files Created/Modified

- `e2e/global-setup.ts` - Supabase admin APIでテストユーザー作成（会員・管理者）、profilesテーブルへrole upsert
- `e2e/global-teardown.ts` - メールで検索してテストユーザーを削除
- `e2e/auth.setup.ts` - LoginFormの実UIセレクタ使用、/loginでログイン→storageState保存
- `e2e/fixtures.ts` - memberPage/adminPageカスタムフィクスチャ定義

## Decisions Made

- **requireAdmin()判定方式の確認:** app_metadataではなくprofilesテーブルのroleカラムで判定するため、`auth.admin.updateUserById()`は不要。`supabase.from('profiles').upsert()`でrole設定する
- **管理者ログイン後のリダイレクト:** LoginForm実装の動作に従い、管理者も`/bookings/new`にリダイレクトされることを確認
- **storageStateディレクトリ:** global-setup.tsでe2e/.authを`fs.mkdirSync({ recursive: true })`で事前作成（Pitfall対策）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**実際のE2Eテスト実行には .env.test の手動設定が必要:**

```bash
cp .env.test.example .env.test
# 以下の値を実際のSupabase dev環境の値に設定する
# NEXT_PUBLIC_SUPABASE_URL=
# SUPABASE_SERVICE_ROLE_KEY=
# E2E_MEMBER_EMAIL=
# E2E_MEMBER_PASSWORD=
# E2E_ADMIN_EMAIL=
# E2E_ADMIN_PASSWORD=
```

その後、`npx playwright test --project=setup` を実行して `e2e/.auth/member.json` と `e2e/.auth/admin.json` が生成されることを確認する。

**Vercel Deployment Protection 確認:**
CI環境での実行前に、Vercel dashboardでdevelopブランチのDeployment Protectionを確認・無効化すること（STATE.mdに記載のブロッカー）。

## Next Phase Readiness

- Phase 10 (E2Eテストシナリオ) で `e2e/fixtures.ts` の `memberPage` / `adminPage` フィクスチャを直接使用可能
- `.env.test` 設定後、`npm run test:e2e` で全E2Eテストを実行できる
- `npm run test:e2e:ui` でPlaywright UIモードを使ってテストをインタラクティブに開発・デバッグ可能
- ブロッカー: Vercel Deployment Protection設定の確認（Phase 10前に必要）

---
*Phase: 09-playwright-foundation*
*Completed: 2026-03-15*
