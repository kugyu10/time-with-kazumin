---
status: resolved
trigger: "管理画面のGoogle連携ボタン押下後、400 redirect_uri_mismatch エラーが発生する"
created: 2026-03-19T00:00:00+09:00
updated: 2026-03-19T00:00:00+09:00
---

## Current Focus

hypothesis: コードのグローバル変数キャッシュ問題（修正済み）+ Vercel本番環境変数 or Google Cloud Console設定の不一致（要手動確認）
test: コード修正完了 → Vercel環境変数とGoogle Cloud Console設定の手動確認が必要
expecting: 本番VercelのGOOGLE_REDIRECT_URIと Google Cloud ConsoleのOAuthクライアント承認済みURIが一致していること
next_action: ユーザーにVercel環境変数とGoogle Cloud Console設定を確認してもらう

## Symptoms

expected: Google OAuth認証が正常に完了し、管理画面にリダイレクトされる
actual: Googleの認証画面で400 redirect_uri_mismatchエラーが表示される
errors: redirect_uri_mismatch - アプリから送信されるredirect_uriは `https://time.kazumin0831.com/api/admin/oauth/google/callback` だが、Google Cloud Consoleに登録されたURIと一致しない
reproduction: 管理画面のGoogle連携ボタンを押す
started: 不明（ユーザーから報告）

## Eliminated

- hypothesis: コードがredirect_uriを動的に生成している（request.originなどから構築）
  evidence: `src/lib/integrations/oauth/google.ts`を確認。redirect_uriは`process.env.GOOGLE_REDIRECT_URI`から直接読み込む実装
  timestamp: 2026-03-19T00:00:00+09:00

- hypothesis: コールバックルートのパスが間違っている
  evidence: `src/app/api/admin/oauth/google/callback/route.ts`が存在し、パスは `/api/admin/oauth/google/callback` で正しい
  timestamp: 2026-03-19T00:00:00+09:00

## Evidence

- timestamp: 2026-03-19T00:00:00+09:00
  checked: src/lib/integrations/oauth/google.ts
  found: |
    - `oauth2Client`がモジュールスコープのグローバル変数（let oauth2Client = null）
    - `initOAuth2Client()`は `if (oauth2Client) return oauth2Client` で一度初期化後は再利用
    - redirect_uriは `process.env.GOOGLE_REDIRECT_URI` から読み込む
  implication: 環境変数が変わっても古いクライアントが使われ続けるリスクがある（サーバーレス環境では低リスクだが設計上の懸念）

- timestamp: 2026-03-19T00:00:00+09:00
  checked: .env.prod
  found: |
    - GOOGLE_CLIENT_ID=18527215224-tk2pk9267v7vj94mtvbputdregsf7au2.apps.googleusercontent.com
    - GOOGLE_REDIRECT_URI=https://time.kazumin0831.com/api/admin/oauth/google/callback
  implication: .env.prodの設定は正しい

- timestamp: 2026-03-19T00:00:00+09:00
  checked: .env.local
  found: |
    - GOOGLE_CLIENT_ID=201064566504-j77kamligvg1ju05fhjp0k6tk43sesl0.apps.googleusercontent.com（別のOAuthクライアント）
    - GOOGLE_REDIRECT_URI=https://time-with-kazumin-dev.vercel.app/api/admin/oauth/google/callback
  implication: |
    開発環境と本番環境で別々のGoogle Cloud OAuthクライアントを使用している。
    本番VercelダッシュボードにGOOGLE_REDIRECT_URIが誤った値（dev URL）で設定されている可能性がある。
    または本番のGoogle Cloud ConsoleのOAuthクライアント（CLIENT_ID末尾 ...7au2）に
    `https://time.kazumin0831.com/api/admin/oauth/google/callback` が登録されていない可能性がある。

## Resolution

root_cause: |
  2つの可能性が特定された：

  【可能性A - 最も可能性が高い】
  本番VercelダッシュボードのGOOGLE_REDIRECT_URI環境変数が
  `https://time-with-kazumin-dev.vercel.app/api/admin/oauth/google/callback` などの
  誤った値になっており、Google Cloud Consoleに登録されたURIと一致しない。

  【可能性B】
  本番Google Cloud Console（CLIENT_ID: ...7au2）の
  承認済みリダイレクトURIに
  `https://time.kazumin0831.com/api/admin/oauth/google/callback` が登録されていない。

  コードサイドの問題：
  `oauth2Client`グローバル変数パターンにより、一度初期化されると環境変数が
  変わっても古い設定が使われ続ける。本番サーバーレス環境では低リスクだが、
  設計上の問題として修正すべき。

fix: |
  コードサイド修正（完了）：
  - `oauth2Client`グローバル変数と`isTokenListenerAttached`フラグを削除
  - `initOAuth2Client()`（キャッシュあり）を`createOAuth2Client()`（毎回新規生成）に変更
  - 全呼び出し箇所（getAuthUrl, getTokensFromCode, getOAuthClient）を更新
  - TypeScriptコンパイルエラーなし確認済み

  インフラサイド（要手動確認）：
  1. VercelダッシュボードのGOOGLE_REDIRECT_URI環境変数を確認・修正
  2. Google Cloud Console（CLIENT_ID: 18527215224-...）の承認済みURIに追加確認

verification: TypeScriptコンパイル成功確認済み。実環境での動作確認はユーザー手動確認が必要。
files_changed:
  - src/lib/integrations/oauth/google.ts
