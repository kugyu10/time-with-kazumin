---
phase: 8
slug: bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（src/__tests__/ に既存テストあり） |
| **Config file** | vitest.config.ts または package.json |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | BUG-01 | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | BUG-05 | manual | スロット画面で管理者予定が反映されることを目視確認 | - | ⬜ pending |
| 8-02-01 | 02 | 1 | BUG-02 | manual | `/booking/[id]` でJST表示を目視確認 | - | ⬜ pending |
| 8-02-02 | 02 | 1 | BUG-03 | manual | 全画面（ゲスト/会員/管理者）でJST統一を目視確認 | - | ⬜ pending |
| 8-02-03 | 02 | 1 | BUG-04 | unit | `npx vitest run src/__tests__/lib/integrations/email.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/lib/integrations/zoom.test.ts` — Zoom削除シナリオの追加テストケース（BUG-01）
- [ ] `src/__tests__/lib/integrations/email.test.ts` — `sendWelcomeEmail` テストケース追加（BUG-04）

*(既存のテストインフラは存在する。新規テストケースの追加のみ必要)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/booking/[id]` でJST表示 | BUG-02 | UIレンダリング確認はVercel preview必須 | Vercel preview URLで予約詳細画面を開き、時刻がJST（例: 14:00 JST）で表示されることを確認 |
| 全画面でJST統一 | BUG-03 | 複数画面の目視確認 | ゲスト予約画面、会員ダッシュボード、管理者予約一覧でUTC表示がないことを確認 |
| Googleカレンダーブロック | BUG-05 | 本番/Googleカレンダー連携が必要 | 管理者Googleカレンダーに予定を追加し、スロット一覧に反映されて予約不可になることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
