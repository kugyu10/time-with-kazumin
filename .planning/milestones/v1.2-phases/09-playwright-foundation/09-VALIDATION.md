---
phase: 9
slug: playwright-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 |
| **Config file** | `playwright.config.ts` (Wave 0 で新規作成) |
| **Quick run command** | `npx playwright test --project=setup` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=setup`
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | E2E-01 | smoke | `npm install --save-dev @playwright/test@1.58.2 && npx playwright install chromium` | ❌ Wave 0 | ⬜ pending |
| 09-01-02 | 01 | 1 | E2E-01 | smoke | `npx playwright test --list` | ❌ Wave 0 | ⬜ pending |
| 09-01-03 | 01 | 1 | E2E-01 | smoke | `grep "e2e/.auth" .gitignore` | ❌ Wave 0 | ⬜ pending |
| 09-02-01 | 02 | 1 | E2E-01 | integration | `npx playwright test --project=setup` | ❌ Wave 0 | ⬜ pending |
| 09-02-02 | 02 | 1 | E2E-01 | integration | `npx playwright test --project=setup` | ❌ Wave 0 | ⬜ pending |
| 09-02-03 | 02 | 1 | E2E-01 | smoke | `npm run test:e2e` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — Playwright 設定ファイル（09-01-PLAN.md で作成）
- [ ] `e2e/global-setup.ts` — テストユーザー作成（09-02-PLAN.md で作成）
- [ ] `e2e/global-teardown.ts` — テストユーザー削除（09-02-PLAN.md で作成）
- [ ] `e2e/auth.setup.ts` — storageState 保存（09-02-PLAN.md で作成）
- [ ] `e2e/fixtures.ts` — カスタムフィクスチャ（09-02-PLAN.md で作成）
- [ ] Framework install: `npm install --save-dev @playwright/test@1.58.2 && npx playwright install chromium`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run test:e2e:ui` でPlaywright UIモードが起動する | E2E-01 | ブラウザGUI操作が必要 | `npm run test:e2e:ui` を実行し、ブラウザでPlaywright UIが開くことを確認 |
| Vercel preview URLへの接続確認 | E2E-01 | CI環境のVercel URL設定が必要 | `PLAYWRIGHT_BASE_URL=<vercel-url> CI=true npm run test:e2e` を実行し、接続できることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
