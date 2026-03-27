# Pitfalls Research

**Domain:** 既存Next.js + Supabase予約システムへの機能追加（v1.3 運用改善）
**Researched:** 2026-03-27
**Confidence:** HIGH（既存コードベース直接調査 + 公式ドキュメント検証）

---

## Critical Pitfalls

### Pitfall 1: Zoom APIカレンダー取得でのアカウントB（無料）制限エラー

**What goes wrong:**
`GET /users/me/meetings` でZoomアカウントBのスケジュール済み会議一覧を取得しようとすると、APIエラーコード `3161`（"Your user account is not allowed meeting hosting and scheduling capabilities"）が返り、busy時間の取得に失敗する。GETリクエストなのにこのエラーが出るのは、Zoom無料アカウント（Basic）のAPIスコープ制限によるもの。

**Why it happens:**
Zoomアカウント Bは無料アカウント（40分自動終了あり）。無料アカウントはServer-to-Server OAuthでのmeetingスコープに制限があり、`meeting:read:admin` でも一覧取得が制限される場合がある。既存コード（`zoom.ts`）は会議の作成・削除にのみ使用しており、スケジュール一覧取得は未実装。

**How to avoid:**
1. 実装前にアカウントBで `GET /users/me/meetings?type=scheduled` の動作を手動検証する
2. エラーコード3161のフォールバック処理を明示的に実装する（エラー時は空配列返却、ログ記録）
3. アカウントBのbusyチェックは「作成済み会議IDリストからのフィルタ」ではなく「DBのbookingsテーブル参照」で代替することも検討する

**Warning signs:**
- 開発環境でZoomアカウントB側のAPI呼び出しが静かに空配列を返している
- テストでbookingsテーブルとZoomカレンダーの結果が一致しない

**Phase to address:** Zoomカレンダーブロック実装フェーズ（最初のタスク）

---

### Pitfall 2: Zoom APIレート制限でのキャッシュ未考慮

**What goes wrong:**
`GET /users/me/meetings` をオンデマンド方式（空き枠チェック毎に呼び出し）で実装すると、複数ユーザーが同時に予約ページを開いた際に429エラーが発生する。Zoom Pro アカウントでは Light API: 30リクエスト/秒の制限がある。

**Why it happens:**
既存の `getCachedBusyTimes`（Googleカレンダー15分TTLキャッシュ）のパターンが確立されているが、Zoomスケジュール取得を追加する際にキャッシュを実装し忘れるケースがある。特に両Zoomアカウント（A・B）で個別にAPIを叩く設計にすると、スロット表示1回で最大2リクエスト発生する。

**How to avoid:**
`getCachedBusyTimes` と同じLRUキャッシュパターンをZoomスケジュール取得にも適用する。`zoom.ts`に `getCachedZoomSchedules(accountType)` 関数を追加し、TTL 15分以上を設定する。既存の `busyTimesCache` と同じ設計（`lru-cache` + TTL）に揃える。

**Warning signs:**
- ログに `[Zoom] Fetching new access token` が過度に頻繁に出る
- 予約ページの複数タブ同時開で断続的な500エラーが発生する

**Phase to address:** Zoomカレンダーブロック実装フェーズ

---

### Pitfall 3: RLSポリシー変更マイグレーションでの既存ポリシー競合

**What goes wrong:**
`meeting_menus` テーブルの既存RLSポリシー「Anyone can view active menus」は `is_active = true` のメニューを全員に公開している。プランタイプ別表示を追加するために新しいSELECTポリシーを追加すると、PostgreSQLの「複数のpermissiveポリシーはORで評価される」仕様により、新ポリシーが期待通りに機能しない。

**Why it happens:**
PostgreSQLのRLSは、同一操作に対する複数のpermissiveポリシーが**OR結合**される。`is_active = true`を見せる既存ポリシーが残ったまま、「プランタイプがXの場合のみ見せる」ポリシーを追加しても、既存ポリシーで既に全員に表示される。

**How to avoid:**
1. 新ポリシー追加前に、影響を受ける既存ポリシーをリストアップして確認する
2. 既存の「Anyone can view active menus」ポリシーを DROP して、新しいポリシー（プランタイプ考慮版）に置き換えるマイグレーションを書く
3. マイグレーション内で `DROP POLICY ... CREATE POLICY` をアトミックに実行する
4. **代替アプローチ推奨**: RLSで制御せず、アプリケーション層（Server Actions/API Route）でフィルタリングする。現在のコードは service_role を使ったServer Actions経由のため、アプリ層フィルタの方が確実でテストしやすい

**Warning signs:**
- RLSポリシーを追加したのに制限が効いていない
- Supabase Dashboard の RLS advisor が「Multiple Permissive Policies」警告を出す
- anon クライアントでプランタイプ制限されるはずのメニューが見えてしまう

**Phase to address:** プランタイプ別メニュー表示実装フェーズ

---

### Pitfall 4: ポイント溢れ判定でのタイムゾーン誤差（JST vs UTC）

**What goes wrong:**
「毎月20日にバッチ実行」を `pg_cron` で設定する際、`cron.schedule('0 0 20 * *', ...)` と書くと**UTC 00:00**（JST 09:00）に実行される。JST 20日0時に実行したい場合は `0 15 19 * *`（UTC 前日15時）と書く必要がある。また「月末付与前のポイント余剰」を計算する際、UTC基準とJST基準がずれると誤ったユーザーに通知される。

**Why it happens:**
pg_cronは設計上GMT（UTC）固定で動作する（公式GitHub issue #16で確認済み。2.0対応予定だが未解決）。既存の `grant_monthly_points` Edge Function は冪等性チェックに `${currentMonth}-01T00:00:00Z`（UTC）を使用。新しいポイント溢れ通知バッチも同様に「今月の残高がmax_points超えるか」を計算するが、`new Date()` がUTC基準のため、JST 20日の日付計算がズレるケースがある。

**How to avoid:**
1. pg_cronのcron式はUTCで記述する。JST 20日AM9:00実行なら `0 0 20 * *` UTC、JST 20日AM0:00実行なら `0 15 19 * *` UTC
2. Edge Function内の日付計算はすべてUTC+9オフセット明示で行う
3. 溢れ判定クエリは `NOW() AT TIME ZONE 'Asia/Tokyo'` を使ったPostgres SQL関数内で完結させる（アプリ層での日付計算を避ける）
4. 実行時刻はJSTで記録し `task_execution_logs` でデバッグを容易にする

**Warning signs:**
- バッチログの `started_at` がJST深夜ではなくAM9:00台になっている
- 前月残高が多い会員に通知が行かない（前月末の計算ズレ）
- 既存 `monthly_point_grant` の冪等性チェックと日時比較ロジックを流用した場合

**Phase to address:** ポイント溢れ通知メール実装フェーズ

---

### Pitfall 5: ポイント溢れ通知のNew Edge Function追加でpg_cron登録漏れ

**What goes wrong:**
新しい Edge Function（`check-point-overflow`）をデプロイしても、pg_cronジョブの登録をし忘れるか、既存のコメントアウトされたSQL（`automation_tasks.sql`）のパターンに倣って手動でSQLを実行し忘れる。本番環境で通知が一度も送られない状態が20日まで気づかれない。

**Why it happens:**
既存の pg_cron ジョブ定義は `20260223000001_automation_tasks.sql` でコメントアウトされており「本番デプロイ時にuncomment」と記されている。新機能追加時に同じパターンを新マイグレーションに書く必要があるが、マイグレーション適用とpg_cron登録が別作業のため抜け落ちやすい。

**How to avoid:**
1. 新Edge Functionのデプロイと pg_cron 登録を同一マイグレーションファイルにセットで書く
2. pg_cronジョブ登録SQLを新マイグレーションに含め、`supabase db push` 1コマンドで完結するようにする
3. `task_execution_logs` テーブルの `task_name` CHECK制約に新タスク名を追加するのを忘れない

**Warning signs:**
- `cron.job_run_details` テーブルに新タスクの実行履歴がない
- `task_execution_logs` に20日以降のエントリがない
- `task_execution_logs.task_name` の CHECK制約エラーでログ記録自体が失敗している

**Phase to address:** ポイント溢れ通知メール実装フェーズ

---

### Pitfall 6: 会員アクティビティクエリのN+1問題

**What goes wrong:**
「30日/60日未訪問の会員」を表示する際、現在の `getMembers()` クエリ（`src/lib/actions/admin/members.ts`）に `last_booking_at` を追加する方法を誤ると N+1 クエリが発生する。各会員ごとに最新予約日を個別SELECT するパターンや、アプリ層でのループ処理は、会員が10人でも将来的な拡張で問題になる。

**Why it happens:**
`getMembers` は現在 profiles + member_plans を JOIN して取得している。予約履歴の「最終予約日」を追加する際、`bookings` テーブルへの集約クエリ（MAX(start_time)）を subquery や LEFT JOIN で適切に書かずに、個別ループで取得する実装をしてしまう。

**How to avoid:**
1クエリで集約するSQLパターンを使う。

```sql
SELECT
  p.*,
  mp.*,
  MAX(b.start_time) AS last_booking_at
FROM profiles p
LEFT JOIN member_plans mp ON mp.user_id = p.id
LEFT JOIN bookings b ON b.member_plan_id = mp.id
  AND b.status != 'canceled'
GROUP BY p.id, mp.id
```

もしくは `profiles` テーブルに `last_booking_at` カラムを追加してトリガーで更新する方式（読み取り頻度が高い場合に有効）。

**Warning signs:**
- `getMembers()` の実行時間が会員数に比例して増加する
- Supabase ログに同一セッション内で `bookings` テーブルへのクエリが10回以上出る
- 会員一覧ページのロード時間が他のページより明らかに長い

**Phase to address:** 会員アクティビティ表示実装フェーズ

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Zoomスケジュールをキャッシュなしで毎回取得 | 実装が簡単 | レート制限ヒット、UX悪化 | never（既存パターンに合わせてLRUキャッシュ必須） |
| `task_execution_logs.task_name` のCHECK制約を外して文字列自由入力 | 制約変更マイグレーション不要 | タスク名タイポによるログ断絶、監視不能 | never |
| 会員アクティビティをクライアント側でフィルタ（全件取得→JS filter） | サーバー実装省略 | 大規模化で帯域・パフォーマンス問題 | MVP 10人規模のみ許容、50人超えたら要修正 |
| RLSポリシーを追加せずService Role APIのみで制御 | RLS設計不要 | 管理画面バグでデータ漏洩リスク | admin操作専用経路のみ許容 |
| pg_cron登録をドキュメント手順書に書いてマイグレーションに含めない | マイグレーションが単純 | デプロイ漏れによるサイレント障害 | never |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Zoom API（アカウントB無料） | `GET /users/me/meetings` が動くと前提で実装する | 実装前にアカウントBでAPIスコープ制限を検証。3161エラーのフォールバック必須 |
| Zoom API レート制限 | スロット確認ごとに直接APIを叩く | `zoom.ts` に `getCachedZoomSchedules()` を追加、TTL 15分以上でLRUキャッシュ |
| Zoom API トークンキャッシュ | スケジュール取得用に別キャッシュを作り忘れる | `busyTimesCache` と同じ設計でZoom分を追加。ファイルは `zoom.ts` 内に集約 |
| Resend 無料枠 | リトライロジック実装時に重複送信すると日次100通制限に達する | 送信前に `task_execution_logs` で冪等チェック。1会員1通の保証を関数レベルで実装 |
| pg_cron タイムゾーン | `cron.schedule('0 0 20 * *', ...)` をJST 20日AM0:00と誤解する | cron式はUTC基準。JST 20日AM9:00 = UTC 20日00:00 = `0 0 20 * *` |
| Supabase Edge Functions + pg_cron | Edge FunctionのURLをハードコードして環境ごとに変わるURLに対応できない | Vault シークレット（`edge_function_url`）を使う。既存 `automation_tasks.sql` のパターンを踏襲 |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Zoom APIへのuncached直接呼び出し | 予約ページロードが遅い、429エラー散発 | LRUキャッシュ TTL 15分 | 同時アクセス3件以上 |
| RLSポリシーのSubquery評価（member_plans JOIN） | 管理者画面の会員一覧が遅い | `(SELECT auth.jwt() -> ...)` ベースの定数評価に統一 | 会員50人超 |
| 会員アクティビティ: bookings全件→アプリ側集計 | getMembers の実行時間が長い | SQLの GROUP BY + MAX() で集約 | 予約件数500件超 |
| バッチメール: 会員全員に同期送信 | Edge Functionがタイムアウト（10分制限） | Resend APIは5req/秒制限。10人なら問題なし、100人超はキュー方式に変更必要 | 会員100人超 |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| `meeting_menus` のプランタイプフィルタをRLSのみで実装 | 複数permissiveポリシーOR結合で意図しないデータ露出 | Server Actions層（service_role使用）でのアプリ層フィルタを併用 |
| Zoom APIトークンをVercel環境変数以外に保存 | クレデンシャル漏洩 | 既存パターン通り `process.env` のみ使用。新機能でも同パターン厳守 |
| 新Edge Functionに認証ヘッダーチェックを付け忘れる | 外部からの無制限呼び出しでメール爆撃 | 既存Functionsのパターン（`authHeader` チェック）を必ず踏襲 |
| 溢れ通知メールに会員情報を含める際にRaw HTMLを混在 | HTMLインジェクション | React Emailコンポーネントを使用（既存パターン通り）。テンプレートにRaw HTMLを混在させない |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| プランタイプ制限メニューを非表示にするだけで理由を説明しない | 会員が「なぜこのメニューがないのか」を理解できない | グレーアウト + ツールチップ「このメニューはXXプラン以上でご利用いただけます」 |
| 溢れ通知メールに「何ポイント余剰か」の数値を記載しない | 会員が行動すべき緊急性を判断できない | 現残高・月末付与予定ポイント・上限・損失予定ポイントを明記 |
| 会員アクティビティの色分けだけでフィルタ機能がない | 大量の会員一覧からアクティブ/非アクティブを識別しにくい | 色分け + active/inactiveフィルタタブまたはソート機能のセット実装 |
| Zoomカレンダーブロックのエラー時に予約枠が正常に見える | 二重予約リスク（Zoom側でブロック済みなのに予約枠が空きとして表示） | エラー時はサイレント処理ではなく、管理者にログ警告を出す |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Zoomカレンダーブロック:** アカウントAとBの両方で個別にAPIテスト済み — アカウントBの3161エラーハンドリングを確認
- [ ] **Zoomカレンダーブロック:** LRUキャッシュが実装され、同一時間帯の連続アクセスでAPI呼び出しが発生しないことを確認
- [ ] **Zoomカレンダーブロック:** busy時間が既存Googleカレンダーのbusyチェックと正しくORマージされていることを確認（AND条件にすると片方が失敗した際に予約枠が全消えする）
- [ ] **プランタイプ別メニュー:** 既存RLSポリシー「Anyone can view active menus」とポリシー競合がないことを確認
- [ ] **プランタイプ別メニュー:** ゲストユーザー（anon）が制限付きメニューを見られないことをanon clientでテスト
- [ ] **ポイント溢れ通知:** pg_cronのcron式がUTC基準で正しく記述されており、JST 20日の意図した時刻に動作することを確認
- [ ] **ポイント溢れ通知:** `task_execution_logs.task_name` のCHECK制約に新タスク名が追加されていることを確認
- [ ] **ポイント溢れ通知:** `max_points = NULL`（無制限）の会員は通知対象外であることを確認（溢れが発生しないため）
- [ ] **ポイント溢れ通知:** 残高が既に `max_points` に達している会員（既に溢れ済み）の処理を確認
- [ ] **会員アクティビティ:** `getMembers()` クエリが N+1 になっておらず、SQL集計で完結していることをログで確認
- [ ] **会員アクティビティ:** キャンセルされた予約が「最終セッション日」の計算から除外されていることを確認（`status != 'canceled'`）

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Zoom APIレート制限ヒット（429） | LOW | キャッシュ追加マイグレーション不要、`zoom.ts` にLRUキャッシュ追加してデプロイ |
| RLSポリシー競合で意図しないデータ露出 | MEDIUM | DROPして再作成するマイグレーション作成。RLSの変更はDB接続でアトミックに実施 |
| pg_cronのタイムゾーン誤設定（既に誤ったcron登録済み） | LOW | `cron.unschedule('job_name')` して正しいcron式で再登録 |
| pg_cronジョブ登録漏れ（本番で20日を過ぎた） | LOW | 手動でEdge Functionを直接HTTP invokeして補完実行 |
| 会員アクティビティのN+1クエリ（本番でパフォーマンス問題） | MEDIUM | Server Actionのクエリ修正のみ（DB変更不要）。Vercelのみ再デプロイ |
| 溢れ通知メールの重複送信 | MEDIUM | Resendは送信取り消し不可。task_execution_logsで冪等チェックを追加してデプロイ |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ZoomアカウントB制限エラー（3161） | Zoomカレンダーブロック実装 | アカウントBで `GET /users/me/meetings` をcurl実行して動作確認 |
| Zoom APIレート制限キャッシュ未実装 | Zoomカレンダーブロック実装 | `zoom.ts` のLRUキャッシュ実装を確認 |
| RLSポリシー競合 | プランタイプ別メニュー表示実装 | anon clientで制限メニューが取得できないことを確認 |
| pg_cronタイムゾーン誤設定 | ポイント溢れ通知メール実装 | `cron.job_run_details` で実行時刻を確認（UTC 00:00 = JST 09:00） |
| pg_cronジョブ登録漏れ | ポイント溢れ通知メール実装 | `SELECT * FROM cron.job` で新ジョブが存在することを確認 |
| task_execution_logs CHECK制約漏れ | ポイント溢れ通知メール実装 | 新タスク名でのINSERTが成功することをテスト |
| 会員アクティビティN+1クエリ | 会員アクティビティ表示実装 | Supabase Dashboard のQuery Performanceで実行計画を確認 |
| キャンセル予約が最終訪問日に含まれる | 会員アクティビティ表示実装 | キャンセルのみの会員が「未訪問」として正しく表示されることを確認 |

---

## Sources

- Zoom API Rate Limits 公式: https://developers.zoom.us/docs/api/rate-limits/
- Zoom Error Code 3161 (Zoom Community): https://community.zoom.com/t5/Zoom-Meetings/API-Error-code-3161-on-GET-users-userId-meetings-v2-zoom/td-p/238510
- Supabase RLS Multiple Permissive Policies: https://supabase.com/docs/guides/database/database-advisors?lint=0006_multiple_permissive_policies
- pg_cron Timezone Issue (UTC固定の確認): https://github.com/citusdata/pg_cron/issues/16
- Resend API Rate Limits: https://resend.com/docs/api-reference/rate-limit
- 既存コードベース直接調査: `src/lib/integrations/zoom.ts`, `src/lib/integrations/google-calendar.ts`, `supabase/migrations/20260222000002_rls_policies.sql`, `supabase/migrations/20260223000001_automation_tasks.sql`, `supabase/functions/monthly-point-grant/index.ts`

---
*Pitfalls research for: Next.js + Supabase予約システム v1.3 運用改善（Zoomカレンダーブロック・プランタイプ別メニュー・ポイント溢れ通知・会員アクティビティ）*
*Researched: 2026-03-27*
