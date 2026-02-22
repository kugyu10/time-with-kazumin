---
status: complete
phase: 03-guest-booking-experience
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-02-22T10:30:00Z
updated: 2026-02-22T11:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 空きスロット閲覧
expected: /guest/booking で日付選択し、空きスロット一覧が表示される
result: pass

### 2. ゲスト予約作成
expected: スロット選択後、名前とメールアドレスを入力して予約を送信すると、予約完了ページにリダイレクトされる
result: pass
note: テーブル名 menus → meeting_menus のバグ修正を含む

### 3. 予約完了ページ表示
expected: 予約完了ページで予約詳細（日時、ゲスト名）が表示される
result: pass

### 4. Googleカレンダー追加ボタン
expected: 予約完了ページの「Googleカレンダーに追加」ボタンをクリックすると、Google Calendarの新規イベント作成画面が開く
result: pass

### 5. キャンセルリンク
expected: 予約完了ページにキャンセルリンクが表示され、クリックするとキャンセル確認ページに遷移する
result: pass
note: Next.jsキャッシュクリアが必要だった

### 6. 予約キャンセル
expected: キャンセル確認ページで「キャンセルする」ボタンをクリックすると、予約がキャンセルされ完了メッセージが表示される
result: pass
note: destructiveバリアントのスタイル修正を含む

### 7. レート制限
expected: 同じIPから短時間に複数回予約を試みると、429エラー（レート制限）が返される
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

## Bugs Fixed During UAT

1. **テーブル名の不一致** - `menus` → `meeting_menus` に修正
   - src/app/(public)/guest/booking/success/page.tsx
   - src/app/(public)/guest/cancel/[token]/page.tsx

2. **destructiveボタンのスタイル** - CSS変数未定義のため直接スタイル適用
   - src/components/guest/CancelConfirmDialog.tsx
