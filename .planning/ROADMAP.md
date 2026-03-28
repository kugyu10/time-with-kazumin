# Roadmap: Time with Kazumin

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-02-23)
- ✅ **v1.1 営業時間拡張** — Phase 7 (shipped 2026-03-03)
- ✅ **v1.2 安定化** — Phases 8-11 (shipped 2026-03-16)
- 🚧 **v1.3 運用改善** — Phases 12-16 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-02-23</summary>

- [x] Phase 1: データベース基盤 (2/2 plans) — completed 2026-02-22
- [x] Phase 2: 認証と予約コア (3/3 plans) — completed 2026-02-22
- [x] Phase 3: ゲスト予約体験 (2/2 plans) — completed 2026-02-22
- [x] Phase 4: 外部API統合 (3/3 plans) — completed 2026-02-22
- [x] Phase 5: 管理機能 (3/3 plans) — completed 2026-02-22
- [x] Phase 6: 自動化タスク (2/2 plans) — completed 2026-02-23

</details>

<details>
<summary>✅ v1.1 営業時間拡張 (Phase 7) — SHIPPED 2026-03-03</summary>

- [x] Phase 7: 営業時間拡張 (1/1 plan) — completed 2026-03-03

</details>

<details>
<summary>✅ v1.2 安定化 (Phases 8-11) — SHIPPED 2026-03-16</summary>

- [x] Phase 8: バグ修正 (2/2 plans) — completed 2026-03-15
- [x] Phase 9: Playwright基盤 (2/2 plans) — completed 2026-03-15
- [x] Phase 10: テストシナリオ (2/2 plans) — completed 2026-03-15
- [x] Phase 11: CI統合 (1/1 plan) — completed 2026-03-16

</details>

### 🚧 v1.3 運用改善 (In Progress)

**Milestone Goal:** プランタイプ別メニュー制御、Zoomカレンダーブロック、ポイント溢れ通知、会員アクティビティ可視化で運用品質を向上

- [x] **Phase 12: DBスキーマ基盤** — プランタイプ別メニューを支えるDBマイグレーション適用 (completed 2026-03-27)
- [x] **Phase 13: Zoomカレンダーブロック** — ZoomスケジュールをBusyTimeとして空き枠判定に統合 (completed 2026-03-28)
- [x] **Phase 14: プランタイプ別メニュー表示** — メニュー可視性を会員のプランタイプで制御 (completed 2026-03-28)
- [x] **Phase 15: ポイント溢れ通知メール** — 毎月20日に溢れ予定会員へ自動メール配信 (completed 2026-03-28)
- [x] **Phase 16: 会員アクティビティ表示** — 管理画面で30日/60日未訪問会員を色分け表示 (completed 2026-03-28)

## Phase Details

### Phase 12: DBスキーマ基盤
**Goal**: プランタイプ別メニュー表示（Phase 14）を実装可能にするDBマイグレーションが適用された状態にする
**Depends on**: Nothing (Phase 11完了後)
**Requirements**: MENU-01, MENU-03, MENU-05
**Success Criteria** (what must be TRUE):
  1. `meeting_menus` テーブルに `allowed_plan_types INTEGER[] DEFAULT NULL` カラムが存在する
  2. 既存メニューの `allowed_plan_types` が NULL（後方互換: 全プラン表示）で動作している
  3. 「お金のブロック解消プラン」が `plans` テーブルに新規プランタイプとして登録できる
  4. GINインデックスが `allowed_plan_types` カラムに適用されている
**Plans**: 1 plan

Plans:
- [x] 12-01-PLAN.md — マイグレーション適用（カラム追加 + seedデータ + 型再生成）

### Phase 13: Zoomカレンダーブロック
**Goal**: ZOOM_AおよびZOOM_Bのスケジュール済みミーティングが空き枠判定に反映され、Zoomと予約システムの矛盾が解消される
**Depends on**: Phase 12
**Requirements**: ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04
**Success Criteria** (what must be TRUE):
  1. ZOOM_Aでスケジュール済みの会議がある時間帯は、予約スロット一覧に表示されない
  2. ZOOM_Bでスケジュール済みの会議がある時間帯は、予約スロット一覧に表示されない
  3. スロット一覧表示時はZoomスケジュール取得結果が15分キャッシュされ、頻繁なAPI呼び出しが発生しない
  4. 予約確定時はキャッシュを無視してZoomスケジュールをリアルタイムで再確認し、二重予約を防ぐ
  5. ZOOM_B（無料アカウント）がAPIスコープ制限（エラー3161）を返した場合、空配列フォールバックでシステムが正常動作する
**Plans**: 2 plans

Plans:
- [x] 13-01-PLAN.md — Zoomスケジュール取得関数 + キャッシュ + テスト
- [x] 13-02-PLAN.md — スロットAPIへのZoomビジー時間マージ + Sagaリアルタイム競合チェック

### Phase 14: プランタイプ別メニュー表示
**Goal**: 会員が予約画面を開いたとき、自分のプランタイプに対応するメニューのみが表示され、無関係なメニューが見えない
**Depends on**: Phase 12
**Requirements**: MENU-02, MENU-04
**Success Criteria** (what must be TRUE):
  1. 管理画面でメニューごとに「対象プランタイプ」を設定でき、保存が反映される
  2. 通常プラン会員の予約画面には、通常プラン対象メニューのみ表示される
  3. 「お金のブロック解消プラン」会員の予約画面には、そのプラン専用メニューが表示される
  4. `allowed_plan_types` が NULL のメニューは全プランの会員に表示される（後方互換）
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — 管理画面メニューCRUDにallowed_plan_typesフィールド追加 + チェックボックスUI
- [ ] 14-02-PLAN.md — 会員予約画面のプランタイプ別メニューフィルタ + ユニットテスト

### Phase 15: ポイント溢れ通知メール
**Goal**: ポイントが翌月付与でmax_pointsを超える予定の会員に対し、毎月20日に自動でリマインダーメールが届く
**Depends on**: Phase 12
**Requirements**: POINT-01, POINT-02, POINT-03, POINT-04, POINT-05
**Success Criteria** (what must be TRUE):
  1. 毎月20日（JST 09:00 = UTC 00:00）に、ポイント溢れ予定の会員全員にメールが自動送信される
  2. メール本文に現在ポイント・月次付与ポイント・上限・溢れ量が記載されている
  3. 同月に複数回バッチが走っても、メールが重複送信されない（冪等性）
  4. 管理画面のタスク実行履歴で、ポイント溢れ通知の実行状況（成功/失敗/送信件数）を確認できる
**Plans**: 2 plans

Plans:
- [ ] 15-01-PLAN.md — DB マイグレーション + TypeScript 型拡張 + React Email テンプレート
- [ ] 15-02-PLAN.md — ポイント溢れ通知 Edge Function 実装

### Phase 16: 会員アクティビティ表示
**Goal**: 管理者が会員一覧を見るだけで、フォローが必要な会員を色分けで即座に把握できる
**Depends on**: Phase 12
**Requirements**: ACT-01, ACT-02, ACT-03
**Success Criteria** (what must be TRUE):
  1. 管理画面の会員一覧で、30日以上来ていない（かつ次の予約なし）会員が黄色でハイライト表示される
  2. 管理画面の会員一覧で、60日以上来ていない（かつ次の予約なし）会員が赤でハイライト表示される
  3. 管理ダッシュボード下部に、黄色・赤の会員リストが前回セッション日時付きで表示される
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md — Member型拡張 + getMembers() bookings集計 + calcActivityStatusユニットテスト
- [ ] 16-02-PLAN.md — 会員一覧行色分け + 前回セッションカラム + ダッシュボードFollowUpList

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. データベース基盤 | v1.0 | 2/2 | Complete | 2026-02-22 |
| 2. 認証と予約コア | v1.0 | 3/3 | Complete | 2026-02-22 |
| 3. ゲスト予約体験 | v1.0 | 2/2 | Complete | 2026-02-22 |
| 4. 外部API統合 | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5. 管理機能 | v1.0 | 3/3 | Complete | 2026-02-22 |
| 6. 自動化タスク | v1.0 | 2/2 | Complete | 2026-02-23 |
| 7. 営業時間拡張 | v1.1 | 1/1 | Complete | 2026-03-03 |
| 8. バグ修正 | v1.2 | 2/2 | Complete | 2026-03-15 |
| 9. Playwright基盤 | v1.2 | 2/2 | Complete | 2026-03-15 |
| 10. テストシナリオ | v1.2 | 2/2 | Complete | 2026-03-15 |
| 11. CI統合 | v1.2 | 1/1 | Complete | 2026-03-16 |
| 12. DBスキーマ基盤 | v1.3 | 1/1 | Complete   | 2026-03-27 |
| 13. Zoomカレンダーブロック | v1.3 | 2/2 | Complete    | 2026-03-28 |
| 14. プランタイプ別メニュー表示 | 2/2 | Complete    | 2026-03-28 | - |
| 15. ポイント溢れ通知メール | 2/2 | Complete    | 2026-03-28 | - |
| 16. 会員アクティビティ表示 | 2/2 | Complete    | 2026-03-28 | - |

### Phase 17: E2Eテスト修正

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 16
**Plans:** 0/1 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 17 to break down) (completed 2026-03-28)

### Phase 18: Saga補償トランザクション修正

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 17
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 18 to break down)
