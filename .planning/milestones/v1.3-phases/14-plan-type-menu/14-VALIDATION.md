---
phase: 14
slug: plan-type-menu
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (既存) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/lib/actions/admin/menus.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/lib/actions/admin/menus.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | MENU-02 | unit | `npx vitest run` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | MENU-02, MENU-04 | integration | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test files needed for Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 会員予約画面でプランタイプに応じたメニューのみ表示 | MENU-02 | UI rendering + auth context required | ログインして予約画面を開き、プランタイプに対応するメニューのみ表示されることを確認 |
| お金のブロック解消プラン専用メニューの表示制御 | MENU-04 | Requires specific plan type member | お金のブロック解消プラン会員でログインし、専用メニューが表示されることを確認 |
| 管理画面でallowed_plan_types設定 | MENU-02 | Admin UI interaction | 管理画面でメニュー編集、チェックボックスで設定変更、保存後に反映を確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
