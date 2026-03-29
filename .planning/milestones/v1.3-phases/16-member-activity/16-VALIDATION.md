---
phase: 16
slug: member-activity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (既存) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/lib/utils/member-activity` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | ACT-01, ACT-02 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-01-02 | 01 | 1 | ACT-01, ACT-02 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-02-01 | 02 | 2 | ACT-03 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. UI changes are verified visually + tsc.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 30日未訪問会員の黄色ハイライト | ACT-01 | UI rendering | 会員一覧を開き、30日以上未訪問会員の行が黄色背景であることを確認 |
| 60日未訪問会員の赤ハイライト | ACT-02 | UI rendering | 会員一覧を開き、60日以上未訪問会員の行が赤背景であることを確認 |
| ダッシュボードのフォローリスト | ACT-03 | UI rendering + data | ダッシュボードを開き、フォロー対象会員が前回セッション日時付きで表示されることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
