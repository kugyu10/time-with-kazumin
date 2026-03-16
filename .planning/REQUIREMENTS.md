# Requirements: Time with Kazumin

**Defined:** 2026-03-15
**Core Value:** 気軽にかずみんに会いに行ける予約体験

## v1.2 Requirements

### バグ修正

- [x] **BUG-01**: キャンセル時にZoom側の会議が確実に削除される（GitHub #1）
- [x] **BUG-02**: `/booking/[id]` の予約詳細画面の時刻がJSTで表示される（GitHub #2）
- [x] **BUG-03**: 全画面でJST表示を統一し、UTC/JST変換コード規約を `docs/rules.md` に明文化する（GitHub #2 横展開）
- [x] **BUG-04**: 会員招待完了後にウェルカムメールが送信される（GitHub #3）
- [x] **BUG-05**: 管理者Googleカレンダーの予定がスロットに正確にブロックされる（GitHub #4）

### E2Eテスト

- [x] **E2E-01**: Playwright環境が構築され、Vercel preview（developブランチ）+ Supabase dev環境を対象にテストが実行できる
- [x] **E2E-02**: ゲスト予約フロー（閲覧→予約→キャンセル）のE2Eテストが通る
- [x] **E2E-03**: 会員ログインフロー（メール/パスワード）のE2Eテストが通る
- [x] **E2E-04**: 会員予約フロー（メニュー選択→ポイント消費→予約）のE2Eテストが通る
- [x] **E2E-05**: GitHub ActionsでE2EテストがVercel preview URL向けに自動実行される

## Future Requirements

### 管理者E2Eテスト

- **E2E-ADM-01**: 管理者ログインフロー
- **E2E-ADM-02**: 管理者予約管理フロー

## Out of Scope

| Feature | Reason |
|---------|--------|
| Google OAuth E2Eテスト | Bot検出・ToS違反リスク。メール/パスワード認証でカバー |
| 外部API（Zoom/Calendar/Resend）の実呼び出しテスト | 環境変数フラグによるスタブ切り替えで代替 |
| ローカル開発サーバーE2E | 環境差分を排除するためVercel preview環境に統一。ローカル品質はUT（Vitest等）で担保 |
| ユニットテスト導入 | 別途計画（v1.3候補） |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 8 | Complete |
| BUG-02 | Phase 8 | Complete |
| BUG-03 | Phase 8 | Complete |
| BUG-04 | Phase 8 | Complete |
| BUG-05 | Phase 8 | Complete |
| E2E-01 | Phase 9 | Complete |
| E2E-02 | Phase 10 | Complete |
| E2E-03 | Phase 10 | Complete |
| E2E-04 | Phase 10 | Complete |
| E2E-05 | Phase 11 | Complete |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 — Roadmap created, traceability updated (Phase 8-11)*
