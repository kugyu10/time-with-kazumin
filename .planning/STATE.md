# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** 気軽にかずみんに会いに行ける予約体験 — 堅苦しいビジネスミーティングの予約ではなく、「かずみん、時間空いてる?」と友だちに声をかける感覚でセッションを予約できること。
**Current focus:** Phase 6 - Automation Tasks

## Current Position

Milestone: v1.0 MVP COMPLETE
Status: Ready for next milestone
Last activity: 2026-03-02 - Completed quick task 2: カジュアル30分セッション→発光ポジティブちょい浴び30分 文言変更

Progress: [██████████] 100% (v1.0 shipped)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: ~7 min
- Total execution time: ~115 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2/2 | ~30min | ~15min |
| Phase 2 | 3/3 | ~20min | ~7min |
| Phase 3 | 2/2 | ~10min | ~5min |
| Phase 4 | 3/3 | ~22min | ~7min |
| Phase 5 | 3/3 | ~22min | ~7min |
| Phase 6 | 2/2 | ~11min | ~5.5min |

**Recent Trend:**
- Last 5 plans: 05-01 ✓, 05-02 ✓, 05-03 ✓, 06-01 ✓, 06-02 ✓
- Trend: Excellent velocity (~5-7min/plan)

*Updated after each plan completion*
| Phase 06 P02 | 6min | 4 tasks | 10 files |

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

### Phase 2 Implementation Summary

**認証基盤 (02-01):**
- Supabaseクライアント3パターン: client.ts, server.ts, middleware.ts
- Google OAuth + メール/パスワード認証
- 招待制チェック（profilesテーブル存在確認）
- ミドルウェアによる保護ページガード

**予約作成 (02-02):**
- Sagaオーケストレーター（8ステップ、補償トランザクション付き）
- 冪等性キー管理（idempotency_keysテーブル）
- モック外部API（Zoom, Google Calendar, Email）
- 予約フローUI（メニュー選択→スロット選択→確認→完了）
- ポイント残高表示（ヘッダー+ダッシュボード）

**予約一覧・キャンセル (02-03):**
- 「今後」「過去」タブ切り替え
- 予約詳細ページ（キャンセルボタン付き）
- キャンセル時のポイント返還（refund_points RPC）

### Phase 3 Implementation Summary

**ゲスト予約基盤 (03-01):**
- service_roleクライアント（RLSバイパス、遅延初期化）
- LRUキャッシュベースのレート制限（IP+email複合キー）
- ゲスト入力バリデーション（validator使用）
- GET /api/public/slots: 空きスロット取得API
- POST /api/guest/bookings: ゲスト予約作成API
- ゲスト予約フローUI（SlotPicker再利用）

**キャンセルとカレンダー追加 (03-02):**
- JWTキャンセルトークン（jose、HS256、7日有効期限）
- Googleカレンダー追加URL生成
- DELETE /api/guest/cancel/[token]: キャンセルAPI
- 予約完了ページ（詳細、カレンダー追加、キャンセルリンク）
- キャンセルページ（トークン検証、状態別表示、確認ダイアログ）

### Phase 4 Implementation Summary (Complete)

**Google Calendar OAuth統合 (04-01):**
- oauth_tokensテーブル（pgcrypto pgp_sym_encrypt暗号化）
- Google OAuth 2.0認証フロー（access_type: offline, prompt: consent）
- 'tokens'イベントでリフレッシュトークン自動更新
- FreeBusy APIでbusy時間取得
- 15分TTLキャッシュでAPI呼び出し削減
- 指数バックオフリトライユーティリティ
- 空きスロットAPIがbusy時間を反映

**Zoom・Calendar・Email統合 (04-02):**
- Zoom Server-to-Server OAuth（アカウントA/B対応）
- meeting_menus.zoom_accountカラムでアカウント切り替え
- Resend + React Email（BookingConfirmationテンプレート）
- Sagaの本実装版拡張（Zoom/Calendar/Email統合）
- キャンセルURL・GoogleカレンダーURL付きメール送信

**キャンセルフロー拡張 (04-03):**
- cancelBookingオーケストレーター本実装化
- Zoom会議削除、Googleカレンダーイベント削除の統合
- BookingCancellation React Emailテンプレート
- 会員・ゲスト両対応キャンセルフロー
- 外部API失敗時の非ブロッキング処理

### Pending Todos

None yet.

### Blockers/Concerns

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | ログインしている人がadminなら、ヘッダーに管理画面へリンクを表示 | 2026-03-01 | 6637760 | [1-admin](./quick/1-admin/) |
| 2 | カジュアル30分セッション→発光ポジティブちょい浴び30分 文言変更 | 2026-03-02 | 90483db | - |

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

### Phase 5 Implementation Summary (Complete)

**管理画面基盤・メニュー・プランCRUD (05-01):**
- 管理画面共通レイアウト（認証・認可チェック付き）
- Admin Sidebarナビゲーション
- TanStack Table統合DataTableコンポーネント
- メニュー（meeting_menus）CRUD Server Actions
- プラン（plans）CRUD Server Actions
- shadcn/ui管理画面用コンポーネント群

**営業時間設定、会員管理、ポイント調整 (05-02):**
- 営業時間設定UI（週間スケジュール）
- 会員一覧・検索・編集機能
- ポイント手動調整機能（manual_adjust_points RPC）

**管理者予約管理機能 (05-03):**
- 予約一覧・フィルタ機能（会員/ゲスト両方表示）
- ステータス変更（楽観的更新、useOptimistic）
- 管理者キャンセル機能（cancelBookingオーケストレーター再利用）
- isAdminフラグで権限チェックバイパス

### Phase 6 Implementation Summary (Complete)

**自動化タスクDB基盤 (06-01):**
- task_execution_logsテーブル（タスク実行履歴記録）
- bookingsにreminder_sent_at/thank_you_sent_atフラグ（重複送信防止）
- meeting_menusにsend_thank_you_emailフラグ（メニューごとサンキューメールON/OFF）
- React Emailテンプレート（BookingReminder, ThankYouEmail）
- pg_cron拡張とジョブ定義（コメント化）
- メニュー管理UIでサンキューメール設定可能

**Edge Functions自動化タスク実装 (06-02):**
- monthly-point-grant Edge Function（月次ポイント付与、冪等性チェック付き）
- check-reminder-emails Edge Function（24時間前リマインダー自動送信）
- check-thank-you-emails Edge Function（セッション終了後サンキューメール自動送信）
- タスク実行履歴管理画面（/admin/tasks、フィルタ機能付き）
- Resend API直接呼び出し（Deno runtime対応）

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 06-02-PLAN.md (Edge Functions自動化タスク実装)
Resume file: None
