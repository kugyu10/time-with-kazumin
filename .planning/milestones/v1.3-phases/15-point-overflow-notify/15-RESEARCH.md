# Phase 15: ポイント溢れ通知メール - Research

**Researched:** 2026-03-29
**Domain:** Supabase Edge Function + pg_cron + Resend メール送信 + React Email
**Confidence:** HIGH

## Summary

Phase 15 は「毎月20日に溢れ予定会員へリマインダーメール自動送信」を実現する。技術的には
既存の `monthly-point-grant` / `check-reminder-emails` Edge Function パターンが確立済みであり、
新たに調査すべき未知領域はほぼない。本フェーズは **既存パターンの適用** が主体。

実装の核心は3点に絞られる: (1) Edge Function 内の冪等性チェックを `task_execution_logs` ベースで行う、
(2) `task_execution_logs.task_name` CHECK 制約をマイグレーションで拡張する、(3) `TaskName` 型を
TypeScript 側でも拡張する。React Email テンプレートはファイルベースで管理するが、Edge Function 内
ではインライン HTML（`check-reminder-emails` と同様）を採用することに注意する。

**Primary recommendation:** `monthly-point-grant` パターン（冪等性 + task_execution_logs + リトライ）を
そのまま踏襲し、メール送信部は `check-reminder-emails` のインライン HTML 方式を採用する。

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### メール文面・トーン
- **D-01:** やさしいリマインダートーン。「ポイントがもったいないです！予約して使ってくださいね」のように友だち感覚で伝える。ブランド方針（パッと気分が明るくなる、あたたかい雰囲気）に準拠。
- **D-02:** メールに予約ページへの CTA リンクを含める。「今すぐ予約する」ボタンで予約画面へ誘導。
- **D-03:** メール本文に以下を記載: 現在ポイント、月次付与ポイント、上限（max_points）、溢れ量（overflow = current + monthly - max）。
- **D-04:** メールテンプレートは React Email ファイルベース管理（PROJECT.md 既定方針）。

#### 溢れ判定ロジック
- **D-05:** 単純判定: `current_points + monthly_points > max_points` で判定する。予約済み（将来消費予定）ポイントは考慮しない。
- **D-06:** 溢れ量の計算: `overflow = current_points + monthly_points - max_points`。

#### バッチ実行
- **D-07:** Edge Function `point-overflow-notify` を `monthly-point-grant` パターンで実装する（冪等性チェック + task_execution_logs 記録 + リトライロジック）。
- **D-08:** pg_cron スケジュール: UTC `0 0 20 * *` = JST 20日09:00（STATE.md 既定方針）。
- **D-09:** 冪等性: `task_execution_logs` に当月分の `point_overflow_notify` が既に存在する場合はスキップ。

#### 管理画面
- **D-10:** `TaskName` 型に `"point_overflow_notify"` を追加する。既存の `admin/tasks` 画面のフィルタ・UI をそのまま利用。
- **D-11:** task_execution_logs にメール送信件数（success_count）と失敗件数（failed_count）を記録する。

### Claude's Discretion
- React Email テンプレートの具体的なレイアウト・スタイリング
- Edge Function のリトライ回数・タイミング
- 溢れ対象会員の取得クエリの具体的な構文（SQL または Supabase クエリ）
- メールの件名の具体的な文言

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POINT-01 | 毎月20日に、翌月ポイント付与でmax_pointsを超える会員全員にリマインダーメールを送信する | pg_cron `0 0 20 * *` + Edge Function の組み合わせで実現。`check-reminder-emails` パターン確立済み |
| POINT-02 | メール文面は管理者が編集可能なテンプレートファイルで管理する | `src/emails/PointOverflowEmail.tsx` として React Email テンプレートを作成。ファイルを直接編集可能 |
| POINT-03 | メールに現在ポイント・月次付与ポイント・上限・溢れ量を記載する | D-03/D-06 決定済み。member_plans JOIN plans でデータ取得 |
| POINT-04 | 送信履歴を task_execution_logs に記録し、冪等性を担保する | D-07/D-09 決定済み。`monthly-point-grant` パターン踏襲 |
| POINT-05 | 管理画面のタスク実行履歴でポイント溢れ通知の実行状況を確認できる | D-10 決定済み。TaskName 型に追加のみ（UI 変更不要） |

</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Edge Functions (Deno) | 既存 | バッチ処理ランタイム | プロジェクト既定 |
| pg_cron | 既存 (pg extension) | 定期実行スケジューラ | Phase 6 から確立済み |
| pg_net | 既存 (pg extension) | pg_cron → Edge Function HTTP 呼び出し | Phase 6 から確立済み |
| Resend API | 直接 fetch（SDK なし） | メール送信 | Deno 環境で SDK 使用不可のため fetch API を使用 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-email/components | 既存 | React Email テンプレート | `src/emails/` の管理画面プレビュー用テンプレートのみ |
| @react-email/render | 既存 | React → HTML 変換 | Next.js 側（管理画面プレビューがあれば）のみ |
| jsr:@supabase/supabase-js@2 | 既存 | Edge Function 内 DB クライアント | すべての Edge Function |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| インライン HTML | React Email render in Deno | Deno で React Email を使う場合 npm: prefix 指定が必要で複雑。check-reminder-emails は既にインライン HTML を採用済みのため踏襲する |
| task_execution_logs ベース冪等性 | 専用テーブル | monthly-point-grant は point_transactions ベース。point-overflow-notify はログベースが D-09 で確定済み |

---

## Architecture Patterns

### 実装ファイル構成
```
supabase/
  functions/
    point-overflow-notify/
      index.ts                    # 新規 Edge Function
  migrations/
    YYYYMMDD_point_overflow_notify_cron.sql  # 新規（CHECK制約拡張 + pg_cron）

src/
  emails/
    PointOverflowEmail.tsx        # 新規 React Email テンプレート（ファイル管理用）
  lib/
    actions/
      admin/
        tasks.ts                  # TaskName 型に "point_overflow_notify" 追加
  app/
    admin/
      tasks/
        tasks-client.tsx          # taskNameOptions に "ポイント溢れ通知" 追加
```

### Pattern 1: 冪等性チェック（task_execution_logs ベース）

**What:** Edge Function 実行時に当月分のログが既に存在するかチェックし、存在すれば処理をスキップする。
**When to use:** `point-overflow-notify` の冪等性保証（D-09）

```typescript
// Source: 15-CONTEXT.md D-09 + monthly-point-grant パターン
const now = new Date()
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const { data: existingLog } = await supabase
  .from('task_execution_logs')
  .select('id')
  .eq('task_name', 'point_overflow_notify')
  .gte('started_at', `${currentMonth}-01T00:00:00Z`)
  .lt('started_at', `${currentMonth}-31T23:59:59Z`)
  .limit(1)
  .single()

if (existingLog) {
  // スキップ処理 + ログ記録
}
```

### Pattern 2: 溢れ対象会員の取得クエリ

**What:** アクティブな会員で `current_points + monthly_points > max_points` を満たす全員を取得。
**When to use:** メール送信対象者リストアップ

```typescript
// Source: 15-CONTEXT.md <specifics> + 初期スキーマ確認
const { data: overflowMembers } = await supabase
  .from('member_plans')
  .select(`
    id,
    current_points,
    monthly_points,
    user:profiles!inner (
      email,
      full_name
    ),
    plan:plans!inner (
      max_points
    )
  `)
  .eq('status', 'active')
  .not('plan.max_points', 'is', null)  // max_points が NULL（無制限）は除外

// アプリ層でフィルタ（current_points + monthly_points > max_points）
const targets = (overflowMembers ?? []).filter(
  m => m.current_points + m.monthly_points > m.plan.max_points
)
```

**注意:** Supabase の `.filter()` で計算式フィルタを直接書けないため、アプリ層でフィルタする。

### Pattern 3: メール送信ループ（check-reminder-emails パターン踏襲）

**What:** 対象者ごとにメール送信し、成功/失敗をカウントして最終的に task_execution_logs に記録。
**When to use:** 複数会員への一括メール送信

```typescript
// Source: supabase/functions/check-reminder-emails/index.ts パターン
let successCount = 0
let failedCount = 0
const errors: Array<{ member_plan_id: number; error: string }> = []

for (const member of targets) {
  try {
    const overflow = member.current_points + member.monthly_points - member.plan.max_points
    await sendEmailWithRetry(
      resendApiKey,
      fromEmail,
      member.user.email,
      `【かずみん時間】ポイントがもったいないです！`,
      renderPointOverflowHtml({ ... })
    )
    successCount++
  } catch (error) {
    failedCount++
    errors.push({ member_plan_id: member.id, error: String(error) })
  }
}
```

### Pattern 4: task_execution_logs CHECK 制約の拡張マイグレーション

**What:** 既存の CHECK 制約を DROP → 再 ADD で `point_overflow_notify` を追加。
**When to use:** 新しい task_name 追加時の標準手順

```sql
-- Source: supabase/migrations/20260223000001_automation_tasks.sql 参照
ALTER TABLE task_execution_logs
  DROP CONSTRAINT IF EXISTS task_execution_logs_task_name_check;

ALTER TABLE task_execution_logs
  ADD CONSTRAINT task_execution_logs_task_name_check
  CHECK (task_name IN (
    'monthly_point_grant',
    'reminder_email',
    'thank_you_email',
    'point_overflow_notify'
  ));
```

### Anti-Patterns to Avoid

- **RPC を使う:** `monthly-point-grant` は `grant_monthly_points` RPC を使うが、今回はクエリ + メール送信のためRPC不要。Edge Function 内で直接 Supabase クライアントクエリを実行する。
- **React Email を Deno からインポートする:** Deno 環境での npm パッケージは `npm:` prefix が必要で複雑。`check-reminder-emails` 同様にインライン HTML 文字列を返す関数を定義する。
- **Resend SDK を Deno で使う:** `check-reminder-emails` の実装を確認した結果、Edge Function では `fetch('https://api.resend.com/emails', ...)` で直接呼ぶパターンを使用している。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| メール送信リトライ | カスタムリトライロジック | `sendEmailWithRetry()` を `check-reminder-emails` から踏襲 | 3回リトライ、エラーハンドリング込みの実装が確立済み |
| 冪等性チェック | 独自フラグ管理 | `task_execution_logs` 当月レコード確認（D-09） | 既存パターンと統一、管理画面で見える |
| pg_cron 設定 | 独自スケジューラ | Supabase Vault + pg_net + pg_cron | Phase 6 から確立済み |

---

## Common Pitfalls

### Pitfall 1: task_execution_logs の CHECK 制約違反
**What goes wrong:** マイグレーションで CHECK 制約を拡張せず Edge Function をデプロイすると、`task_name = 'point_overflow_notify'` の INSERT が PostgreSQL CHECK 制約エラーで失敗する。
**Why it happens:** `automation_tasks.sql` の CHECK 制約に `'point_overflow_notify'` が含まれていない。
**How to avoid:** マイグレーションファイルで必ず CHECK 制約を DROP → 再 ADD する。
**Warning signs:** Edge Function のエラーログに `violates check constraint` が出る。

### Pitfall 2: max_points が NULL の会員への誤送信
**What goes wrong:** `plans.max_points` が NULL（無制限プラン）の会員に対して溢れ判定を誤実行し、NULL + anything が TRUE と評価されてメールが送信される。
**Why it happens:** PostgreSQL では `NULL > X` は NULL（falsy）だが、JavaScript では `null + n > null` が `NaN > null = false` となり除外される。ただし JOIN 後の型変換で意図しない動作になる可能性がある。
**How to avoid:** `.not('plan.max_points', 'is', null)` でクエリ段階で除外する（アプリ層フィルタの前に）。
**Warning signs:** max_points が NULL のプランに所属する会員にメールが届く。

### Pitfall 3: TaskName 型と SQL 制約の不一致
**What goes wrong:** `tasks.ts` の `TaskName` 型を更新しても、SQL の CHECK 制約を更新し忘れると本番で INSERT エラーが発生する。逆に SQL を更新しても TypeScript 型を更新し忘れると型エラーになる。
**Why it happens:** 2箇所に同じ列挙値を管理している。
**How to avoid:** マイグレーションと TypeScript 型変更を同一プランで実施し、片方だけ変更されないよう管理する。
**Warning signs:** TypeScript コンパイルエラー または 実行時 INSERT エラー。

### Pitfall 4: 冪等性チェックの日付範囲
**What goes wrong:** `currentMonth-31T23:59:59Z` という日付範囲は月によって日数が異なるため、31日未満の月でも動作はするが「31日」が存在しない月でもクエリは通る（PostgreSQL が丸める）。
**Why it happens:** `monthly-point-grant` の既存実装をそのまま踏襲した場合。
**How to avoid:** 翌月1日の前日を終了条件にすることで確実に動作させる。ただし既存パターンは実運用で問題が出ていないため、同じパターンで踏襲して問題ない。
**Warning signs:** 月末実行時に冪等性チェックをスキップしてしまう（理論上のみ）。

---

## Code Examples

### pg_cron マイグレーションのパターン
```sql
-- Source: supabase/migrations/20260223000001_automation_tasks.sql のコメントアウトパターン

-- 毎月20日 00:00 UTC にポイント溢れ通知
-- SELECT cron.schedule(
--     'point-overflow-notify',
--     '0 0 20 * *',
--     $$
--     SELECT
--         net.http_post(
--             url:=vault.get_secret('edge_function_url') || '/point-overflow-notify',
--             headers:=jsonb_build_object('Authorization', 'Bearer ' || vault.get_secret('edge_function_anon_key')),
--             body:='{}'::jsonb
--         ) as request_id;
--     $$
-- );
```

### PointOverflowEmail テンプレートの props 設計
```typescript
// Source: src/emails/BookingConfirmation.tsx のパターンを踏襲
export interface PointOverflowEmailProps {
  userName: string
  currentPoints: number
  monthlyPoints: number
  maxPoints: number
  overflow: number          // = currentPoints + monthlyPoints - maxPoints
  bookingUrl: string        // 予約ページへの CTA リンク（D-02）
}
```

### sendEmailWithRetry 関数（check-reminder-emails から踏襲）
```typescript
// Source: supabase/functions/check-reminder-emails/index.ts L341-380
async function sendEmailWithRetry(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (response.ok) return
    if (attempt === maxRetries) throw new Error(`Resend API error: ${response.status}`)
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resend SDK in Deno | fetch 直接呼び出し | Phase 6 確立 | SDK の Deno 互換性問題を回避 |
| 冪等性: 専用フラグカラム | task_execution_logs ベース | Phase 6 確立 | ログと冪等性を一元管理 |

---

## Open Questions

1. **溢れ対象クエリのパフォーマンス**
   - What we know: `member_plans` に active な会員が数名〜数十名規模と推定。
   - What's unclear: アプリ層フィルタが問題になるような規模かは不明。
   - Recommendation: 現状規模では問題なし。将来的に大規模になる場合は Supabase RPC で SQL 計算式フィルタを実装する。

2. **React Email テンプレートの Edge Function での利用**
   - What we know: `src/emails/PointOverflowEmail.tsx` を作成するが、Edge Function では直接インポートできない（Deno 環境の制約）。
   - What's unclear: テンプレートを変更した場合、Edge Function のインライン HTML も手動で更新する必要があるかどうか。
   - Recommendation: POINT-02「管理者が編集可能」の要件は「`src/emails/` ファイルを編集してデプロイ」で満たす。Edge Function 側のインライン HTML と src/emails テンプレートが二重管理にならないよう、Edge Function 内の HTML を「ファイルベース管理の正」と明示するコメントを追加する。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Edge Functions (Deno) | POINT-01/04 | ✓ | 既存 | — |
| pg_cron extension | POINT-01 | ✓ | 既存 (automation_tasks.sql で有効化済み) | — |
| pg_net extension | POINT-01 | ✓ | 既存 (automation_tasks.sql で有効化済み) | — |
| Resend API Key (RESEND_API_KEY) | POINT-01/03 | ✓ | 設定済み (check-reminder-emails 動作中) | — |
| Supabase Vault (edge_function_url, edge_function_anon_key) | POINT-01 | ✓ (推定) | 既存 pg_cron ジョブのパターンから確認 | — |

**Missing dependencies with no fallback:** なし

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (既存 zoom.test.ts から確認) |
| Config file | vitest.config.ts (推定、既存テストから確認) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POINT-01 | pg_cron が20日に Edge Function を呼ぶ | manual | — | — (Supabase pg_cron のテストは自動化困難) |
| POINT-02 | テンプレートが編集可能なファイルとして存在する | smoke | ファイル存在確認 | ❌ Wave 0 |
| POINT-03 | メール HTML にポイント情報が含まれる | unit | `pnpm test src/emails/PointOverflowEmail.test.tsx` | ❌ Wave 0 |
| POINT-04 | 同月2回実行でもログが1件のみ増える | integration | — (Edge Function 統合テスト) | ❌ Wave 0 |
| POINT-05 | 管理画面フィルタに "ポイント溢れ通知" が表示される | smoke | — (UI 手動確認) | — |

### Wave 0 Gaps
- [ ] `src/emails/PointOverflowEmail.test.tsx` — POINT-03: テンプレートに必要なデータが含まれるか検証
- [ ] 上記テンプレートは React Email テスト環境が必要（既存 BookingConfirmation テストがあれば流用可能）

*(既存テストインフラが vitest で構築済みのため、テンプレート単体テストの追加のみが Wave 0 ギャップ)*

---

## Sources

### Primary (HIGH confidence)
- `supabase/functions/monthly-point-grant/index.ts` — 冪等性チェック + task_execution_logs パターン（直接コード確認）
- `supabase/functions/check-reminder-emails/index.ts` — メール送信ループ + sendEmailWithRetry + インライン HTML（直接コード確認）
- `supabase/migrations/20260223000001_automation_tasks.sql` — task_execution_logs スキーマ + pg_cron パターン（直接確認）
- `src/lib/actions/admin/tasks.ts` — TaskName 型定義（直接確認）
- `src/app/admin/tasks/tasks-client.tsx` — taskNameOptions パターン（直接確認）
- `src/emails/BookingConfirmation.tsx` + `src/emails/components/Layout.tsx` — React Email テンプレート構造（直接確認）

### Secondary (MEDIUM confidence)
- `.planning/phases/15-point-overflow-notify/15-CONTEXT.md` — ユーザーの決定事項（D-01〜D-11）
- `.planning/STATE.md` — pg_cron UTC 方針（JST 20日09:00 = UTC `0 0 20 * *`）

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — すべて既存プロジェクトで稼働中のパターン
- Architecture: HIGH — monthly-point-grant / check-reminder-emails を直接確認済み
- Pitfalls: HIGH — DBスキーマと実装コードを直接確認した上で特定

**Research date:** 2026-03-29
**Valid until:** 2026-04-30（安定したスタック、1ヶ月有効）
