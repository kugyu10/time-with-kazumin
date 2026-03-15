---
phase: 10
slug: test-scenarios
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 |
| **Config file** | `playwright.config.ts`（Phase 9 で作成済み） |
| **Quick run command** | `npx playwright test e2e/specs/booking-flow.spec.ts` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/specs/<対象ファイル>.spec.ts --project=chromium`
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | E2E-02 | e2e | `npx playwright test e2e/specs/booking-flow.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 10-01-02 | 01 | 1 | E2E-02 | e2e | `npx playwright test e2e/specs/booking-flow.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 10-02-01 | 02 | 2 | E2E-03 | e2e | `npx playwright test e2e/specs/auth.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 10-02-02 | 02 | 2 | E2E-04 | e2e | `npx playwright test e2e/specs/member-booking.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/specs/booking-flow.spec.ts` — E2E-02 ゲスト予約フロー
- [ ] `e2e/specs/auth.spec.ts` — E2E-03 会員ログインフロー
- [ ] `e2e/specs/member-booking.spec.ts` — E2E-04 会員予約フロー
- [ ] `e2e/specs/` ディレクトリ作成
- [ ] `e2e/global-setup.ts` に member_plans 挿入を追加（E2E-04 前提条件）

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zoom URL が success ページに表示 | E2E-02 | 実 Zoom API 呼び出し不可のため page.route() モックの結果を確認 | booking-flow.spec.ts 内でモック化した zoom_join_url が画面に表示されることを自動テストで検証 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
