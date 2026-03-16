# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — 安定化

**Shipped:** 2026-03-16
**Phases:** 4 | **Plans:** 7

### What Was Built
- 5件の本番バグ修正（Zoom削除、JST時刻統一、ウェルカムメール、カレンダーブロック）
- Playwright E2E基盤（global-setup/teardown、auth.setup、fixtures）
- ゲスト予約・会員ログイン・会員予約の3フローE2Eテスト
- GitHub Actions CI統合（develop→main PR時にVercel preview URLでE2E自動実行）

### What Worked
- Phase 9-11のテスト基盤→シナリオ→CIの段階的ビルドアップが効果的だった
- playwright.config.tsのCI/ローカルデュアルモード設計が初回CI実行をスムーズにした
- page.route()モック方式で外部APIに依存しないE2Eが安定動作
- patrickedqvist/wait-for-vercel-previewがGITHUB_TOKENのみで動作し、設定がシンプルだった

### What Was Inefficient
- ROADMAP.mdのSuccess Criteriaとテストコードの乖離（ポイント変化検証、ログインリダイレクト先）
- bookings/complete/page.tsxのtimeZone修正漏れ（BUG-03の横展開不完全）
- global-setupでbooking_typeカラムを参照→スキーマ変更との不整合でCIテスト失敗
- .env.test.exampleにJWT_CANCEL_SECRETの記載漏れ

### Patterns Established
- E2Eテストは外部API（Zoom/Calendar/Resend）をpage.route()でモック化する
- CI環境ではVercel preview URLに対してテストを実行する（ローカルサーバー不使用）
- docs/rules.mdにコーディング規約を明文化する習慣
- テストユーザーはglobal-setup/teardownでライフサイクル管理

### Key Lessons
1. JST/UTC修正のような横断的変更は影響範囲を網羅的にチェックする（grepで全ファイル確認）
2. Success Criteriaは実装の技術的制約を考慮して書くべき（モック環境でのポイント変化検証は不可能）
3. スキーマ変更時はglobal-setup.tsのテストデータ挿入も同時に更新する

### Cost Observations
- Model mix: planner=inherit(opus), executor=sonnet, verifier=sonnet, researcher=sonnet
- 4フェーズを1セッションで完了（Phase 8-11）
- Phase 11は1プラン（e2e.yml作成のみ）で非常にコンパクト

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 6 | 15 | 初期MVP、全機能実装 |
| v1.1 | 1 | 1 | 小規模機能追加 |
| v1.2 | 4 | 7 | 品質安定化、E2Eテスト導入 |

### Cumulative Quality

| Milestone | E2E Tests | CI | Known Tech Debt |
|-----------|-----------|-----|-----------------|
| v1.0 | 0 | なし | なし |
| v1.1 | 0 | なし | なし |
| v1.2 | 10 (6 pass, 2 fail, 2 skip) | GitHub Actions | 7 items |

### Top Lessons (Verified Across Milestones)

1. 横断的変更（JST/UTC等）は影響範囲の網羅的チェックが必須
2. E2Eテストのモック設計は事前にSuccess Criteriaとの整合性を確認する
3. CI統合は最後のフェーズにして、テスト基盤→シナリオ→CIの順で積み上げる
