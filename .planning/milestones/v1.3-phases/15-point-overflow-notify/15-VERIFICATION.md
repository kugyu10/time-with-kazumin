---
phase: 15-point-overflow-notify
verified: 2026-03-29T00:50:00Z
status: gaps_found
score: 7/8 must-haves verified
gaps:
  - truth: "管理画面タスクフィルタに ポイント溢れ通知 が選択肢として表示される"
    status: partial
    reason: "tasks-client.tsx のフィルタ選択肢には追加済みだが、同ディレクトリの columns.tsx の taskNameLabels Record<TaskName, string> に point_overflow_notify キーが未追加。TaskName 型拡張後に tsc --noEmit が TS2741 エラーで失敗する。"
    artifacts:
      - path: "src/app/admin/tasks/columns.tsx"
        issue: "taskNameLabels: Record<TaskName, string> に point_overflow_notify エントリが存在しない。L11-15 で monthly_point_grant / reminder_email / thank_you_email の3キーのみ定義されており、TaskName 型の第4メンバーが欠落している。"
    missing:
      - "src/app/admin/tasks/columns.tsx の taskNameLabels に { point_overflow_notify: 'ポイント溢れ通知' } を追加する"
---

# Phase 15: ポイント溢れ通知 Verification Report

**Phase Goal:** ポイントが翌月付与でmax_pointsを超える予定の会員に対し、毎月20日に自動でリマインダーメールが届く
**Verified:** 2026-03-29T00:50:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | task_execution_logs の CHECK 制約に point_overflow_notify が含まれている | VERIFIED | migration L18-23: CHECK (task_name IN (..., 'point_overflow_notify')) |
| 2 | TaskName 型に point_overflow_notify が含まれている | VERIFIED | tasks.ts L8: "monthly_point_grant" \| "reminder_email" \| "thank_you_email" \| "point_overflow_notify" |
| 3 | 管理画面タスクフィルタに ポイント溢れ通知 が選択肢として表示される | FAILED | tasks-client.tsx L24 に追加済みだが columns.tsx L11-15 の taskNameLabels が未更新 → tsc TS2741 エラー |
| 4 | PointOverflowEmail.tsx テンプレートファイルが存在し編集可能 | VERIFIED | 132行, 全 props 実装済み, export default あり |
| 5 | Edge Function が溢れ予定会員を正しく検出する (current_points + monthly_points > max_points) | VERIFIED | index.ts L123: (m) => m.current_points + m.monthly_points > m.plan.max_points |
| 6 | メール本文に現在ポイント・月次付与ポイント・上限・溢れ量が記載されている | VERIFIED | renderPointOverflowHtml L265-275: 4項目すべてインライン HTML に含まれる |
| 7 | 同月に複数回実行しても2回目はスキップされる（冪等性） | VERIFIED | index.ts L60-97: task_execution_logs ベースで当月分 point_overflow_notify を確認、existingLog があればスキップ |
| 8 | task_execution_logs に送信件数（success_count, failed_count）が記録される | VERIFIED | index.ts L184-194: success_count, failed_count, total_count を INSERT |

**Score:** 7/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260329000001_point_overflow_notify.sql` | CHECK制約拡張 + pg_cronジョブ定義 | VERIFIED | 47行, DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT パターン, pg_cron コメントアウト (0 0 20 * *) |
| `src/emails/PointOverflowEmail.tsx` | React Email テンプレート | VERIFIED | 132行, PointOverflowEmailProps (userName/currentPoints/monthlyPoints/maxPoints/overflow/bookingUrl), Layout ラップ, export default PointOverflowEmail |
| `src/lib/actions/admin/tasks.ts` | TaskName 型拡張 | VERIFIED | L8: "point_overflow_notify" 追加済み |
| `src/app/admin/tasks/tasks-client.tsx` | フィルタUI拡張 | VERIFIED | L24: { value: "point_overflow_notify", label: "ポイント溢れ通知" } 追加済み |
| `supabase/functions/point-overflow-notify/index.ts` | ポイント溢れ通知 Edge Function | VERIFIED | 338行 (min 150), 冪等性チェック + 溢れ判定 + sendEmailWithRetry + task_execution_logs 記録 |
| `src/app/admin/tasks/columns.tsx` | TaskName ラベルマップ更新 (暗黙の依存) | STUB | taskNameLabels に point_overflow_notify キー欠落 → tsc TS2741 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| migration SQL | task_execution_logs | CHECK constraint ALTER | WIRED | DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT に 'point_overflow_notify' 含む |
| tasks.ts | tasks-client.tsx | TaskName type import | WIRED | tasks-client.tsx L13: import type { TaskLog, TaskName, TaskStatus } from "@/lib/actions/admin/tasks" |
| tasks.ts | columns.tsx | TaskName type import | BROKEN | columns.tsx L9 でインポート済みだが taskNameLabels が Record<TaskName, string> を満たさない → TS2741 |
| point-overflow-notify/index.ts | task_execution_logs | supabase.from('task_execution_logs').insert | WIRED | L77, L128, L184, L209 で複数パスへ記録 |
| point-overflow-notify/index.ts | member_plans JOIN plans | supabase.from('member_plans').select | WIRED | L101-115: profiles と plans を inner join, max_points IS NOT NULL フィルタ |
| point-overflow-notify/index.ts | Resend API | fetch('https://api.resend.com/emails') | WIRED | sendEmailWithRetry L309: fetch('https://api.resend.com/emails') |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| point-overflow-notify/index.ts | targets (溢れ対象会員) | member_plans + profiles + plans JOIN (L101-115) → アプリ層フィルタ (L122-124) | Yes — DB query + JS filter | FLOWING |
| point-overflow-notify/index.ts | renderPointOverflowHtml output | member.current_points, monthly_points, plan.max_points from DB | Yes — DB values passed through | FLOWING |
| tasks-client.tsx | filteredLogs | initialLogs props → useState (L35) → filter (L40-48) | Yes — server action getTaskLogs → DB query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — Edge Function は Deno/Supabase runtime が必要であり、ローカルで単体実行できない。TypeScript コンパイルチェックを代替として実施。

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compile (全体) | tsc --noEmit | TS2741: columns.tsx L11 'point_overflow_notify' missing in taskNameLabels | FAIL |
| migration SQL に CHECK 制約あり | grep point_overflow_notify migration SQL | FOUND | PASS |
| Edge Function に溢れ判定あり | grep "current_points.*monthly_points.*max_points" index.ts | L123 FOUND | PASS |
| Edge Function に冪等性チェックあり | grep "task_execution_logs.*point_overflow_notify" index.ts | L63 FOUND | PASS |
| Resend fetch あり | grep "api.resend.com" index.ts | L309 FOUND | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| POINT-01 | Plan 02 | 毎月20日に、翌月ポイント付与でmax_pointsを超える会員全員にリマインダーメールを送信する | SATISFIED | Edge Function: pg_cron (0 0 20 * *) + overflow filter (L122-124) + sendEmailWithRetry |
| POINT-02 | Plan 01 | メール文面は管理者が編集可能なテンプレートファイルで管理する | SATISFIED | src/emails/PointOverflowEmail.tsx が React Email ファイルとして存在、export default あり |
| POINT-03 | Plan 02 | メールに現在ポイント・月次付与ポイント・上限・溢れ量を記載する | SATISFIED | renderPointOverflowHtml L265-275: 4項目すべてインライン HTML に含まれる |
| POINT-04 | Plan 01 + 02 | 送信履歴をtask_execution_logsに記録し、冪等性を担保する | SATISFIED | Plan 01: CHECK 制約拡張 / Plan 02: task_execution_logs ベース冪等性 + INSERT (L184-194) |
| POINT-05 | Plan 01 | 管理画面のタスク実行履歴でポイント溢れ通知の実行状況を確認できる | PARTIAL | tasks-client.tsx フィルタ追加済み、TaskName 型追加済み。ただし columns.tsx 未更新により tsc エラー → ビルド失敗リスク |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/admin/tasks/columns.tsx` | 11-15 | Record<TaskName, string> に point_overflow_notify キー欠落 | BLOCKER | tsc --noEmit TS2741 エラー。Next.js ビルドが失敗する。実行時は ?? フォールバックで "point_overflow_notify" がそのまま表示されるが、型安全性が破壊されている。 |

---

### Human Verification Required

#### 1. pg_cron ジョブ本番有効化の確認

**Test:** Supabase Dashboard > Database > Extensions で pg_cron が有効か確認。マイグレーション内のコメントアウトされた cron.schedule を本番環境で uncomment して実行する。
**Expected:** 毎月20日 UTC 00:00 に Edge Function が自動実行される
**Why human:** Supabase Dashboard への実際のアクセスが必要。ローカルでは確認不可。

#### 2. Resend メール実際の送信確認

**Test:** テスト環境で Edge Function を HTTP POST で呼び出し、ポイント溢れ対象会員がいる状態で実行する。
**Expected:** 溢れ対象会員のメールアドレスにリマインダーメールが届く。件名「【かずみん時間】ポイントがもったいないです！」
**Why human:** Resend API キーと実際のメールアドレスが必要。外部サービスとの連携確認。

#### 3. PointOverflowEmail.tsx テンプレートのメールクライアント表示確認

**Test:** `npx react-email dev` でプレビューを確認するか、実際にメールを受信してブランドカラー（オレンジ #f97316 CTA ボタン）と日本語レイアウトを目視確認する。
**Expected:** 見出し「{userName}さん、ポイントがもったいないです!」+ 4項目詳細 + オレンジCTAボタン + フッター
**Why human:** メールクライアントごとの CSS 互換性を目視でしか確認できない。

---

### Gaps Summary

Phase 15 は8つの must-have のうち7つが実装済みで、コア機能（Edge Function、メールテンプレート、DB 制約、冪等性）はすべて正しく実装されている。

唯一のギャップは `src/app/admin/tasks/columns.tsx` の見落としで、`TaskName` 型が `point_overflow_notify` を含む形に拡張されたにもかかわらず、同ファイルの `taskNameLabels: Record<TaskName, string>` オブジェクトにそのキーが追加されていない。これにより `tsc --noEmit` が TS2741 エラーで失敗し、Next.js の本番ビルドが通らなくなる可能性がある。

修正は1行追加のみ:
```typescript
// src/app/admin/tasks/columns.tsx L14 に追加
  point_overflow_notify: "ポイント溢れ通知",
```

このギャップを修正すれば、フェーズゴール「毎月20日に自動リマインダーメールが届く」を達成するすべての要素が揃う。

---

_Verified: 2026-03-29T00:50:00Z_
_Verifier: Claude (gsd-verifier)_
