---
status: complete
phase: 08-bug-fixes
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md]
started: 2026-03-15T07:20:00Z
updated: 2026-03-15T07:40:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. 予約キャンセル時のZoom会議削除（BUG-01）
expected: 予約をキャンセルしたとき、Zoom会議が正しく削除される。キャンセル処理が完了し、エラーが発生しない。
result: pass

### 2. 予約詳細画面のJST時刻表示（BUG-02）
expected: /bookings/[id]（会員向け予約詳細画面）を開くと、予約の日時がJST（例: 14:00）で表示される。UTCの数値（例: 05:00）ではない。
result: pass

### 3. ゲスト予約完了画面のJST時刻表示（BUG-03）
expected: ゲスト予約完了後の/guest/booking/successページで、予約日時がJSTで表示される。
result: pass

### 4. ゲストキャンセル画面のJST時刻表示（BUG-03）
expected: /guest/cancel/[token]ページで、キャンセル対象の予約日時がJSTで表示される。
result: pass

### 5. 管理者予約一覧のJST時刻表示（BUG-03）
expected: /admin/bookingsページの予約一覧で、全ての予約日時がJSTで表示される。
result: pass

### 6. 会員招待時のウェルカムメール送信（BUG-04）
expected: 管理画面から新しい会員を招待すると、招待された会員のメールボックスにウェルカムメールが届く。メールにはパスワード設定リンク（1時間有効）が含まれている。
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
