# Milestones

## v1.3 運用改善 (Shipped: 2026-03-29)

**Phases completed:** 7 phases, 11 plans, 4 tasks

**Key accomplishments:**
- (none recorded)

---

## v1.2 安定化 (Shipped: 2026-03-16)

**Phases:** 8-11 (4 phases, 7 plans)
**Timeline:** 23 days (2026-02-22 → 2026-03-16)
**Audit:** tech_debt (10/10 requirements satisfied, 7 tech debt items accepted)

**Key accomplishments:**
- Zoom会議削除の確実化 + Googleカレンダー診断ログ追加（BUG-01, BUG-05）
- 全画面JST時刻表示統一 + ウェルカムメール実装 + UTC/JST規約明文化（BUG-02~04）
- Playwright E2E基盤構築（config, global-setup/teardown, auth.setup, fixtures）
- ゲスト予約・会員ログイン・会員予約の3フローE2Eテスト実装
- GitHub Actions CI統合 — develop→main PR時にVercel preview URLでE2E自動実行

**Known Gaps (tech debt accepted):**
- `bookings/complete/page.tsx` timeZone未指定（BUG-03漏れ）
- `admin/tasks/columns.tsx` date-fns timeZone未指定
- CI実行で2件テスト失敗（booking_type, UIテキスト不一致）
- `.env.test.example` JWT_CANCEL_SECRET未記載

---

## v1.1 営業時間拡張 (Shipped: 2026-03-03)

**Phases completed:** 7 phases, 16 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v1.0 MVP (Shipped: 2026-02-23)

**Phases completed:** 6 phases, 15 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

