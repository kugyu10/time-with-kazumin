---
phase: 06-automation-tasks
plan: 02
subsystem: automation
tags: [edge-functions, supabase, resend, react-email, admin-ui, task-logs]

# Dependency graph
requires:
  - phase: 06-automation-tasks
    plan: 01
    provides: task_execution_logsテーブル、メールフラグ、React Emailテンプレート
  - phase: 05-admin-features
    provides: 管理画面共通レイアウト、DataTableコンポーネント
provides:
  - monthly-point-grant Edge Function（月次ポイント付与自動化）
  - check-reminder-emails Edge Function（24時間前リマインダー自動化）
  - check-thank-you-emails Edge Function（セッション終了後サンキューメール自動化）
  - タスク実行履歴管理画面（/admin/tasks）
affects: [phase-06完了, 自動化タスク本番稼働準備]

# Tech tracking
tech-stack:
  added: [Deno Edge Functions, Resend API直接呼び出し, HTML email templates]
  patterns: [Edge Function認証パターン, メール送信リトライパターン, ウィンドウ計算パターン, 冪等性チェックパターン]

key-files:
  created:
    - supabase/functions/monthly-point-grant/index.ts
    - supabase/functions/check-reminder-emails/index.ts
    - supabase/functions/check-thank-you-emails/index.ts
    - src/app/admin/tasks/page.tsx
    - src/app/admin/tasks/tasks-client.tsx
    - src/app/admin/tasks/columns.tsx
    - src/lib/actions/admin/tasks.ts
  modified:
    - src/components/admin/sidebar.tsx
    - tsconfig.json

key-decisions:
  - "Edge FunctionsからResend API直接呼び出し: Next.js経由せずにDeno runtimeから直接fetch"
  - "HTMLテンプレート手動生成: React Email renderはサーバーサイド専用のため、Edge Function内でHTML文字列を直接生成"
  - "ウィンドウ計算パターン: 15分チェック間隔に対して±15分ウィンドウで漏れを防止"
  - "tsconfig.jsonでsupabase/functions除外: Deno runtime用コードをNext.jsビルド対象から除外"

patterns-established:
  - "Edge Function認証パターン: Authorization headerチェック + service_role key使用"
  - "メール送信リトライパターン: 即時リトライ3回、指数バックオフなし"
  - "冪等性チェックパターン: 今月分処理済みかをpoint_transactionsで確認"
  - "タスクログ記録パターン: バッチログ + 個別ログの2段階記録"

requirements-completed: [SYS-01, SYS-05, MEMBER-06]

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 6 Plan 02: Edge Functionsによる自動化タスク実装 Summary

**月次ポイント付与、リマインダーメール、サンキューメールの3つのEdge Function実装完了。タスク実行履歴管理画面で実行状況を確認可能。**

## Performance

- **Duration:** 6分
- **Started:** 2026-02-23T08:50:09Z
- **Completed:** 2026-02-23T08:56:25Z
- **Tasks:** 4
- **Files modified:** 10

## Accomplishments

- **月次ポイント付与Edge Function**: grant_monthly_points RPCを呼び出し、冪等性チェック付き
- **リマインダーメールEdge Function**: 24時間後の予約を抽出し、会員/ゲスト両方にメール送信
- **サンキューメールEdge Function**: 30分前終了セッション対象にサンキューメール送信（send_thank_you_email=true限定）
- **タスク実行履歴管理画面**: task_execution_logsを表示、task_name/statusでフィルタ可能
- **サイドバーに「タスク履歴」リンク追加**: 管理画面から即座にアクセス可能

## Task Commits

Each task was committed atomically:

1. **Task 1: 月次ポイント付与Edge Function作成** - `38b4c82` (feat)
2. **Task 2: リマインダーメールチェックEdge Function作成** - `81bdcd7` (feat)
3. **Task 3: サンキューメールチェックEdge Function作成** - `b835d53` (feat)
4. **Task 4: タスク実行履歴管理画面作成** - `f06232f` (feat)

## Files Created/Modified

### 作成

- `supabase/functions/monthly-point-grant/index.ts` - 月次ポイント付与Edge Function（冪等性チェック、リトライ3回）
- `supabase/functions/check-reminder-emails/index.ts` - リマインダーメールEdge Function（24時間前ウィンドウ）
- `supabase/functions/check-thank-you-emails/index.ts` - サンキューメールEdge Function（30分後ウィンドウ、send_thank_you_emailチェック）
- `src/app/admin/tasks/page.tsx` - タスク実行履歴ページ（Server Component）
- `src/app/admin/tasks/tasks-client.tsx` - タスク実行履歴クライアントコンポーネント（フィルタ機能）
- `src/app/admin/tasks/columns.tsx` - TanStack Tableカラム定義
- `src/lib/actions/admin/tasks.ts` - getTaskLogs Server Action

### 変更

- `src/components/admin/sidebar.tsx` - 「タスク履歴」リンク追加（ListChecksアイコン）
- `tsconfig.json` - supabase/functionsをexcludeに追加（Deno runtime対応）

## Decisions Made

**1. Edge FunctionsからResend API直接呼び出し**
- Next.js経由せずにDeno runtimeからfetchでResend APIを直接呼び出し
- Edge Function内で完結させることでレイテンシを削減

**2. HTMLテンプレート手動生成**
- React Email renderはNext.jsサーバーサイド専用のため、Edge Function内でHTML文字列を直接生成
- BookingReminder/ThankYouEmailのスタイルを踏襲したHTMLテンプレートを実装

**3. ウィンドウ計算パターン**
- 15分チェック間隔に対して±15分ウィンドウで漏れを防止
- リマインダー: 24時間後±15分、サンキュー: 30分前±15分

**4. tsconfig.jsonでsupabase/functions除外**
- Deno runtime用コード（jsr:@supabase/supabase-js@2）をNext.jsビルド対象から除外
- Next.jsとEdge Functionsの明確な分離

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tsconfig.jsonビルドエラー対応**
- **Found during:** Task 4（ビルドチェック時）
- **Issue:** Edge Functions内のDeno runtime用importがNext.jsビルドで型エラー
- **Fix:** tsconfig.jsonのexcludeに"supabase/functions"を追加
- **Files modified:** tsconfig.json
- **Commit:** f06232f（Task 4と同時）

**2. [Rule 1 - Bug] ESLintエラー対応**
- **Found during:** Task 4（ビルドチェック時）
- **Issue:** TaskStatusSchema/TaskNameSchemaが未使用扱い
- **Fix:** zodスキーマを削除し、直接型定義に変更
- **Files modified:** src/lib/actions/admin/tasks.ts
- **Commit:** f06232f（Task 4と同時）

## Issues Encountered

**ローカルEdge Functions未検証**
- `supabase functions serve`でのローカル検証は未実施
- 構文チェックは完了、本番デプロイ時にSupabase CLIでデプロイ・検証が必要

## User Setup Required

本番デプロイ時に以下の手順が必要:

1. **Edge Functionsデプロイ**
   ```bash
   supabase functions deploy monthly-point-grant
   supabase functions deploy check-reminder-emails
   supabase functions deploy check-thank-you-emails
   ```

2. **環境変数設定**（Supabase Dashboard）
   - `RESEND_API_KEY`: Resend API Key
   - `FROM_EMAIL`: 送信元メールアドレス
   - `ADMIN_EMAIL`: 管理者メールアドレス（リマインダー受信用）

3. **pg_cronジョブ有効化**
   - マイグレーションファイル（06-01で作成）内のコメント化されたジョブをuncomment
   - Edge Function URLをSupabase Vaultに設定
   - 再度マイグレーション実行

4. **動作確認**
   - pg_cronジョブが正常に実行されることを確認
   - /admin/tasks でタスク実行履歴を確認

## Next Phase Readiness

- Phase 6完了 → 全フェーズ完了
- 自動化タスク本番稼働準備完了
- 管理画面で実行状況モニタリング可能

---
*Phase: 06-automation-tasks*
*Completed: 2026-02-23*

## Self-Check: PASSED

### ファイル存在確認
✅ FOUND: supabase/functions/monthly-point-grant/index.ts
✅ FOUND: supabase/functions/check-reminder-emails/index.ts
✅ FOUND: supabase/functions/check-thank-you-emails/index.ts
✅ FOUND: src/app/admin/tasks/page.tsx
✅ FOUND: src/app/admin/tasks/tasks-client.tsx
✅ FOUND: src/app/admin/tasks/columns.tsx
✅ FOUND: src/lib/actions/admin/tasks.ts

### コミット存在確認
✅ FOUND: 38b4c82 (Task 1: 月次ポイント付与Edge Function)
✅ FOUND: 81bdcd7 (Task 2: リマインダーメールチェックEdge Function)
✅ FOUND: b835d53 (Task 3: サンキューメールチェックEdge Function)
✅ FOUND: f06232f (Task 4: タスク実行履歴管理画面)
