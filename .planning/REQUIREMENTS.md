# Requirements: Time with Kazumin

**Defined:** 2026-03-27
**Core Value:** 気軽にかずみんに会いに行ける予約体験

## v1 Requirements

Requirements for v1.3 運用改善. Each maps to roadmap phases.

### Zoomカレンダーブロック

- [x] **ZOOM-01**: ZOOM_Aのスケジュール済みミーティングを空き時間判定でブロック対象にできる
- [x] **ZOOM-02**: ZOOM_Bのスケジュール済みミーティングを空き時間判定でブロック対象にできる
- [x] **ZOOM-03**: Zoomスケジュール取得結果を15分キャッシュで効率化する（スロット一覧表示用）
- [x] **ZOOM-04**: 予約確定時はキャッシュを無視しZoomスケジュールをリアルタイムで再確認する

### プランタイプ別メニュー表示

- [x] **MENU-01**: メニューごとに対象プランタイプを設定できる（管理画面）
- [x] **MENU-02**: 会員は自分のプランタイプに対応するメニューのみ予約画面に表示される
- [x] **MENU-03**: 「お金のブロック解消プラン」を新規プランタイプとして作成できる
- [x] **MENU-04**: 「お金のブロック解消120分セッション」メニューはお金のブロック解消プランの会員のみに表示される
- [x] **MENU-05**: プランタイプ未設定のメニューは全プランに表示される（後方互換）

### ポイント溢れ通知メール

- [x] **POINT-01**: 毎月20日に、翌月ポイント付与でmax_pointsを超える会員全員にリマインダーメールを送信する
- [x] **POINT-02**: メール文面は管理者が編集可能なテンプレートファイルで管理する
- [x] **POINT-03**: メールに現在ポイント・月次付与ポイント・上限・溢れ量を記載する
- [x] **POINT-04**: 送信履歴をtask_execution_logsに記録し、冪等性を担保する
- [x] **POINT-05**: 管理画面のタスク実行履歴でポイント溢れ通知の実行状況を確認できる

### 会員アクティビティ表示

- [x] **ACT-01**: 管理画面の会員一覧で、30日以上来ていない（＆次の予約なし）会員を黄色で表示する
- [x] **ACT-02**: 管理画面の会員一覧で、60日以上来ていない（＆次の予約なし）会員を赤で表示する
- [x] **ACT-03**: ダッシュボード下部に、黄色・赤の会員リストを前回セッション日時付きで表示する

## v2 Requirements

Deferred to future release.

- **ZOOM-F01**: Zoomカレンダーブロックの根本対応（Googleカレンダー側での一元管理）
- **MENU-F01**: プランタイプの自動切り替え（有効期限ベース）

## Out of Scope

| Feature | Reason |
|---------|--------|
| Zoom OAuth再認証UI | S2S OAuthのためユーザー認証不要 |
| メニュー表示の時間帯制御 | プランタイプ制御で十分、過度な複雑性 |
| ポイント溢れ自動消費 | ビジネスルールが未定義、手動予約を促す方針 |
| メールテンプレートUI編集（管理画面内） | ファイルベースで編集可能にするため、管理画面UIは不要 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ZOOM-01 | Phase 13 | Complete |
| ZOOM-02 | Phase 13 | Complete |
| ZOOM-03 | Phase 13 | Complete |
| ZOOM-04 | Phase 13 | Complete |
| MENU-01 | Phase 12 | Complete |
| MENU-02 | Phase 14 | Complete |
| MENU-03 | Phase 12 | Complete |
| MENU-04 | Phase 14 | Complete |
| MENU-05 | Phase 12 | Complete |
| POINT-01 | Phase 15 | Complete |
| POINT-02 | Phase 15 | Complete |
| POINT-03 | Phase 15 | Complete |
| POINT-04 | Phase 15 | Complete |
| POINT-05 | Phase 15 | Complete |
| ACT-01 | Phase 16 | Complete |
| ACT-02 | Phase 16 | Complete |
| ACT-03 | Phase 16 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation (v1.3 Phases 12-16)*
