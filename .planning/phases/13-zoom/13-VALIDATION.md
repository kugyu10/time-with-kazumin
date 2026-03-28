---
phase: 13
slug: zoom
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (既存) |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npx jest --testPathPattern="zoom" --no-coverage` |
| **Full suite command** | `npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="zoom" --no-coverage`
- **After every plan wave:** Run `npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | ZOOM-01, ZOOM-02 | unit | `npx jest --testPathPattern="zoom" --no-coverage` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | ZOOM-03 | unit | `npx jest --testPathPattern="zoom" --no-coverage` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | ZOOM-04 | unit | `npx jest --testPathPattern="zoom" --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lib/integrations/zoom-schedule.test.ts` — stubs for ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04
- [ ] Mock fixtures for Zoom API responses (scheduled meetings list, error 3161)

*Existing `src/__tests__/lib/integrations/zoom.test.ts` covers meeting creation/deletion — schedule tests extend this.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ZOOM_B error 3161 fallback in production | ZOOM-04 | Requires real Zoom free account API call | curl GET /users/me/meetings with ZOOM_B credentials, verify error code and fallback behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
