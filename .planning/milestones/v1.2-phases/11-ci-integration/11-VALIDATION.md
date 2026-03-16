---
phase: 11
slug: ci-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npx playwright test --reporter=list` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** 該当なし（ワークフローファイルのみのフェーズ）
- **After every plan wave:** PR作成でワークフローが発火するか手動確認
- **Before `/gsd:verify-work`:** develop→main PR作成時にGitHub Actions E2Eテストが成功すること
- **Max feedback latency:** N/A（CI実行のため手動確認）

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | E2E-05 | smoke（手動） | PR作成後にGitHub Actions UIで確認 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/e2e.yml` — E2E-05のCI統合ワークフロー本体
- [ ] GitHub Secretsの設定 — `SUPABASE_DEV_URL`, `SUPABASE_DEV_ANON_KEY`, `SUPABASE_DEV_SERVICE_ROLE_KEY`, `JWT_CANCEL_SECRET`, `E2E_MEMBER_EMAIL`, `E2E_MEMBER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| develop→main PRでCI E2Eが自動実行される | E2E-05 | GitHub Actions実行はCI環境でしか確認不可 | PRを作成し、ActionsタブでE2Eジョブが発火することを確認 |
| テスト失敗時にアーティファクトが保存される | E2E-05 | CI環境での失敗時動作確認が必要 | テストを意図的に失敗させ、Actionsのアーティファクトにレポートが残ることを確認 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
