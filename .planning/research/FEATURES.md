# E2Eテストシナリオ調査: 予約システム

**ドメイン:** コーチングセッション予約管理システム (Next.js + Supabase)
**調査日:** 2026-03-15
**マイルストーン:** v1.2 安定化 — Playwright E2Eテスト導入
**信頼度:** HIGH (Playwright公式ドキュメント + Supabase実証パターン)

---

## テーブルステークス（必須テストシナリオ）

「これが壊れたらサービスが使えない」クリティカルパスのテスト。E2Eテストとして必ず実装すべき。

### 1. ゲスト予約フロー（最優先）

| シナリオ | なぜ必須か | 複雑度 | 備考 |
|---------|-----------|--------|------|
| トップページ → 日付選択 → スロット一覧表示 | エントリーポイント。ここが壊れると全ゲストが詰まる | LOW | `/booking/new`ルート |
| スロット選択 → 名前/メール入力 → 予約確定 | ゲスト予約の唯一のハッピーパス。壊れると売上0 | MEDIUM | Zoom生成・メール送信が発火するポイント |
| 予約完了画面にZoom URLが表示される | #1バグ関連。Zoomリンクがないとセッション不可 | MEDIUM | v1.2の修正対象 |
| キャンセルリンク → 予約キャンセル確認 → 完了 | ゲスト自身がキャンセルできることの保証 | MEDIUM | トークン認証のキャンセルフロー |
| 時刻が日本時間(JST)で表示される | #2バグ関連。UTC表示はユーザー混乱の原因 | LOW | `/booking/[id]`ページ |

### 2. 会員認証フロー

| シナリオ | なぜ必須か | 複雑度 | 備考 |
|---------|-----------|--------|------|
| メール/パスワードでログイン → ダッシュボードへリダイレクト | メール認証は代替OAuthに依存しないテスト可能なフロー | LOW | Supabase email auth |
| 未認証で `/dashboard` にアクセス → ログインページにリダイレクト | ルート保護が機能していることの確認 | LOW | `middleware.ts`のテスト |
| ログアウト → セッションクリア確認 | 認証状態のライフサイクル | LOW | |

### 3. 会員予約フロー

| シナリオ | なぜ必須か | 複雑度 | 備考 |
|---------|-----------|--------|------|
| ログイン → メニュー選択 → 日付選択 → ポイント確認 → 予約確定 | 会員のメインユースケース。ポイント消費が正常動作するか | HIGH | Sagaパターンの多段フロー |
| 予約後にポイント残高が減少する | ポイント制の根幹機能。壊れたら信頼性が崩壊 | MEDIUM | 予約前後のポイント数を比較 |
| 予約一覧に新しい予約が表示される | 予約履歴の可視性 | LOW | `/bookings`ページ |
| 予約キャンセル → ポイントが返還される | ポイント返還のトランザクション整合性 | HIGH | キャンセル前後のポイント数を比較 |

### 4. 管理者フロー（コア操作）

| シナリオ | なぜ必須か | 複雑度 | 備考 |
|---------|-----------|--------|------|
| 管理者ログイン → `/admin`にアクセス可能 | 管理者専用ルートの保護確認 | LOW | Role-based access |
| 予約一覧が表示される | 管理者の最基本操作 | LOW | `/admin/bookings` |
| 会員一覧が表示される | 会員管理の基盤 | LOW | `/admin/members` |

---

## 差別化テスト（nice-to-have）

「あると品質が上がる」が、なくても最低限は動くシナリオ。

### 外部サービス統合テスト（モック前提）

| シナリオ | 価値 | 複雑度 | 実装方針 |
|---------|------|--------|---------|
| 予約確定時にZoom API呼び出しが発火する | #1バグの予防。APIが呼ばれたことを検証 | HIGH | `page.route()` でモック、リクエストをキャプチャ |
| キャンセル時にZoom削除APIが呼ばれる | #1バグの直接的テスト。修正確認に有効 | HIGH | 同上 |
| 予約確定時にGoogle Calendar APIが呼ばれる | #4バグの予防テスト | HIGH | `page.route()` でモック |
| 予約確定時にResend APIが呼ばれる | メール送信の発火確認 | MEDIUM | `page.route()` でモック |
| 招待メール送信APIが呼ばれる | #3バグの直接的テスト | MEDIUM | リクエストボディの検証込み |

### エラー・エッジケーステスト

| シナリオ | 価値 | 複雑度 | 備考 |
|---------|------|--------|------|
| ポイント残高不足での予約試行 → エラー表示 | ガード条件の検証 | MEDIUM | UI上でエラーメッセージ確認 |
| 満枠スロットへの予約試行 → 拒否 | ダブルブッキング防止 | MEDIUM | |
| メールアドレス不正入力 → バリデーションエラー | フォームバリデーション | LOW | |
| 存在しない予約IDへのアクセス → 404 | エラーハンドリング | LOW | |

### 管理者高度操作

| シナリオ | 価値 | 複雑度 | 備考 |
|---------|------|--------|------|
| 管理者が会員を招待 → 招待メールAPIが呼ばれる | #3バグの直接的テスト | HIGH | `/admin/members`の招待フロー |
| 管理者がポイントを手動付与 → 残高が増える | ポイント管理の保証 | MEDIUM | |
| 管理者が予約をキャンセル → 予約ステータス変更 | 管理者権限の確認 | MEDIUM | |
| 営業時間設定の変更 → スロット一覧に反映される | #4バグ関連。カレンダーブロックの整合性 | HIGH | 設定変更後にスロット再取得 |

---

## アンチフィーチャー（E2Eでテストすべきでないこと）

| 対象 | なぜテストしない | 代わりに |
|------|---------------|---------|
| Google OAuth UIフロー | ToS違反リスク。CAPTCHA・2FAで必ずフレーキーになる。Playwrightは外部ドメインのUI自動操作を推奨しない | Supabase REST APIでemail/password認証し、セッションをstorageStateで再利用 |
| 実際のZoom API呼び出し | クォータ消費・テスト用会議の増殖・API可用性に依存 | `page.route('/api/admin/zoom/*', handler)` でモック |
| 実際のGoogle Calendar API呼び出し | 外部サービス可用性依存・テストデータ汚染 | `page.route()` でモック。APIが呼ばれたことだけ検証 |
| 実際のResend APIでメール送信 | 送信クォータ消費（月3,000通）・`delivered@resend.dev` は実際のユーザーに届かない | `page.route('/api/bookings/*', handler)` でモック |
| Supabase Edge Functions（pg_cron）の直接テスト | E2Eの範囲外。単体テスト/インテグレーションテストで対応 | 月次ポイント付与等はVitest単体テスト |
| 全管理者CRUDの網羅 | ROI低下。UIが複雑でメンテコストが高い | 管理者フローはスモークテスト程度にとどめ、ロジックはVitest |
| 全バリデーションパターン網羅 | E2Eコストが高すぎる | Vitest + React Testing Library で十分 |

---

## 認証戦略: Google OAuth問題の解決

### 問題の核心

Google OAuth を Playwright で直接テストすることは：
- Google ToS 違反のリスクがある（自動ログインの禁止）
- CAPTCHA・不審なログイン検知で必ずフレーキーになる
- CI/CD環境では機能しない（新しいIPからのログインはブロックされる）

### 推奨アプローチ: Supabase REST API 認証

**信頼度: HIGH** (mokkapps.de実証 + Supabase公式パターン)

```
1. playwright/setup/auth.setup.ts でSupabase REST APIを直接叩く
   POST {SUPABASE_URL}/auth/v1/token?grant_type=password
   → アクセストークンとリフレッシュトークンを取得

2. セッションをplaywright/.auth/member.json に保存
   (sb-{PROJECT_ID}-auth-token をlocalStorageキーとして保存)

3. テストの beforeEach で context.addInitScript() を使って
   localStorageにセッションを注入する

4. .gitignore に playwright/.auth/ を追加
```

**Google OAuthユーザーのテスト方法:**

- テスト専用の Supabase email/password アカウントを用意
- そのアカウントに管理者と同等のロールを付与
- 本番のGoogle OAuthフローは「ログインボタンがある」「Googleリダイレクトが発火する」レベルでの存在確認のみ（実際の認証フローはテストしない）

### ロールごとのセッション管理

```
playwright/.auth/
  member.json    → 一般会員セッション
  admin.json     → 管理者セッション
  guest.json     → 未認証（不要 = 空のstorageState）
```

---

## 外部サービスのモック戦略

### Playwright `page.route()` によるAPIインターセプト

**信頼度: HIGH** (Playwright公式ドキュメント)

テスト対象はアプリケーションの動作であり、外部サービスの動作ではない。Next.js Route Handlers(`/api/*`)への呼び出しは実際に実行し、そのRoute HandlerからZoom/Google Calendar/Resendへの外部HTTP呼び出しをモックする。

**戦略の選択肢:**

| 戦略 | 概要 | 用途 |
|------|------|------|
| **フロントエンドモック** | `page.route('/api/admin/zoom/*')` でブラウザからのAPIコールをインターセプト | 外部APIの影響を完全に遮断したいテスト |
| **MSW (Mock Service Worker)** | Service WorkerレベルでAPIをモック。テストコードと実コードの境界が明確 | より本格的な統合テスト環境 |
| **環境変数切り替え** | `TEST_MODE=true` でRoute Handler内部のZoom/Calendar呼び出しをスキップ | シンプルだがコードを汚染する |

**v1.2での推奨: `page.route()` アプローチ**

- 導入コストが最も低い
- Playwrightのみで完結（追加ツール不要）
- Route Handlersのエンドポイントは実際に呼ばれるため、APIのルーティングテストも兼ねる

```typescript
// 例: Zoom API モック
await page.route('**/api/admin/zoom/**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ meetingId: 'mock-123', joinUrl: 'https://zoom.us/j/mock' })
  });
});
```

```typescript
// 例: Zoom削除呼び出しを検証（#1バグテスト）
const zoomDeleteRequests: string[] = [];
await page.route('**/api/admin/zoom/status', async (route) => {
  zoomDeleteRequests.push(route.request().url());
  await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
});
// キャンセル操作後
await expect(zoomDeleteRequests.length).toBeGreaterThan(0);
```

### Resend メールテスト

**信頼度: HIGH** (Resend公式ドキュメント)

- テスト用メールアドレスは `delivered@resend.dev` を使用（Resend公式推奨）
- `page.route()` で `/api/bookings/*` のレスポンスをモックする場合はResendは呼ばれない
- メール送信が呼ばれたことを確認したい場合: リクエストインターセプトでボディを検証

---

## テストシナリオ優先度マトリクス

| シナリオ | ビジネス影響 | 実装コスト | CI重要度 | 優先度 |
|---------|-----------|-----------|---------|-------|
| ゲスト予約ハッピーパス | CRITICAL | LOW | HIGH | **P0** |
| 時刻JST表示確認（#2修正確認） | HIGH | LOW | HIGH | **P0** |
| 会員ログイン → ダッシュボード | CRITICAL | LOW | HIGH | **P0** |
| 未認証リダイレクト確認 | HIGH | LOW | HIGH | **P0** |
| 会員予約ハッピーパス + ポイント消費 | CRITICAL | MEDIUM | HIGH | **P1** |
| 予約キャンセル + ポイント返還 | HIGH | MEDIUM | HIGH | **P1** |
| Zoom削除API呼び出し確認（#1修正確認） | HIGH | HIGH | MEDIUM | **P1** |
| ゲストキャンセルフロー | MEDIUM | MEDIUM | MEDIUM | **P1** |
| 管理者スモークテスト（ログイン・一覧確認） | MEDIUM | LOW | MEDIUM | **P2** |
| 招待メールAPI呼び出し確認（#3修正確認） | MEDIUM | HIGH | MEDIUM | **P2** |
| カレンダーブロック反映確認（#4修正確認） | MEDIUM | HIGH | LOW | **P2** |
| ポイント残高不足エラー | MEDIUM | MEDIUM | LOW | **P2** |
| 管理者ポイント手動付与 | LOW | MEDIUM | LOW | **P3** |
| エラーハンドリング（404など） | LOW | LOW | LOW | **P3** |

**優先度の定義:**
- P0: スモークテスト。壊れていたらリリース不可
- P1: コアフロー。マージ前に必ず通過
- P2: バグ修正確認。今マイルストーンのバグfixを担保
- P3: 将来追加。安定後に拡充

---

## 機能の依存関係（テスト観点）

```
[ゲスト予約テスト]
    ├── requires → [スロット表示テスト] (前提条件)
    ├── verifies → [Zoom生成APIモック] (外部サービス)
    ├── verifies → [メール送信APIモック] (外部サービス)
    └── verifies → [JST時刻表示] (#2バグ)

[会員予約テスト]
    ├── requires → [会員ログインセットアップ] (auth.setup.ts)
    ├── requires → [スロット表示テスト] (前提条件)
    ├── verifies → [ポイント消費トランザクション]
    └── verifies → [Zoom生成APIモック]

[キャンセルテスト]
    ├── requires → [予約作成テスト] (前提条件)
    ├── verifies → [Zoom削除APIモック] (#1バグ)
    ├── verifies → [ポイント返還トランザクション]
    └── verifies → [キャンセルメールAPIモック]

[管理者テスト]
    ├── requires → [管理者ログインセットアップ] (auth.setup.ts)
    └── verifies → [招待メールAPIモック] (#3バグ)
```

---

## 情報源

### Playwright 認証・モック
- [Authentication | Playwright](https://playwright.dev/docs/auth) — storageState, setup project パターン (HIGH confidence)
- [Mock APIs | Playwright](https://playwright.dev/docs/mock) — page.route() によるネットワークモック (HIGH confidence)
- [Login at Supabase via REST API in Playwright E2E Test](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) — Supabase+Playwright実証パターン (HIGH confidence)

### Supabase + Playwright
- [Testing with Next.js 15, Playwright, MSW, and Supabase](https://micheleong.com/blog/testing-with-nextjs-15-and-playwright-msw-and-supabase) — MSWとJWT生成パターン (MEDIUM confidence)
- [Supawright - Playwright test harness for Supabase](https://github.com/isaacharrisholt/supawright) — テストデータクリーンアップ参考 (MEDIUM confidence)

### Next.js テスト
- [Testing: Playwright | Next.js](https://nextjs.org/docs/app/guides/testing/playwright) — App Router対応の公式ガイド (HIGH confidence)

### Resend テスト
- [How to set up E2E testing with Playwright - Resend](https://resend.com/docs/knowledge-base/end-to-end-testing-with-playwright) — `delivered@resend.dev` 推奨 (HIGH confidence)

### Google OAuth テスト
- [End-to-End Testing Auth Flows with Playwright and Next.js](https://testdouble.com/insights/how-to-test-auth-flows-with-playwright-and-next-js) — OAuth代替戦略 (MEDIUM confidence)
- [Auth.js | Testing](https://authjs.dev/guides/testing) — Credentials providerによる代替 (MEDIUM confidence)

---
*v1.2 安定化マイルストーン向けE2Eテストシナリオ調査*
*調査日: 2026-03-15*
