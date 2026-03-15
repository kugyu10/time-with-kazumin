---
phase: 10-test-scenarios
verified: 2026-03-15T14:40:00Z
status: gaps_found
score: 7/9 must-haves verified
gaps:
  - truth: "予約前後のポイント残高の変化が確認できる"
    status: partial
    reason: "member-booking.spec.ts のポイントテストは global-setup で設定した 100 ポイントの「表示確認」のみ。/api/bookings をモックしているためポイント消費が発生せず、予約前後の変化比較テストが存在しない。PLAN・SUMMARY では意図的に省略と明記されているが、ROADMAP Success Criteria 4 は「ポイント残高の変化が確認できる」ことを要求している。"
    artifacts:
      - path: "e2e/specs/member-booking.spec.ts"
        issue: "test('ダッシュボードにポイント残高が表示される') は 100 ポイントの表示確認のみ。予約前後のポイント値比較ロジックが存在しない。"
    missing:
      - "予約前のポイント残高を取得してから予約フローを実行し、予約後に残高が減少していることを確認するテストステップ"
      - "または: /api/bookingsモックで予約後のポイント値変化をシミュレートし、ダッシュボードの表示値が変化することを検証するアプローチ"
  - truth: "会員がメール/パスワードでログインしてダッシュボードにリダイレクトされることをテストで検証できる"
    status: partial
    reason: "auth.setup.ts でメール/パスワードによるログインUIフローを検証しているが、リダイレクト先は /bookings/new であり ROADMAP SC3 の「ダッシュボードにリダイレクト」と実際のアプリ動作が異なる。auth.spec.ts はすべて storageState（既認証）を使用しておりログインUIフローを直接 spec テストとして検証していない。"
    artifacts:
      - path: "e2e/specs/auth.spec.ts"
        issue: "3テストすべてが memberPage フィクスチャ（storageState 経由）を使用。ログインフォームへの入力・送信・リダイレクト確認という E2E ログインフローを spec として持っていない。"
      - path: "e2e/auth.setup.ts"
        issue: "ログインフローを実行しているが リダイレクト先を waitForURL('/bookings/new') で確認しており、ROADMAP SC3 の「ダッシュボードにリダイレクト」と一致しない。ただしこれはアプリの実装仕様（ログイン後は /bookings/new へ遷移）に従ったものである可能性が高く、ROADMAP の記述誤りの可能性がある。"
    missing:
      - "auth.spec.ts に「/login でメール/パスワードを入力してログインボタンをクリックすると認証済み状態になること」を直接検証するテストケース"
      - "または: ROADMAP SC3 の「ダッシュボードにリダイレクト」という記述をアプリの実際の動作（/bookings/new へリダイレクト）に合わせて修正"
human_verification:
  - test: "ログイン後のリダイレクト先確認"
    expected: "ROADMAP SC3 は「ダッシュボードにリダイレクト」と記述しているが、auth.setup.ts は /bookings/new へのリダイレクトを確認している。アプリの実際のログイン後リダイレクト先が /bookings/new か /dashboard か、どちらが正しい仕様かを確認する。"
    why_human: "アプリの意図した仕様（LoginForm の実装動作）と ROADMAP 記述のどちらが正しいかはコードだけでは判断できない。"
---

# Phase 10: テストシナリオ Verification Report

**Phase Goal:** ゲスト予約・会員ログイン・会員予約の3フローについてE2Eテストが全てパスする状態にする
**Verified:** 2026-03-15T14:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths（ROADMAP Success Criteria から導出）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | ゲスト予約フロー（スロット選択→予約完了→キャンセル）のテストがパスする | ✓ VERIFIED | `booking-flow.spec.ts` に3 describe/3 test。スロットモック→フォーム入力→success URL遷移、キャンセルページ→AlertDialog→完了を網羅。 |
| SC2 | 予約完了画面でZoom URLがJSTの時刻とともに表示されていることをテストで検証できる | ✓ VERIFIED | `booking-flow.spec.ts` L104-131。`getByText('https://zoom.us/j/e2e-mock-meeting-12345')` + `dd` の HH:MM-HH:MM 形式 + 日本語日付を検証。 |
| SC3 | 会員がメール/パスワードでログインしてダッシュボードにリダイレクトされることをテストで検証できる | ✗ PARTIAL | `auth.setup.ts` でログインUI操作は存在するが spec テストではなく setup。リダイレクト先は `/bookings/new`（ダッシュボードではない）。`auth.spec.ts` は storageState を使いログインUIを直接テストしていない。 |
| SC4 | 会員予約フロー（メニュー選択→ポイント消費→予約確定）のテストがパスし、ポイント残高の変化が確認できる | ✗ PARTIAL | 会員予約フロー自体は `member-booking.spec.ts` に実装済み（VERIFIED）。ただしポイント残高の「変化」テストは 100 ポイント表示確認のみで前後比較が存在しない。 |
| SC5 | Zoom/Google Calendar/Resend の実API呼び出しは `page.route()` でモック化されており、外部サービスに依存しない | ✓ VERIFIED | 全 spec で `/api/guest/bookings` POST、`/api/bookings` POST、`/api/guest/cancel/**` DELETE が page.route() でモック化済み。 |

**Score:** 7/9 must-haves verified（SC3・SC4 は PARTIAL で関連 truth の一部が未検証）

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/specs/booking-flow.spec.ts` | ゲスト予約フローE2Eテスト（120行以上） | ✓ VERIFIED | 175行。3 describe / 3 test。存在・実質的・接続済み。 |
| `e2e/global-setup.ts` | member_plans・ゲスト予約レコード挿入（"member_plans" 含む） | ✓ VERIFIED | 169行。member_plans upsert、booking insert/update、SignJWT cancel_token 生成、e2e-tokens.json 書き出しを実装。 |
| `e2e/specs/auth.spec.ts` | 会員ログインフロー E2E テスト（20行以上） | ✓ VERIFIED（存在・実質的） | 30行。3テスト。fixtures から import 済み。ただし truth SC3 の達成が partial。 |
| `e2e/specs/member-booking.spec.ts` | 会員予約フロー E2E テスト（60行以上） | ✓ VERIFIED | 108行。2テスト（予約フロー + ポイント表示）。memberPage フィクスチャ使用。 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/specs/booking-flow.spec.ts` | `/api/guest/bookings` | `page.route()` モック | ✓ WIRED | L62: `page.route('**/api/guest/bookings', ...)` POST のみモック |
| `e2e/specs/booking-flow.spec.ts` | `/guest/booking/success` | `guest_token` で直接アクセス | ✓ WIRED | L111: `e2e-test-guest-token` を使って直接 goto |
| `e2e/specs/booking-flow.spec.ts` | `/guest/cancel/` | `cancel_token` で直接アクセス | ✓ WIRED | L155: `tokens.cancel_token` を使って直接 goto |
| `e2e/specs/booking-flow.spec.ts` | `/api/guest/cancel/` | `page.route()` モック | ✓ WIRED | L142: `page.route('**/api/guest/cancel/**', ...)` DELETE のみモック |
| `e2e/specs/auth.spec.ts` | `e2e/fixtures.ts` | `import { test, expect } from '../fixtures'` | ✓ WIRED | L1: 正しく fixtures から import |
| `e2e/specs/member-booking.spec.ts` | `/api/bookings` | `page.route()` モック | ✓ WIRED | L45: `memberPage.route('**/api/bookings', ...)` POST のみモック |
| `e2e/specs/member-booking.spec.ts` | `e2e/fixtures.ts` | `memberPage` フィクスチャ | ✓ WIRED | L1: fixtures から import、L26 以降で `memberPage` を使用 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| E2E-02 | Plan 01 | ゲスト予約フロー（閲覧→予約→キャンセル）のE2Eテストが通る | ✓ SATISFIED | `booking-flow.spec.ts` にスロット選択・フォーム送信・success URL遷移・キャンセルフロー完全実装。commits: f2a0d13, 954a168。 |
| E2E-03 | Plan 02 | 会員ログインフロー（メール/パスワード）のE2Eテストが通る | ? PARTIAL | `auth.setup.ts` がログインUIフローを実行（メール/パスワード入力→クリック→/bookings/new 遷移確認）。`auth.spec.ts` は storageState 使用で login UI を spec テストとして直接検証していない。commit: 277be26。 |
| E2E-04 | Plan 02 | 会員予約フロー（メニュー選択→ポイント消費→予約）のE2Eテストが通る | ? PARTIAL | 予約フロー自体は完全実装済み（メニュー選択→スロット→確認→予約→ダッシュボード）。しかし「ポイント消費」部分は /api/bookings をモックしているため実際には消費されず、ポイント変化確認は 100 ポイント表示確認のみ。commit: 4dad347。 |

**REQUIREMENTS.md との照合:**
- REQUIREMENTS.md で E2E-02・E2E-03・E2E-04 が `Phase 10 / Complete` と記録済み
- 全 3 件が Phase 10 の PLAN frontmatter に宣言されており孤立要件なし

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| なし | - | - | - | アンチパターン検出なし。TODO/FIXME/placeholder は全ファイルに存在しない。 |

### Human Verification Required

#### 1. ログイン後リダイレクト先の仕様確認

**Test:** アプリで `/login` にアクセスし、有効な会員メール・パスワードでログインする。
**Expected:** ログイン成功後のリダイレクト先がどこか確認する（`/bookings/new` か `/dashboard` か）。
**Why human:** `auth.setup.ts` は `/bookings/new` へのリダイレクトを検証している。ROADMAP SC3 は「ダッシュボードにリダイレクト」と記述。どちらが正しい仕様かはコードだけでは判断できない。もし `/bookings/new` が正しい仕様であれば、ROADMAP SC3 の記述を修正すれば gap は解消される。

#### 2. E2Eテストの実際の Pass 確認

**Test:** `.env.test` に Supabase 認証情報を設定し、`npx playwright test --project=chromium` を実行する。
**Expected:** 全テストがパスすること（auth タイムアウトなし、DB データ存在あり）。
**Why human:** SUMMARY に「ローカル環境で `.env.test` 未設定のため auth.setup.ts がタイムアウト」と記載。自動検証ではテストの実際のパスを確認できない。

### Gaps Summary

2つのギャップが Goal achievement を完全には達成していない:

**Gap 1: ポイント残高変化の未検証（SC4）**
`/api/bookings` POST をモックしているため実際のポイント消費が発生せず、`member-booking.spec.ts` のポイントテストは「100 ポイントが表示されること」の確認に留まる。ROADMAP SC4 が要求する「ポイント残高の変化が確認できる」を満たしていない。PLAN・SUMMARY ではこの制約を明示的に認識・文書化しており意図的な設計判断ではあるが、ROADMAP の契約条件は未達成のまま。

**Gap 2: ログインフローの直接 spec テスト不在（SC3）**
`auth.spec.ts` は storageState（既認証）を使ったテストのみで、ログインフォームへの入力・送信・リダイレクト確認という E2E ログインフローを spec テストとして持っていない。`auth.setup.ts` がログインUI操作を実行しているが、これは setup であり spec テストではない。加えて `auth.setup.ts` のリダイレクト先が `/bookings/new` であり ROADMAP 記述（「ダッシュボードにリダイレクト」）と一致しない。

**両 Gap の共通根本原因:** モック設計とServer Component の制約により E2E テスト範囲を意図的に限定したため、ROADMAP の Success Criteria が完全には実現されていない。

---

_Verified: 2026-03-15T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
