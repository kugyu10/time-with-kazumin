---
status: resolved
trigger: "キャンセル時のadminメール送信でTypeError発生"
created: 2026-03-05T10:00:00+09:00
updated: 2026-03-05T10:35:00+09:00
resolved: 2026-03-05T10:35:00+09:00
---

## Current Focus

hypothesis: React 19.2.3と@react-email/render 2.0.4の互換性問題（GitHub Issue #2521）
test: 修正後に本番環境でキャンセル処理を実行
expecting: TypeErrorが解消され、メール送信が成功する
next_action: ユーザーによる本番環境での動作確認待ち

## Symptoms

expected: キャンセル時にadminへのキャンセル通知メールが正常に送信される
actual: メール送信が失敗し、TypeErrorが発生
errors: |
  [Email] Cancellation admin email failed: TypeError: b is not a function
  at J (.next/server/chunks/7978.js:5:14157)
  at async W.create (.next/server/chunks/7978.js:5:23923)
reproduction: /admin/bookingsでキャンセル処理を実行
started: 本番環境で発生

## Eliminated

- hypothesis: email.tsのコードにバグがある
  evidence: コードは正しく、ReactコンポーネントをResendのreactプロパティに渡している
  timestamp: 2026-03-05T10:05:00+09:00

- hypothesis: BookingCancellation.tsxのテンプレートに問題がある
  evidence: テンプレートはBookingConfirmation.tsxと同様の構造で、問題なし
  timestamp: 2026-03-05T10:08:00+09:00

## Evidence

- timestamp: 2026-03-05T10:10:00+09:00
  checked: パッケージバージョン
  found: |
    - react: 19.2.3
    - @react-email/components: 1.0.8
    - @react-email/render: 2.0.4
    - resend: 6.9.2
  implication: React 19.2.x と @react-email/render の互換性問題の可能性

- timestamp: 2026-03-05T10:12:00+09:00
  checked: GitHub Issue #2521 (resend/react-email)
  found: |
    - React 19.2.0以降でWritableStream関連のTypeErrorが発生
    - @react-email/render の内部処理でエラー
    - 確認済みバグとしてラベル付け
  implication: 既知の問題。Resendのreactプロパティを使用せず、手動でrenderしてhtmlプロパティを使用することで回避可能

- timestamp: 2026-03-05T10:20:00+09:00
  checked: 修正後のビルド・テスト
  found: |
    - TypeScriptコンパイル: 成功
    - 既存テスト（email.test.ts）: 5件全てパス
    - npm run build: 成功
    - lint: エラーなし
  implication: 修正がコードベースに問題を起こしていない

## Resolution

root_cause: |
  React 19.2.3と@react-email/render 2.0.4の互換性問題。
  Resendの`react`プロパティを使用すると、内部で@react-email/renderが呼ばれ、
  WritableStream関連のTypeErrorが発生する。
  GitHub Issue: https://github.com/resend/react-email/issues/2521

fix: |
  @react-email/renderを直接importし、手動でReactコンポーネントをHTML文字列に変換。
  Resendには`react`プロパティではなく`html`プロパティでHTML文字列を渡す。

  変更内容:
  1. `@react-email/render`を直接依存関係としてインストール
  2. email.tsで`render`関数をインポート
  3. sendBookingConfirmationEmail: reactプロパティ→htmlプロパティに変更
  4. sendBookingCancellationEmail: reactプロパティ→htmlプロパティに変更

verification: |
  - TypeScriptコンパイル: PASS
  - 既存テスト: 5/5 PASS
  - ビルド: PASS
  - lint: PASS
  - 本番環境での動作確認: PASS (ユーザー確認済み)

files_changed:
  - src/lib/integrations/email.ts
  - package.json (dependency added)
  - package-lock.json
