---
phase: 15
slug: point-overflow-notify
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (既存) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__/lib/email` |
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
| 15-01-01 | 01 | 1 | POINT-01, POINT-03, POINT-04 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | POINT-02 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | POINT-04 | integration | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | POINT-05 | unit | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Edge Function testing is manual (Deno runtime).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edge Function がポイント溢れ会員にメール送信 | POINT-01 | Requires Supabase + Resend live environment | `supabase functions invoke point-overflow-notify` で手動実行、Resend ダッシュボードで送信確認 |
| pg_cron が毎月20日に自動実行 | POINT-01 | Requires production cron scheduler | Supabase ダッシュボードの cron jobs でスケジュール確認 |
| 冪等性（重複送信防止） | POINT-04 | Requires two consecutive invocations | Edge Function を2回連続で invoke し、2回目が skip されることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
