# Codebase Concerns

**Analysis Date:** 2026-02-22

## Architecture & Design Risks

**Complex Transaction Flow (Critical):**
- Issue: 予約作成フロー（`POST /api/bookings`）が8つの連続ステップを持つ。各ステップで外部API（Zoom、Google Calendar、メール）呼び出しがあり、部分的失敗時のロールバック処理が複雑
- Files: `src/app/api/bookings/route.ts`（実装予定）、`lib/zoom.ts`、`lib/google-calendar.ts`、`lib/email.ts`
- Impact:
  - Zoom作成後の Google Calendar 失敗 → Zoom会議が孤立（ユーザーには無効なZoomリンク）
  - ポイント消費後の外部API失敗 → ポイント返還処理が必要だが実装ミス時に二重取得のリスク
  - 予約データベース記録とメール送信の順序が逆になるとDBはあるのにメール未送信
- Fix approach:
  - Supabaseトランザクション（`begin/commit`）で bookingsテーブルへのINSERTとpoint_transactionsを一括処理
  - 外部API各呼び出し前に「補償トランザクション」を定義（Zoom削除、ポイント返還など）
  - try/catch + finally で全失敗ケースをテスト

**Distributed Saga Pattern Missing:**
- Issue: キャンセルフロー（`DELETE /api/bookings/[id]`）も4ステップの外部API呼び出しがある。ここでも各ステップの独立性が低い
- Files: `src/app/api/bookings/[id]/route.ts`（実装予定）
- Impact: キャンセル処理の途中で失敗すると、Zoom会議は削除されたがポイントは返還されていない、など不整合状態が発生
- Fix approach:
  - キャンセルは必ず以下の順序で実行：(1) ポイント返還、(2) Zoom削除、(3) カレンダー削除、(4) ステータス更新
  - 各ステップ前に「前提条件チェック」を入れ、既に成功済みなら重複実行を避ける

---

## External API Integration Risks

**Zoom Account Switching Logic (High):**
- Issue: 2つのZoomアカウント（A: 有料、B: 無料）の管理が `meeting_menus.zoom_account_key` に依存している。アカウント変更時、全メニューの再設定が必要
- Files: `lib/zoom.ts`、`meeting_menus テーブル`、`docs/基本設計書.md` セクション2.2
- Impact:
  - Zoomアカウント認証情報の有効期限切れ時、どちらのアカウントが故障しているか特定が遅延
  - 環境変数 `ZOOM_A_CLIENT_SECRET` の更新をデプロイ時に忘れると、アカウントAのメニューで新規作成が全て失敗
  - メニュー作成時にアカウント選択が必須だが、アカウント実在性チェックがないため不正なキーを指定できる
- Fix approach:
  - `lib/zoom.ts` に `validateZoomAccount(key)` 関数を追加。デプロイ時に両アカウントの有効性チェック
  - 環境変数の存在確認をアプリ起動時に実行（app.ts または next.config.ts の初期化フェーズ）
  - `meeting_menus` CRUDで zoom_account_key の値を enum チェック + 実在性チェック

**Google Calendar Rate Limiting & Sync Strategy (High):**
- Issue: オンデマンド同期戦略（前回から15分以上経過で再取得）は `app_settings.last_calendar_sync` に依存。複数人が同時にスロット取得APIを呼ぶと、競合状態で複数回の Google Calendar API 呼び出しが発生
- Files: `src/app/api/slots/route.ts`（実装予定）、`lib/google-calendar.ts`、`app_settings テーブル`、`docs/基本設計書.md` セクション2.1
- Impact:
  - Google Calendar API の無料枠（10 QPS、1日 1 million requests）に達すると全スロット取得が 403 エラー
  - 同期タイムスタンプをメモリキャッシュ（Vercel Serverless）に置くと、コンテナ再起動時にリセット → 意図しない頻繁な同期
  - ユーザー100人超での運用時に同期が遅延。設計書では「cron バッチに切り替え」と記載されているが未実装
- Fix approach:
  - `app_settings` への更新を DB トランザクション + UNIQUE 制約で保護し、最初の同期しか勝たないように
  - スロット取得APIに「同期予定」というキャッシュキー（Redis or Supabase KV）を導入。同期中なら待機
  - ユーザー20人超のタイミングで事前に cron バッチ実装計画を立てておく

**Resend Email Rate Limiting (Medium):**
- Issue: 月3000通の無料枠制限。定時リマインダー（毎日9:00）+ サンキューメール（毎時0・30分）で複数メール送信が同時実行可能
- Files: `supabase/functions/send-reminder/index.ts`、`supabase/functions/send-thankyou/index.ts`
- Impact:
  - Edge Function が複数メール送信で遅延し、30分タイムアウト制限（Supabase Edge Functions）に引っかかる可能性
  - ユーザー100件の予約が1日に発生した場合、リマインダー100通 + サンキュー100通 = 200通消費（月3000では24〜25日で枠切れ）
- Fix approach:
  - Edge Function内で Resend のバッチ送信（`batch` API）を使用し、1リクエストで複数メール送信
  - バックプレッシャー（失敗時の再試行）を実装。Edge Function の failure log を監視
  - 月次使用量を admin ダッシュボードで可視化

---

## Data Integrity & State Management Risks

**Point Transaction Consistency (Critical):**
- Issue: ポイント消費の PostgreSQL 関数（`consume_points`）では `FOR UPDATE` ロック使用だが、同一ユーザーが同時に複数の予約作成リクエストを送った場合の挙動確認が不足
- Files: `supabase/migrations/010_create_point_functions.sql`（実装予定）、`member_plans テーブル`
- Impact:
  - 100ポイント残高で、同時に2つの「60ポイント」予約を作成 → 両方成功してしまう可能性（デッドロック発生時など）
  - Supabase RLS の `user_id = auth.uid()` ポリシーは有効だが、RLS が Row Lock と競合する可能性
- Fix approach:
  - `consume_points` 関数内で `SELECT ... FOR UPDATE NOWAIT` を使い、タイムアウト時即座にエラー返却
  - 負荷テストで同一ユーザーからの並行リクエスト100個をシミュレート
  - ポイント消費失敗時のリトライロジックを明確に定義（3回リトライ後 400 Bad Request）

**Member Plan State Transitions (High):**
- Issue: 会員プラン（`member_plans`）の切り替え時、旧プランの `ended_at` を埋めて新プランを作成する設計。その間に別の操作（ポイント消費、月次付与）が発生したら？
- Files: `member_plans テーブル`、`supabase/migrations/003_create_member_plans.sql`（実装予定）
- Impact:
  - プラン切り替え中に会員がポイント消費を試みると、どちらのプランから引くか？
  - 月次ポイント付与 Edge Function が複数アクティブプランを見つけた場合、エラーハンドルが曖昧
- Fix approach:
  - プラン切り替えを Supabase 関数化（トランザクション化）
  - クエリで `ended_at IS NULL` を常に条件に含める。NULL以外の複数プラン取得は即座にログエラー
  - admin 画面でプラン状態を可視化。切り替え時に確認フローを必須に

**Booking Status Workflow (High):**
- Issue: booking の `status` が confirmed → completed → (キャンセルで cancelled) という3状態だが、管理者が誤って confirmed → completed → confirmed に戻したら？
- Files: `bookings テーブル`、`src/app/admin/bookings/page.tsx`（実装予定）
- Impact:
  - 既に sends-thankyou メール送信済みなのに状態が戻ると、再度サンキューメール送信の可能性
  - キャンセルメール送信済みの booking が戻ると、キャンセルメール + 予約確認メールの二重送信
- Fix approach:
  - ステータス遷移図を厳密に定義。confirmed → completed → cancelled のみ許可
  - admin 画面の status 更新フォームで「遷移可能な状態」のみドロップダウンに表示
  - ステータス更新時に対応するメール送信済みフラグをチェック

---

## External Service Dependency Risks

**Google Holidays Calendar Assumption (Medium):**
- Issue: 祝日判定が Google 公開祝日カレンダー（`ja.japanese#holiday@group.v.calendar.google.com`）に依存。Google が祝日定義を変更した場合、システムが追従するまでの間に不整合が発生
- Files: `lib/google-calendar.ts`（実装予定）、`docs/基本設計書.md` セクション2.1
- Impact:
  - 2026年の国会決定で新祝日が追加された場合、Google カレンダーが更新されるまで未反映
  - キャッシュ（`app_settings.last_calendar_sync`）があるため更に遅延が大きくなる可能性
- Fix approach:
  - admin 画面に「祝日一覧」表示。Google と不整合な場合は手動上書き可能に
  - 祝日判定結果をロギング。不整合検出時に admin に通知
  - `weekly_schedules` テーブルに holiday の代わりに explicit な祝日日付テーブルを追加検討

**Vercel Serverless 10秒制限（無料）(Medium):**
- Issue: 予約作成フロー（ポイント消費 + Zoom作成 + Google Calendar + Resend）が複数の外部API呼び出しを含むため、応答時間が 10秒に近づく可能性がある。有料プラン（Vercel Pro $20/月）では 60秒に拡張だが、予め対策が必要
- Files: `src/app/api/bookings/route.ts`（実装予定）
- Impact:
  - 外部API のネットワーク遅延により予約作成が timeout
  - ユーザーが再度リクエストを送ると、Zoom 会議が二重作成される可能性
- Fix approach:
  - 予約確認後、メール送信を async キューに落とし、応答時間短縮（SQS 的な仕組み）
  - Supabase Edge Functions で async 処理（Deno のスケジューリング）
  - Vercel Pro への移行を早期に検討（ユーザー 10人以上 or 週 5件以上の予約）

**Supabase 無料枠制限（500MB）(Medium):**
- Issue: 予約・ポイント履歴が蓄積すると、500MB 制限に達する。ユーザー規模によっては半年以内に到達する可能性
- Files: `supabase/migrations/` 全体
- Impact:
  - INSERT が失敗し、予約作成が不可能に
  - Pro プラン移行（$25/月）が必要だが、その時点で既存データはどうするか？
- Fix approach:
  - point_transactions を定期的にアーカイブ（月別に別テーブル or S3）
  - ユーザー50人超のタイミングで Supabase Pro への移行計画を立てておく

---

## Security & Authorization Risks

**RLS Policy Complexity (High):**
- Issue: RLS ポリシーが複数の `EXISTS` サブクエリを使用（admin 判定）している。サブクエリの効率が悪く、大量レコードアクセス時にパフォーマンス低下
- Files: `supabase/migrations/009_create_rls_policies.sql`（実装予定）、各テーブル RLS ポリシー
- Impact:
  - 管理者が 500件の予約一覧を取得する際、RLS で 500回の profiles テーブル EXISTS クエリが実行される可能性
  - クエリ遅延により API timeout
- Fix approach:
  - Supabase `auth.jwt()` の `is_admin` claim を使う（JWT に権限情報を埋め込む）
  - Supabase 関数内で `security_definer` を使い、RLS を bypass できる administrator 関数を作成
  - `CREATE INDEX` で profiles テーブルの role カラムをインデックス化

**Guest Booking Rate Limiting Missing (Medium):**
- Issue: ゲスト予約は認証なしで `/api/bookings` を呼べるため、Rate Limiting がないと DDoS 対象に
- Files: `src/app/api/bookings/route.ts`（実装予定）、`docs/要件定義書.md` セクション5.4
- Impact:
  - 悪意あるユーザーが同じゲストメールで数千件の予約作成
  - Zoom API の rate limit に引っかかり、正当な予約まで作成不可に
- Fix approach:
  - Vercel Edge Middleware または Upstash Rate Limiting を導入
  - IP単位でのレート制限（1IP あたり 1時間で最大 5予約 など）
  - ゲストメール単位でも制限（同一メール 24時間で最大 3予約）

**Supabase Service Role Key Exposure Risk (Medium):**
- Issue: `service_role` キーが環境変数に保存され、Edge Functions や API Routes で使用される。キー漏洩時の影響範囲が大きい（RLS をバイパス）
- Files: `src/lib/supabase/admin.ts`（実装予定）、`.env.local`
- Impact:
  - service_role key が GitHub や Vercel ログに誤出力された場合、全テーブルの書き換え可能
  - Edge Functions のログに出力されると、Supabase ダッシュボードから見えてしまう
- Fix approach:
  - service_role key をプリント・ロギングする実装を禁止（Linter rule 追加）
  - ゲスト予約のような公開API では `anon key` + Server-side validation で実装可能か検証
  - Vercel Secrets の設定確認

---

## Performance & Scaling Risks

**Slot Calculation Algorithm Inefficiency (Medium):**
- Issue: 空きスロット算出（`docs/基本設計書.md` セクション5）が複数のループ + 配列操作を含む。毎回 30分単位でスロット生成して Google Calendar busy と比較
- Files: `src/app/api/slots/route.ts`（実装予定）、`lib/google-calendar.ts`
- Impact:
  - ユーザーが毎回 30分スロット × 営業時間 = 20スロット程度を計算
  - ユーザー 100人が同時にスロット取得 → 秒単位で 2000スロット計算。Google Calendar API も 100回呼び出し
  - フロント側で「スロット再読み込み」ボタンを何度も押すと余計に負荷増加
- Fix approach:
  - スロット計算結果を 15分キャッシュ（Supabase Cache or Redis）
  - 計算ロジックを Client-side か Worker へ移動し、サーバー負荷を分散
  - 実装後、負荷テスト（k6 or Locust）で 100 concurrent users シミュレート

**Cron Edge Function Reliability (High):**
- Issue: Supabase Edge Functions の cron トリガー（月次ポイント付与、リマインダー、サンキューメール）が信頼できるかどうか不明。「毎日9:00 JST」の実装がどの timezone で実行されるか？
- Files: `supabase/functions/monthly-point-grant/index.ts`、`send-reminder/index.ts`、`send-thankyou/index.ts`（実装予定）
- Impact:
  - cron が失敗する、または遅延する → 月次ポイント未付与、リマインダー未送信
  - timezone 設定ミス → 日本時間と UTC のズレで1日遅延
  - Supabase が cron 実行履歴ログを提供していないため、問題検出が困難
- Fix approach:
  - Edge Function 内で「実行時刻」と「処理完了時刻」をログ出力
  - Slack webhook 連携で失敗通知
  - モニタリング（Datadog or New Relic）を導入し、cron 実行失敗を即座に検出

**Weekly Schedules Query Performance (Low):**
- Issue: スロット算出時、`weekly_schedules` を毎回クエリ。テーブル小さいが、RLS ポリシーで全員の読み取りが許可されているため、インデックスなし
- Files: `weekly_schedules テーブル`、`src/app/api/slots/route.ts`（実装予定）
- Impact: 実装後に大きな問題にならない可能性が高いが、将来的にスケジュール拡張（複数コーチ等）がある場合は問題化
- Fix approach:
  - `day_type` カラムに `UNIQUE` 制約と INDEX 作成（既に UNIQUE 制約あり）
  - 変更頻度が低いため、アプリ起動時にメモリにロードする検討

---

## Testing & Verification Gaps

**Transaction Failure Coverage (Critical):**
- Issue: 予約作成・キャンセルの補償トランザクション（ロールバック）が設計には記載されているが、テストケースが定義されていない
- Files: `docs/基本設計書.md` セクション3 の「エラー時のロールバック」
- Impact:
  - 実装時に各失敗ケースを見落とす可能性
  - ステージング環境での手動テストが困難（意図的に外部API失敗を再現しにくい）
- Fix approach:
  - テストケース定義：予約作成の各ステップで意図的に失敗させるシナリオ
  - Mock ライブラリ（`jest.mock`）で Zoom・Google Calendar・Resend をモック
  - テスト: (1) ポイント消費成功 → Zoom失敗 → ポイント返還確認、(2) Zoom成功 → Calendar失敗 → Zoom削除確認、etc.

**Edge Function Error Handling (High):**
- Issue: Deno Edge Functions の例外ハンドリングが TypeScript コードベースに未実装。`monthly-point-grant` が失敗した場合、どうなるか不明
- Files: `supabase/functions/*/index.ts`（実装予定）
- Impact:
  - Edge Function クラッシュ時に silent failure。月次ポイント未付与がユーザーに気付かれない
  - ログが Supabase ダッシュボードにしか出ない。アラート機構がない
- Fix approach:
  - Edge Functions に統一的な try/catch + error logging を実装
  - Sentry or Axiom integration を検討
  - admin ダッシュボードに「Edge Function 実行履歴」表示

**RLS Policy Testing (High):**
- Issue: RLS ポリシーの動作検証がどう行われるか設計書に記載がない
- Files: `supabase/migrations/009_create_rls_policies.sql`（実装予定）
- Impact:
  - 管理者が誤って全テーブルアクセス可能にする RLS を書く可能性
  - 会員が他ユーザーのポイント残高を見えてしまう等のセキュリティインシデント
- Fix approach:
  - Supabase pgTAP test suite を設定。RLS ポリシーのテストケースを定義
  - 各 RLS ポリシーについて「許可すべきアクション」「禁止すべきアクション」をテスト
  - `supabase test` コマンドを CI/CD に組み込み

---

## Missing Feature Awareness

**Notifications & Alerts (Medium):**
- Issue: 管理者が「月次ポイント付与の失敗」「Zoom API limit エラー」などを検知する仕組みがない
- Files: Edge Functions 全体、admin ダッシュボード（実装予定）
- Impact:
  - ユーザーが「ポイント付与されていない」と報告するまで問題が分からない
  - ユーザー体験の低下
- Fix approach:
  - エラー発生時に Slack 通知（または管理者メール）
  - admin ダッシュボードに「最近のエラーログ」表示
  - 後期フェーズで Sentry or Datadog 導入を検討

**Audit Trail Missing (Medium):**
- Issue: admin が何をいつ変更したか（プラン編集、ポイント手動調整、ステータス変更）のログが不十分
- Files: `point_transactions` テーブル（あり）だが、meeting_menus・plans・weekly_schedules の変更履歴なし
- Impact:
  - 管理者が誤ってメニューを削除した場合、復旧が困難
  - 不正操作の追跡が不可能
- Fix approach:
  - created_at / updated_at カラムは全テーブルにあり。これで基本的な change log は可能
  - admin が編集する画面に「更新日時」「更新者」を表示
  - PostgreSQL trigger で自動 audit テーブル作成検討（長期的）

**Backup & Disaster Recovery (Medium):**
- Issue: Supabase がデータバックアップを提供しているが、復旧手順が定義されていない
- Files: docs/ 全体
- Impact:
  - DB 破損時の復旧がアドホック
  - 復旧時間が長く、サービス停止期間が増加
- Fix approach:
  - Supabase automated backup 設定確認
  - 復旧手順を README に記載
  - 定期的なバックアップ復旧テスト（月1回）を計画

---

## Development & Deployment Risks

**Environment Variable Management (High):**
- Issue: 環境変数が `.env.local` に散在。Zoom A/B, Google, Resend など複数の external credentials があり、管理が煩雑
- Files: `.env.local`（Git committed されないが、開発者間 공유 방법이 불명확）
- Impact:
  - 新しい開発者が環境構築時に credentials を取得するプロセスが不明確
  - 환경 변수 누락으로 인한 개발 지연
- Fix approach:
  - 환경 변수 템플릿 파일 작성 (`.env.local.example`)
  - README에 각 external service의 설정 단계별 정리
  - 1Password 또는 GitHub Secrets 사용해서 credentials 중앙화

**Database Migration Risk (High):**
- Issue: Supabase migrations를 로컬에서 먼저 테스트하고, 프로덕션에서 실행하는 프로세스가 정의되지 않음
- Files: `supabase/migrations/`
- Impact:
  - 프로덕션 마이그레이션 실패 시 롤백 절차 불명확
  - Down migration이 정의되지 않으면 되돌릴 수 없음
- Fix approach:
  - 모든 migration에 up + down script 작성
  - GitHub Actions로 자동 마이그레이션 테스트
  - 프로덕션 배포 전 스테이징에서 먼저 실행

**TypeScript Type Safety for Database (Medium):**
- Issue: `supabase gen types`로 자동생성된 types (`src/types/database.ts`)가 실제 DB schema와 sync 상태 유지가 불명확
- Files: `src/types/database.ts` (생성 예정)
- Impact:
  - 마이그레이션 후 types를 다시 생성하지 않으면 mismatch 발생
  - 런타임 에러로 데이터 접근 실패
- Fix approach:
  - `supabase gen types` 실행을 CI/CD 파이프라인에 포함
  - Pre-commit hook에서 types 동기화 확인
  - Vercel 배포 전 type check 자동화

**Missing Logging Strategy (Medium):**
- Issue: 예약 생성, 포인트 소비 등 중요 작업의 로깅 정책이 미정의
- Files: 모든 Route Handlers (구현 예정)
- Impact:
  - 문제 발생 시 원인 파악이 어려움
  - 감사 추적(audit trail) 부재
- Fix approach:
  - winston 또는 pino logger 도입
  - 모든 외부 API 호출 전후에 로깅
  - 에러 발생 시 상세 로그 + stack trace 기록

---

## Regulatory & Compliance Risks

**Personal Data Handling (GDPR/Japan Act) (Medium):**
- Issue: 고객 이름, 이메일, 예약 정보를 저장하지만, GDPR/개인정보보호법 준수 가이드가 없음
- Files: `profiles`, `bookings`, `point_transactions` 테이블
- Impact:
  - EU 사용자의 데이터 삭제 요청에 응하지 못할 수 있음
  - 개인정보보호 규정 위반으로 인한 법적 문제
- Fix approach:
  - Privacy Policy 작성
  - 데이터 삭제 API 구현 (회원 탈퇴 시 개인정보 제거)
  - PostgreSQL 함수로 자동 데이터 만료/삭제 로직

---

## Summary of Priority Issues

| 영역 | 심각도 | 해결 타이밍 | 핵심 조치 |
|---|---|---|---|
| Transaction Rollback | Critical | Phase 3 구현 전 | 보상 트랜잭션 설계 + 테스트 케이스 |
| Point Consistency | Critical | Phase 1 완료 후 | `consume_points` 함수 단위 테스트 |
| RLS Policy Performance | High | Phase 2 완료 후 | JWT claim 기반 권한 최적화 |
| Zoom Account Management | High | Phase 2 완료 후 | 계정 유효성 체크 함수화 |
| Google Calendar Rate Limiting | High | Phase 3 전 | 동시성 제어 + cron 전환 계획 |
| Guest Booking Rate Limiting | Medium | Phase 3 완료 전 | Vercel Edge Middleware 설정 |
| Cron Edge Function Reliability | High | Phase 5 구현 시 | 로깅 + 실패 알림 메커니즘 |
| Testing Strategy | Critical | 개발 시작 전 | 트랜잭션, RLS, Edge Function 테스트 케이스 정의 |

---

*Concerns audit: 2026-02-22*
