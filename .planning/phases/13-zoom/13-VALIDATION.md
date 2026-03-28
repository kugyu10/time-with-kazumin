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
| **Framework** | vitest ^4.0.18 (既存) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/lib/integrations/zoom.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | ZOOM-01, ZOOM-02, ZOOM-03 | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅ (追記) | ⬜ pending |
| 13-02-01 | 02 | 2 | ZOOM-01, ZOOM-02, ZOOM-03 | integration | `npx vitest run` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | ZOOM-04 | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅ (追記) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lib/integrations/zoom.test.ts` — 既存ファイルに Zoom スケジュール取得テストを追記 (ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04)
- [ ] Mock fixtures for Zoom API responses (scheduled meetings list, error 3161)

*既存 `zoom.test.ts` を拡張して全 Zoom テストを1ファイルに集約。*

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
