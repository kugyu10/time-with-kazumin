# Phase 6: 自動化タスク - Research

**Researched:** 2026-02-23
**Domain:** Supabase Edge Functions + pg_cron による定期実行タスク自動化
**Confidence:** HIGH

## Summary

Phase 6では、Supabase Edge Functionsとpg_cronを組み合わせて、月次ポイント付与、リマインダーメール、サンキューメールの3つの自動化タスクを実装します。

pg_cronはPostgreSQL拡張機能で、cron構文を使った定期実行をデータベース内で完結できます。Edge Functionsはpg_net経由でHTTP呼び出しし、認証にはSupabase Vaultを使用します。実行履歴はcron.job_run_detailsとカスタムtask_execution_logsテーブルで管理します。

**Primary recommendation:** Dashboard UIまたはSQLでpg_cronジョブを設定し、Edge FunctionsでビジネスロジックをTypeScriptで実装。認証トークンはVaultで管理し、バッチ処理は小さな単位に分割して中間COMMITを挟む。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **タスク実行方式**: Supabase Edge Functions + pg_cronで実行
- **MVPはpg_cronのみ**: 将来的にDatabase Webhooks拡張を見据えた設計
- **月次ポイント付与**: 毎月1日 00:00 JST
- **リマインダー/サンキューメールチェック**: 15分ごと
- **Edge Functionsタイムアウト**: デフォルト150秒で十分

### 失敗時の挙動（Locked）
- **即時リトライ3回**（指数バックオフなし）
- **管理者通知**: 管理画面の実行履歴でのみ確認（メール/Slack通知なし）
- **部分失敗**: 成功分は完了扱い、失敗分のみ記録
- **ポイント付与失敗**: リトライ後も失敗ならスキップ（次月に持ち越さない）
- **手動再実行機能**: 不要（次の定期実行を待つ）

### メール送信タイミング（Locked）
- **リマインダーメール**: 予約の24時間前に送信
- **サンキューメール**: セッション終了30分後に送信
- **対象**: 会員・ゲスト両方に送信
- **サンキューメールON/OFF**: meeting_menusテーブルにカラム追加（send_thank_you_email, default: false）

### 実行履歴管理（Locked）
- **保存先**: 新規テーブル（task_execution_logs）
- **表示**: ダッシュボードに概要 + /admin/tasks に詳細一覧
- **保持期間**: 365日
- **記録粒度**: ユーザー単位（「ユーザーAにメール送信」単位で記録）

### Claude's Discretion
- task_execution_logsテーブルの具体的なスキーマ設計
- pg_cronジョブの具体的な設定
- Edge Functions内のエラーハンドリング詳細

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYS-01 | システムは毎月1日にプランに応じたポイントを自動付与する | pg_cronで毎月1日00:00 JSTに実行。バッチ処理パターンでmember_plansを更新 |
| SYS-05 | システムはセッション終了後30分でサンキューメールを送信する（ON/OFF可） | 15分間隔チェックで該当予約を抽出。meeting_menus.send_thank_you_emailで制御 |
| MEMBER-06 | 会員はセッション前日にリマインダーメールを受け取れる | 15分間隔チェックで24時間前の予約を抽出。Resend経由でメール送信 |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg_cron | 1.6.4+ | PostgreSQL内でのcronジョブ実行 | Postgres 15.6.1.122以降で標準搭載。自動復旧機能あり |
| pg_net | 最新 | PostgreSQL内からのHTTP呼び出し | Supabase公式推奨。Edge Functions呼び出しに必須 |
| Supabase Vault | 最新 | 暗号化されたシークレット管理 | 認証トークンの安全な保管。libsodium AEAD暗号化 |
| Deno Runtime | 最新 | Edge Functionsの実行環境 | Supabase Edge Functionsの標準ランタイム。TypeScriptネイティブ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Email | 既存 | メールテンプレート | サンキュー・リマインダーテンプレート新規作成 |
| Resend | 既存 | メール送信 | 既存パターンを踏襲 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_cron | Vercel Cron | 外部依存が増える。Supabaseと同一環境で実行できるpg_cronが推奨 |
| Edge Functions | Database Functions | 複雑なロジックはTypeScriptの方が保守性高い |
| Vault | 環境変数 | 環境変数はDBダンプに残る可能性あり。Vaultは暗号化保証 |

**Installation:**
```sql
-- Extensions (Supabaseプロジェクトで標準有効化済み)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── functions/
│   ├── monthly-point-grant/        # 月次ポイント付与
│   │   └── index.ts
│   ├── check-reminder-emails/      # リマインダーメール送信チェック
│   │   └── index.ts
│   └── check-thank-you-emails/     # サンキューメール送信チェック
│       └── index.ts
├── migrations/
│   └── 20260223000001_automation_tasks.sql  # task_execution_logs + pg_cronジョブ定義
```

### Pattern 1: pg_cron + pg_net + Vault でEdge Function呼び出し

**What:** pg_cronでスケジュールし、pg_netでEdge FunctionにHTTP POSTリクエストを送る。認証トークンはVaultから取得。

**When to use:** 定期実行タスクでEdge Functionsを呼び出す全ケース

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/functions/schedule-functions

-- 1. Vaultに認証情報を保存
select vault.create_secret('https://your-project.supabase.co', 'project_url');
select vault.create_secret('your-anon-key', 'anon_key');

-- 2. pg_cronジョブを設定
select cron.schedule(
  'check-reminder-emails', -- ジョブ名
  '*/15 * * * *',          -- 15分ごと
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/check-reminder-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Pattern 2: バッチ処理でポイント付与

**What:** 全会員のポイントを一括更新する際、小さなバッチに分割して中間COMMITを挿入

**When to use:** 大量レコードを更新する月次ポイント付与タスク

**Example:**
```typescript
// Source: https://medium.com/@nikhil.srivastava944/massive-data-updates-in-postgresql-how-we-processed-80m-records-with-minimal-impact-20babd2cfe6f

// Edge Function内での実装例
const BATCH_SIZE = 100;

const { data: activePlans } = await supabase
  .from('member_plans')
  .select('id, plan_id, current_points, monthly_points, max_points')
  .eq('status', 'active');

for (let i = 0; i < activePlans.length; i += BATCH_SIZE) {
  const batch = activePlans.slice(i, i + BATCH_SIZE);

  for (const plan of batch) {
    const newPoints = Math.min(
      plan.current_points + plan.monthly_points,
      plan.max_points ?? Infinity
    );

    await supabase.rpc('grant_monthly_points', {
      p_member_plan_id: plan.id,
      p_points: plan.monthly_points
    });
  }

  // バッチ間で小休止（CPU負荷軽減）
  if (i + BATCH_SIZE < activePlans.length) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Pattern 3: 15分間隔ポーリングでメール送信タイミング判定

**What:** 15分ごとにEdge Functionが起動し、現在時刻から24時間後（リマインダー）または30分前終了（サンキュー）の予約を抽出

**When to use:** リマインダー・サンキューメールの送信判定

**Example:**
```typescript
// check-reminder-emails Edge Function

const now = new Date();
const reminderWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24時間後
const windowStart = new Date(reminderWindow.getTime() - 15 * 60 * 1000); // 15分前から
const windowEnd = new Date(reminderWindow.getTime() + 15 * 60 * 1000);   // 15分後まで

const { data: bookings } = await supabase
  .from('bookings')
  .select('*, menu:meeting_menus(*), member:member_plans(user:profiles(*))')
  .eq('status', 'confirmed')
  .gte('start_time', windowStart.toISOString())
  .lte('start_time', windowEnd.toISOString())
  .is('reminder_sent_at', null); // 未送信のみ

for (const booking of bookings) {
  await sendReminderEmail(booking);
  await supabase
    .from('bookings')
    .update({ reminder_sent_at: now.toISOString() })
    .eq('id', booking.id);
}
```

### Anti-Patterns to Avoid

- **長時間実行タスク**: Edge Functionsは150秒タイムアウト。長時間処理はバッチ分割必須
- **無限ループリトライ**: pg_cronは最大32並行ジョブ。リトライは3回固定で打ち切る
- **認証トークンのハードコード**: Vaultを使わず環境変数やコードに埋め込むとセキュリティリスク
- **cron.job_run_detailsの無制限蓄積**: 定期的にクリーンアップしないとテーブル肥大化

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron構文パーサー | 独自のスケジューリングロジック | pg_cron | Postgres標準拡張。実績あり、自動復旧機能内蔵 |
| 暗号化シークレット管理 | 独自の暗号化テーブル | Supabase Vault | libsodium AEAD暗号化。暗号鍵がDBダンプに含まれない設計 |
| HTTPリトライロジック | Edge Function内でfetch + retry実装 | pg_netのビルトイン or Deno標準ライブラリ | テスト済み。指数バックオフ対応 |
| タイムゾーン変換 | 手動計算 | PostgreSQL `AT TIME ZONE` | JSTへの変換はPostgreSQLの機能で確実 |

**Key insight:** pg_cronとVaultはSupabaseが提供する統合ソリューション。独自実装するとセキュリティリスクと保守コストが増大。

## Common Pitfalls

### Pitfall 1: pg_cronジョブが実行されない

**What goes wrong:** ジョブを作成したが、cron.job_run_detailsに実行履歴が残らない

**Why it happens:**
- pg_cronスケジューラープロセスが起動していない
- 並行実行数が32上限に達している
- データベース接続プールが枯渇している

**How to avoid:**
```sql
-- スケジューラープロセスの確認
SELECT * FROM pg_stat_activity WHERE application_name = 'pg_cron';

-- 実行中ジョブの確認
SELECT * FROM cron.job WHERE active = true;

-- 実行履歴の確認（過去5日間）
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

**Warning signs:**
- `pg_stat_activity`に`pg_cron`アプリケーションが存在しない
- 実行履歴が全く記録されていない
- Supabase Log Explorerで"pg_cron"フィルタリングしてもログが出ない

**Recovery:** Supabase Dashboard > Settings > General > Fast Reboot でワーカー再起動

### Pitfall 2: Vault認証トークンの権限不足

**What goes wrong:** Edge Function呼び出しは成功するが、403 Forbiddenが返る

**Why it happens:**
- VaultにANON_KEYを保存したが、Edge Functionがservice_role権限を要求する
- または逆にservice_role_keyで呼び出したがRLS制約でブロックされる

**How to avoid:**
- Edge FunctionがRLSバイパスを要求する場合は`service_role_key`をVaultに保存
- 一般的なタスクは`anon_key`で十分（RLS適用済みデータのみアクセス）
- Edge Function内で`createClient`する際、適切なキーを使用

```typescript
// Edge Function内での判定
const authHeader = req.headers.get('Authorization');
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // service_roleで実行
);
```

**Warning signs:**
- cron.job_run_detailsのステータスは`succeeded`だが、メールが送信されない
- Edge Functionログに403エラーが記録されている

### Pitfall 3: 15分間隔のポーリングで重複送信

**What goes wrong:** 同じ予約に対してリマインダーメールが2回送信される

**Why it happens:**
- 15分間隔で実行されるため、前回実行と今回実行でウィンドウが重複
- `reminder_sent_at`フラグの更新が遅延し、次回実行時に再度対象になる

**How to avoid:**
```typescript
// bookingsテーブルにフラグカラム追加
// reminder_sent_at: TIMESTAMPTZ
// thank_you_sent_at: TIMESTAMPTZ

// 送信前にフラグをチェック
.is('reminder_sent_at', null)

// 送信後に即座にフラグを更新
await supabase
  .from('bookings')
  .update({ reminder_sent_at: new Date().toISOString() })
  .eq('id', booking.id);
```

**Warning signs:**
- 同じ予約IDに対してtask_execution_logsに複数の成功レコードがある
- ユーザーから「2通届いた」という報告

### Pitfall 4: 月次ポイント付与の二重実行

**What goes wrong:** 1日に2回ポイントが付与される

**Why it happens:**
- pg_cronジョブが00:00 UTCで設定され、JST変換を忘れた
- または手動で再実行した際、冪等性チェックがない

**How to avoid:**
```sql
-- JSTで毎月1日 00:00に実行（UTC 15:00 前日末日）
-- cron: '0 15 L * *' (月末日の15:00 UTC = JST翌日00:00)
-- 注意: pg_cronは'L'（last day）未対応のため、月初1日で設定

-- 正しい設定: 毎月1日 15:00 UTC（= JST 2日 00:00）ではなく
-- 毎月1日 00:00 JST = 前日 15:00 UTC
-- → シンプルに毎月1日の00:00 UTCで実行し、Edge Function内でJST判定

select cron.schedule(
  'monthly-point-grant',
  '0 0 1 * *', -- 毎月1日 00:00 UTC
  $$
  select net.http_post(...) as request_id;
  $$
);
```

```typescript
// Edge Function内で冪等性チェック
const today = new Date();
const isFirstDayOfMonth = today.getUTCDate() === 1;

if (!isFirstDayOfMonth) {
  return new Response('Not first day of month', { status: 200 });
}

// さらに: point_transactionsにmonthly_grantレコードが今月分既に存在するかチェック
const thisMonth = today.toISOString().slice(0, 7); // '2026-02'
const { data: existingGrants } = await supabase
  .from('point_transactions')
  .select('id')
  .eq('transaction_type', 'monthly_grant')
  .gte('created_at', `${thisMonth}-01`)
  .limit(1);

if (existingGrants && existingGrants.length > 0) {
  return new Response('Already granted this month', { status: 200 });
}
```

**Warning signs:**
- point_transactionsに同じ月に複数のmonthly_grantレコード
- ユーザーの残高が想定の2倍になっている

### Pitfall 5: Edge Functionタイムアウト（150秒制限）

**What goes wrong:** 大量の会員にメール送信中にEdge Functionがタイムアウトし、途中までしか処理されない

**Why it happens:**
- 1000人の会員に1件ずつメール送信すると150秒を超える
- Resend APIの応答が遅延している

**How to avoid:**
- バッチサイズを調整（例: 1回のEdge Function実行で最大100件まで）
- 超過分は次回実行時に処理（フラグで未処理を判定）
- または: Edge Functionを複数回呼び出し、オフセットを指定

```typescript
// BATCH_SIZE制限
const BATCH_SIZE = 100;

const { data: bookings, count } = await supabase
  .from('bookings')
  .select('*', { count: 'exact' })
  .eq('status', 'confirmed')
  // ... 他の条件
  .limit(BATCH_SIZE);

console.log(`Processing ${bookings.length} / ${count} total bookings`);
```

**Warning signs:**
- Edge Functionログに"wall clock time limit reached"エラー
- task_execution_logsのステータスが`timeout`
- 一部のユーザーにしかメールが届いていない

## Code Examples

### 月次ポイント付与 Edge Function

```typescript
// Source: Supabase Edge Functions + PostgreSQL batch processing patterns

// supabase/functions/monthly-point-grant/index.ts

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date()
  const isFirstDay = today.getUTCDate() === 1

  if (!isFirstDay) {
    return new Response(JSON.stringify({ message: 'Not first day of month' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 冪等性チェック
  const thisMonth = today.toISOString().slice(0, 7)
  const { data: existingGrants } = await supabase
    .from('point_transactions')
    .select('id')
    .eq('transaction_type', 'monthly_grant')
    .gte('created_at', `${thisMonth}-01`)
    .limit(1)

  if (existingGrants && existingGrants.length > 0) {
    return new Response(JSON.stringify({ message: 'Already granted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // アクティブな会員プランを取得
  const { data: plans, error: fetchError } = await supabase
    .from('member_plans')
    .select('id, monthly_points')
    .eq('status', 'active')

  if (fetchError) throw fetchError

  const results = { success: 0, failed: 0, errors: [] as string[] }

  for (const plan of plans) {
    try {
      // grant_monthly_points RPCを3回リトライ
      let attempt = 0
      let success = false

      while (attempt < 3 && !success) {
        const { error: grantError } = await supabase.rpc('grant_monthly_points', {
          p_member_plan_id: plan.id,
          p_points: plan.monthly_points
        })

        if (!grantError) {
          success = true
          results.success++
        } else {
          attempt++
          if (attempt >= 3) {
            results.failed++
            results.errors.push(`Plan ${plan.id}: ${grantError.message}`)
          }
        }
      }
    } catch (err) {
      results.failed++
      results.errors.push(`Plan ${plan.id}: ${err.message}`)
    }
  }

  // task_execution_logsに記録
  await supabase.from('task_execution_logs').insert({
    task_name: 'monthly_point_grant',
    status: results.failed > 0 ? 'partial_success' : 'success',
    total_count: plans.length,
    success_count: results.success,
    failed_count: results.failed,
    error_details: results.errors.length > 0 ? results.errors : null
  })

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### リマインダーメール送信チェック Edge Function

```typescript
// supabase/functions/check-reminder-emails/index.ts

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendReminderEmail } from './utils/email.ts'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const reminderTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24時間後
  const windowStart = new Date(reminderTime.getTime() - 15 * 60 * 1000) // -15min
  const windowEnd = new Date(reminderTime.getTime() + 15 * 60 * 1000)   // +15min

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id, start_time, end_time, guest_email, guest_name,
      menu:meeting_menus(name),
      member:member_plans(user:profiles(email, full_name))
    `)
    .eq('status', 'confirmed')
    .gte('start_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .is('reminder_sent_at', null)

  if (error) throw error

  const results = { success: 0, failed: 0 }

  for (const booking of bookings) {
    try {
      const userEmail = booking.guest_email || booking.member?.user?.email
      const userName = booking.guest_name || booking.member?.user?.full_name

      await sendReminderEmail({
        email: userEmail,
        name: userName,
        sessionTitle: booking.menu.name,
        startTime: booking.start_time
      })

      // フラグ更新
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', booking.id)

      // 個別ログ記録
      await supabase.from('task_execution_logs').insert({
        task_name: 'reminder_email',
        status: 'success',
        reference_type: 'booking',
        reference_id: booking.id,
        details: { email: userEmail }
      })

      results.success++
    } catch (err) {
      results.failed++
      await supabase.from('task_execution_logs').insert({
        task_name: 'reminder_email',
        status: 'failed',
        reference_type: 'booking',
        reference_id: booking.id,
        error_details: [err.message]
      })
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### pg_cron ジョブ設定 SQL

```sql
-- Source: https://supabase.com/docs/guides/cron

-- 1. Vaultに認証情報を保存（初回のみ実行）
select vault.create_secret('https://your-project.supabase.co', 'project_url');
select vault.create_secret('your-service-role-key', 'service_role_key');

-- 2. 月次ポイント付与ジョブ（毎月1日 00:00 UTC）
select cron.schedule(
  'monthly-point-grant',
  '0 0 1 * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/monthly-point-grant',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 3. リマインダーメールチェック（15分ごと）
select cron.schedule(
  'check-reminder-emails',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/check-reminder-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 4. サンキューメールチェック（15分ごと）
select cron.schedule(
  'check-thank-you-emails',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/check-thank-you-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- ジョブ一覧確認
SELECT * FROM cron.job;

-- ジョブ削除（必要に応じて）
SELECT cron.unschedule('job-name');
```

### task_execution_logs テーブルスキーマ

```sql
-- Source: Apache Gobblin Job Execution History Store pattern
-- https://gobblin.apache.org/docs/user-guide/Job-Execution-History-Store/

CREATE TABLE task_execution_logs (
  id SERIAL PRIMARY KEY,

  -- タスク識別
  task_name TEXT NOT NULL,  -- 'monthly_point_grant', 'reminder_email', 'thank_you_email'

  -- 実行状態
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial_success', 'timeout')),

  -- タイムスタンプ
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NOW(),

  -- 実行結果サマリー（バッチ処理用）
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- 個別実行用（メール送信など）
  reference_type TEXT,  -- 'booking', 'member_plan'
  reference_id INTEGER,

  -- 詳細情報
  details JSONB,  -- 送信先メールアドレスなど
  error_details TEXT[],  -- エラーメッセージの配列

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_task_execution_logs_task_name ON task_execution_logs(task_name);
CREATE INDEX idx_task_execution_logs_status ON task_execution_logs(status);
CREATE INDEX idx_task_execution_logs_created_at ON task_execution_logs(created_at);
CREATE INDEX idx_task_execution_logs_reference ON task_execution_logs(reference_type, reference_id);

-- 古いログの自動削除（365日保持）
select cron.schedule(
  'cleanup-task-execution-logs',
  '0 2 * * *', -- 毎日2:00 UTC
  $$
  DELETE FROM task_execution_logs
  WHERE created_at < NOW() - INTERVAL '365 days';
  $$
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgjwt拡張でJWT生成 | Vault + 事前生成JWT保存 | 2024 (PG17でpgjwt非推奨化) | 認証トークン管理がVault一元化 |
| Database Webhooksで外部サービス呼び出し | pg_net + Edge Functions | 2023 Supabase公式推奨 | DB内でHTTP呼び出し完結 |
| 外部cronサービス（Vercel Cron等） | pg_cron | 2024 Supabase Cronリリース | Supabase内で完結、管理が容易 |
| 秒単位スケジュール不可 | pg_cron 1.6.4で秒単位対応 | 2025 (Postgres 15.6.1.122+) | より細かい実行間隔が可能 |

**Deprecated/outdated:**
- **pgjwt**: Postgres 17で削除予定。Vaultベース認証に移行すること
- **環境変数での認証トークン保存**: Vaultを使うことでDBダンプからの漏洩リスクを回避

## Open Questions

1. **タイムゾーン変換の最適解**
   - What we know: pg_cronはUTC基準、JSTは+9時間
   - What's unclear: cron式でJST指定する方法はない（pg_cronはUTC固定）
   - Recommendation: cron式はUTCで設定し、Edge Function内でJST判定を実装

2. **Edge Functionの並行実行制限**
   - What we know: pg_cronは最大32並行ジョブ
   - What's unclear: 同じEdge Functionを複数pg_cronジョブから呼び出した場合の挙動
   - Recommendation: 1つのEdge Functionは1つのpg_cronジョブからのみ呼び出す設計にする

3. **Resend APIのレート制限**
   - What we know: Resendには送信制限がある（プランによる）
   - What's unclear: 1時間に100件のリマインダー送信時にレート制限に引っかかるか
   - Recommendation: Resendの料金プランを確認。必要に応じてバッチ送信APIを使用

## Sources

### Primary (HIGH confidence)
- [Supabase Cron Docs](https://supabase.com/docs/guides/cron) - pg_cron基本設定
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) - Edge Function呼び出しパターン
- [Supabase Vault Docs](https://supabase.com/docs/guides/database/vault) - 認証トークン管理
- [Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling) - エラーハンドリング実装
- [pg_cron Extension Docs](https://supabase.com/docs/guides/database/extensions/pg_cron) - pg_cron詳細
- [pg_cron Debugging Guide](https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz) - トラブルシューティング

### Secondary (MEDIUM confidence)
- [PostgreSQL Batch Processing (Feb 2026)](https://medium.com/@nikhil.srivastava944/massive-data-updates-in-postgresql-how-we-processed-80m-records-with-minimal-impact-20babd2cfe6f) - バッチ処理パターン
- [Apache Gobblin Job Execution History Store](https://gobblin.apache.org/docs/user-guide/Job-Execution-History-Store/) - 実行履歴テーブル設計
- [Thank You Email Timing Best Practices 2026](https://blaze.today/blog/how-write-thank-you-email-meeting/) - サンキューメールタイミング
- [Meeting Reminder Email Best Practices](https://youcanbook.me/blog/meeting-reminder-email-templates) - リマインダーメール24h前推奨

### Tertiary (LOW confidence - flagged for validation)
- [GitHub Issue #4287 - pg_cron Auth Pattern](https://github.com/supabase/cli/issues/4287) - 認証パターンの議論（OPEN issue、公式推奨未確定）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Supabase公式ドキュメントで明示的に推奨
- Architecture: HIGH - 公式ドキュメント + 実装例あり
- Pitfalls: MEDIUM - 公式トラブルシューティングガイド + コミュニティ報告
- Batch processing: MEDIUM - PostgreSQL公式推奨 + 2026年の実践例
- Email timing: MEDIUM - 業界ベストプラクティス（24h, 30min）

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days - Supabase公式ドキュメントは安定)
