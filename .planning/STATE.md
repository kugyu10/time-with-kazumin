---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: 安定化
status: planning
stopped_at: Completed 09-playwright-foundation-01-PLAN.md
last_updated: "2026-03-15T11:35:59.883Z"
last_activity: 2026-03-15 — Roadmap created for v1.2
progress:
  total_phases: 11
  completed_phases: 8
  total_plans: 20
  completed_plans: 19
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** 気軽にかずみんに会いに行ける予約体験 — 堅苦しいビジネスミーティングの予約ではなく、「かずみん、時間空いてる?」と友だちに声をかける感覚でセッションを予約できること。
**Current focus:** v1.2 安定化 — バグ修正とE2Eテスト導入

## Current Position

Milestone: v1.2 安定化
Phase: Phase 8（バグ修正）— Not started
Status: Roadmap defined, ready for planning
Last activity: 2026-03-15 — Roadmap created for v1.2

Progress: [          ] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (v1.0〜v1.1)
- Average duration: ~7 min
- Total execution time: ~117 min

**By Phase (historical):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2/2 | ~30min | ~15min |
| Phase 2 | 3/3 | ~20min | ~7min |
| Phase 3 | 2/2 | ~10min | ~5min |
| Phase 4 | 3/3 | ~22min | ~7min |
| Phase 5 | 3/3 | ~22min | ~7min |
| Phase 6 | 2/2 | ~11min | ~5.5min |
| Phase 7 | 1/1 | ~2min | ~2min |

**v1.2 Phases (not started):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 8 | 0/2 | - | - |
| Phase 9 | 0/2 | - | - |
| Phase 10 | 0/2 | - | - |
| Phase 11 | 0/1 | - | - |

*Updated after each plan completion*
| Phase 08-bug-fixes P01 | 3 | 3 tasks | 3 files |
| Phase 08-bug-fixes P02 | 40 | 4 tasks | 9 files |
| Phase 09-playwright-foundation P01 | 4 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Supabase選択: PostgreSQLトランザクション整合性でポイント管理を担保、Auth+Edge Functions統合
- ポイント残高をmember_plansに直接保持: 残高取得を1クエリで完結(KISS原則)
- Next.js 15.3.3を使用: Next.js 16のTurbopackは日本語パス名でバグ発生
- 招待制チェック: profilesテーブル存在確認で未招待ユーザーをブロック
- 遅延初期化パターン: Supabaseクライアントをビルド時エラー回避のため関数呼び出し時に初期化
- LRUキャッシュでレート制限: IP単独5回/h、IP+email複合3回/hの制限
- jose for JWT: ESM-native、Edge-compatible、7日間のキャンセルトークン有効期限
- pgp_sym_encrypt for OAuth tokens: PostgreSQLネイティブ暗号化でAES-256相当
- Zoom Server-to-Server OAuth: アプリレベル認証でユーザー認証不要
- Resendメール送信: 非クリティカル扱い（失敗しても予約成功）
- 外部API非ブロッキング: Zoom/Calendar削除失敗してもキャンセル成功
- オーケストレーター共通化: 会員/ゲスト両方がcancelBooking()を使用
- CVE-2025-29927対策: Layout内で認証・認可を再チェック
- Defense-in-Depth: 各Server Action内でrequireAdmin()呼び出し
- anyキャストでSupabase型推論問題を回避（既存パターン踏襲）
- pg_cronジョブ定義をコメント化: 本番デプロイ時にVaultシークレット設定後にuncomment
- メール送信フラグをTIMESTAMPTZで管理: 重複防止＋送信履歴追跡を同時に実現
- send_thank_you_emailをmeeting_menusに配置: メニューごとにサンキューメール送信をON/OFF可能
- [Phase 06]: Edge FunctionsからResend API直接呼び出し: Next.js経由せずDeno runtimeから直接fetch
- [Phase 06]: HTMLテンプレート手動生成: React Email renderはサーバーサイド専用のためEdge Function内でHTML文字列を直接生成
- [Phase 07]: 祝日パターンは day_of_week=0 の1行で管理（曜日無視）
- [Phase 08-bug-fixes]: Zoom削除のaccountTypeはmeeting_menus.zoom_accountから取得（DBクエリ失敗時はデフォルト'A'）
- [Phase 08-bug-fixes]: BUG-05はコードロジック正常のため診断ログ強化のみ実施（OAuth設定・GOOGLE_CALENDAR_ID確認用）
- [Phase 08-bug-fixes]: sendWelcomeEmailは非ブロッキング: 失敗しても会員作成は成功扱い（Resendメール送信ポリシーを踏襲）
- [Phase 08-bug-fixes]: date-fnsのformat()はtimeZone非対応のため日時フォーマットでは使用禁止（YAGNI: date-fns-tz追加せず）
- [Phase 08-bug-fixes]: 全日時表示でtimeZone: 'Asia/Tokyo'を必須指定（Vercel環境はUTCで動作するため）
- [Phase 09-playwright-foundation]: global-setup.ts/global-teardown.ts スタブ作成: npx playwright test --list が通るようにするためのRule 3自動修正（09-02で実装）
- [Phase 09-playwright-foundation]: .env.test.example を .gitignore の !除外対象に追加: .env.* パターンとの衝突を解消

### v1.2 E2E Decisions (pre-decided from research)

- Playwright 1.58.2採用: Next.js公式推奨、CI並列実行無料、storageState認証再利用対応
- Google OAuth E2E自動化は対象外: Bot検出・ToS違反リスク。メール/パスワード認証でカバー
- `workers: 1`でシリアル実行: Supabase dev環境の接続数制限による並列テスト干渉を防止
- Vercel preview対象: develop環境のデプロイ保護設定を確認・無効化が必要（Phase 9実装前）
- 外部API（Zoom/Calendar/Resend）は `page.route()` でモック化: クォータ消費と外部依存を回避
- patrickedqvist/wait-for-vercel-preview@v1.3.3: CI統合でVercel Preview URL自動取得

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 9実装前: Vercel dashboardでdevelopブランチのDeployment Protection設定を確認する必要がある
- Phase 9実装前: `/login` ページにメール/パスワードフォームが存在するか確認が必要（storageState取得戦略に影響）
- Phase 9実装前: Supabase `app_metadata` への `role: 'admin'` 付与手順を確定する必要がある

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | ログインしている人がadminなら、ヘッダーに管理画面へリンクを表示 | 2026-03-01 | 6637760 | [1-admin](./quick/1-admin/) |
| 2 | カジュアル30分セッション→発光ポジティブちょい浴び30分 文言変更 | 2026-03-02 | 90483db | - |
| 3 | メールを有効化（FROM_EMAILをカスタムドメインに変更） | 2026-03-04 | 35b792d | [3-enable-email](./quick/3-enable-email/) |

**Phase 1 Critical Risks: RESOLVED**
- ポイント二重消費リスク: SELECT FOR UPDATE NOWAITをconsume_points()に実装
- 二重予約リスク: EXCLUDE制約 + btree_gistで時間範囲重複を自動防止
- RLSパフォーマンス: JWT claimをSELECTでラップしてキャッシュ化

**Phase 2 Critical Risks: RESOLVED**
- Sagaパターン: 8ステップの補償トランザクション実装
- 冪等性: idempotency_keysテーブルで二重予約防止

**Phase 3 Critical Risks: RESOLVED**
- ゲストレート制限: LRUキャッシュ+IP+email複合キーで悪意あるアクセス防止
- キャンセルセキュリティ: JWTキャンセルトークン（署名検証、7日有効期限）

**Phase 4 Critical Risks: RESOLVED**
- OAuth期限切れ: 'tokens'イベントでリフレッシュ自動更新実装済み
- Google Calendar Rate Limit: 指数バックオフで対応済み（04-01）
- 外部API削除失敗: 非ブロッキング処理でキャンセル成功を保証（04-03）

## Session Continuity

Last session: 2026-03-15T11:35:59.880Z
Stopped at: Completed 09-playwright-foundation-01-PLAN.md
Resume file: None
Next step: `/gsd:plan-phase 8`
