# Requirements: Time with Kazumin

**Defined:** 2026-03-03
**Core Value:** 気軽にかずみんに会いに行ける予約体験

## v1.1 Requirements

### 祝日対応 (HOLIDAY)

- [x] **HOLIDAY-01**: 祝日は全曜日共通で1つの営業時間パターンを適用できる
- [ ] **HOLIDAY-02**: 祝日かどうかを外部API（holidays-jp）で自動判定する
- [x] **HOLIDAY-03**: 管理画面で祝日用の営業時間を設定できる

### 休憩時間 (BREAK)

- [ ] **BREAK-01**: 曜日ごとに休憩時間（開始・終了）を設定できる
- [ ] **BREAK-02**: 休憩時間中は予約スロットが表示されない

### 予約自動完了 (AUTO)

- [ ] **AUTO-01**: 予約終了30分後に自動的にステータスがcompletedになる
- [ ] **AUTO-02**: サンキューメールはステータスがcompletedになった予約に送信される

## v2 Requirements

(None planned)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 祝日の手動登録 | 外部APIで自動判定するため不要 |
| 複数休憩時間/曜日 | 1つで十分、複雑さ回避 |
| 予約完了の手動トリガー | 自動完了で十分 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOLIDAY-01 | Phase 7 | Complete |
| HOLIDAY-02 | Phase 7 | Pending |
| HOLIDAY-03 | Phase 7 | Complete |
| BREAK-01 | Phase 7 | Pending |
| BREAK-02 | Phase 7 | Pending |
| AUTO-01 | Phase 7 | Pending |
| AUTO-02 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
