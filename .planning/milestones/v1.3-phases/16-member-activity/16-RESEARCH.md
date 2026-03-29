# Phase 16: 会員アクティビティ表示 - Research

**Researched:** 2026-03-29
**Domain:** Next.js 15 管理画面UI + Supabase集計クエリ + TanStack Table v8 行スタイリング
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 会員一覧テーブルの行背景色で表現する。30日以上未訪問 = 黄色（淡い背景）、60日以上未訪問 = 赤（淡い背景）。
- **D-02:** 会員一覧に「前回セッション」カラムを追加する。「XX日前」形式で直感的に表示。
- **D-03:** 管理ダッシュボード下部にフォロー必要会員をシンプルテーブル形式で表示する。
- **D-04:** テーブルには名前・プラン・前回セッション日時を表示。黄色セクション（30日〜60日）と赤セクション（60日超）に分けて表示。
- **D-05:** 最終セッション日は `bookings` テーブルで `status = 'completed'` の予約の `max(end_time)` で判定する。
- **D-06:** 「次の予約なし」は `bookings` テーブルで `status = 'confirmed' AND start_time > now()` の予約が0件かどうかで判定する。
- **D-07:** フォロー対象の条件: (最終セッション日から30日以上経過 OR セッション実績なし) AND (将来のconfirmed予約なし) AND (member_plans.status = 'active')。退会済み会員は対象外。

### Claude's Discretion

- 黄色/赤の具体的なCSS色コード（shadcn/uiテーマとの調和）
- 「前回セッション」カラムのソート実装方法
- ダッシュボードのフォローリストの件数上限（全件表示 or ページング）
- セッション実績なし会員の表示方法（「未訪問」ラベル等）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACT-01 | 管理画面の会員一覧で、30日以上来ていない（＆次の予約なし）会員を黄色で表示する | DataTable行スタイリング + getMembers()拡張 |
| ACT-02 | 管理画面の会員一覧で、60日以上来ていない（＆次の予約なし）会員を赤で表示する | 同上（閾値60日） |
| ACT-03 | ダッシュボード下部に、黄色・赤の会員リストを前回セッション日時付きで表示する | getFollowUpMembers() Server Action + FollowUpList Server Component |
</phase_requirements>

---

## Summary

Phase 16は、既存の会員一覧（`src/app/admin/members/`）とダッシュボード（`src/app/admin/dashboard/page.tsx`）に対して、フォロー必要な会員を色分けで表示する機能を追加する。技術的な新規性は低く、既存パターンの拡張で完結できる。

主な作業は3点: (1) `getMembers()` Server ActionにBookings集計を追加してMember型を拡張、(2) DataTableに行背景色制御用の `getRowClassName` props追加 + 「前回セッション」カラム追加、(3) ダッシュボード用の `getFollowUpMembers()` Server ActionとFollowUpListコンポーネント新規作成。

Supabase JSクライアントでの深いネスト集計（profiles → member_plans → bookings）は制約があるため、サブクエリかRPCで実装する。ただしNext.js Server Actionの範囲内でJavaScript集計でも処理可能。

**Primary recommendation:** `getMembers()` を拡張し、bookingsのサブクエリで `last_session_at` と `has_future_booking` を取得して `activity_status` を計算する。DataTableに `getRowClassName` propsを追加して行背景色を動的制御する。

---

## Standard Stack

### Core（既存プロジェクト技術スタック）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.12 | App Router / Server Components | プロジェクト採用済み |
| TanStack Table | 8.21.3 | DataTable管理 | プロジェクト採用済み |
| Tailwind CSS | 4.x | スタイリング | プロジェクト採用済み |
| Supabase JS | プロジェクト既存 | DB集計クエリ | プロジェクト採用済み |
| shadcn/ui | プロジェクト既存 | Card/Badge/Table UI | プロジェクト採用済み |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns / 組み込みDate | — | 日付差分計算 | last_session_daysAgo計算時 |
| lucide-react | 0.575.0 | アイコン | ダッシュボードリスト |

**Installation:** 追加インストール不要。全ライブラリ導入済み。

**日付計算の注意:** date-fnsが既に入っているか確認が必要だが、`Math.floor((Date.now() - new Date(last_session_at).getTime()) / (1000 * 60 * 60 * 24))` で十分。YAGNI原則。

---

## Architecture Patterns

### 推奨プロジェクト構造変更

```
src/
├── app/admin/members/
│   ├── page.tsx              # 変更なし (getMembers呼び出し)
│   ├── members-client.tsx    # DataTable の getRowClassName props追加
│   └── columns.tsx           # 「前回セッション」カラム追加
├── app/admin/dashboard/
│   ├── page.tsx              # getFollowUpMembers() 呼び出し追加、FollowUpList配置
│   └── follow-up-list.tsx    # 新規: フォローリストServer Component
└── lib/actions/admin/
    └── members.ts            # Member型拡張 + getMembers()拡張 + getFollowUpMembers()追加
```

### Pattern 1: Member型拡張パターン

**What:** 既存のMember型に`last_session_at`と`activity_status`を追加する。

**When to use:** 既存のServer Actionを拡張する場合（新規Action不要）。

```typescript
// src/lib/actions/admin/members.ts

export type ActivityStatus = 'normal' | 'yellow' | 'red'

export type Member = {
  id: string
  email: string
  full_name: string | null
  role: "guest" | "member" | "admin"
  created_at: string
  member_plan?: {
    id: number
    plan_id: number
    current_points: number
    status: "active" | "suspended" | "canceled"
    plan: { name: string }
  } | null
  // 追加フィールド
  last_session_at: string | null      // ISO8601 or null (未訪問)
  has_future_booking: boolean         // 将来のconfirmed予約有無
  activity_status: ActivityStatus     // 'normal' | 'yellow' | 'red'
}
```

### Pattern 2: Supabase bookings集計クエリパターン

**What:** profiles一覧取得時に、member_plans経由でbookingsの集計値を同時取得する。

**Why Supabase JSの深いネストを避ける:** `profiles → member_plans → bookings` の3段ネストはSupabase JSのJOINで扱いにくいため、2段階クエリ（profiles取得後、bookings集計を別クエリ）が最もシンプル。

```typescript
// getMembers() 内の拡張パターン

// Step 1: 既存クエリでprofiles取得 (member_plansのidも取得)
const { data: profiles } = await supabase
  .from("profiles")
  .select(`
    id, email, full_name, role, created_at,
    member_plans (
      id, plan_id, current_points, status,
      plans ( name )
    )
  `)
  .eq("role", "member")
  .order("created_at", { ascending: false })

// Step 2: member_plan_idリストでbookings集計を一括取得
const memberPlanIds = (profiles ?? [])
  .map(p => p.member_plans?.[0]?.id)
  .filter(Boolean) as number[]

if (memberPlanIds.length === 0) {
  // 全員活動状況なし
  return profiles.map(p => ({ ...transform(p), last_session_at: null, has_future_booking: false, activity_status: 'normal' as ActivityStatus }))
}

// 最終completedセッション (member_plan_id単位で最新end_time)
const { data: lastSessions } = await supabase
  .from("bookings")
  .select("member_plan_id, end_time")
  .in("member_plan_id", memberPlanIds)
  .eq("status", "completed")
  .order("end_time", { ascending: false })

// 将来のconfirmed予約 (member_plan_id単位)
const now = new Date().toISOString()
const { data: futureBookings } = await supabase
  .from("bookings")
  .select("member_plan_id")
  .in("member_plan_id", memberPlanIds)
  .eq("status", "confirmed")
  .gt("start_time", now)

// JS側で集計
const lastSessionMap = new Map<number, string>()  // member_plan_id -> end_time
for (const row of lastSessions ?? []) {
  if (!lastSessionMap.has(row.member_plan_id)) {
    lastSessionMap.set(row.member_plan_id, row.end_time)
  }
}
const hasFutureBookingSet = new Set((futureBookings ?? []).map(r => r.member_plan_id))
```

**activity_status計算ロジック:**

```typescript
function calcActivityStatus(
  lastSessionAt: string | null,
  hasFutureBooking: boolean
): ActivityStatus {
  if (hasFutureBooking) return 'normal'  // 将来予約あり → フォロー不要

  if (lastSessionAt === null) return 'red'  // セッション実績なし → 赤（D-07: 30日以上と同等扱い）

  const daysAgo = Math.floor(
    (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysAgo >= 60) return 'red'
  if (daysAgo >= 30) return 'yellow'
  return 'normal'
}
```

**注意:** セッション実績なし（`last_session_at === null`）かつ将来予約なしは `'red'` とする（CONTEXT.md D-07: 「セッション実績なし」は30日以上経過と同じフォロー対象）。

### Pattern 3: DataTable行背景色制御パターン

**What:** DataTableに `getRowClassName` propsを追加して行の背景色を動的制御する。

**Why この方法:** TanStack Table v8はcolumns定義内からTableRowのclassNameを制御できない。DataTableコンポーネントにコールバックpropsを追加するのが最もシンプル。

```typescript
// src/components/ui/data-table.tsx の拡張

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  getRowClassName?: (row: Row<TData>) => string  // 追加
}

// TableRowレンダリング部分を変更
<TableRow
  key={row.id}
  data-state={row.getIsSelected() && "selected"}
  className={getRowClassName?.(row)}  // 追加
>
```

**members-client.tsxでの使用:**

```typescript
// src/app/admin/members/members-client.tsx

import type { Member, ActivityStatus } from "@/lib/actions/admin/members"
import type { Row } from "@tanstack/react-table"

function getMemberRowClassName(row: Row<Member>): string {
  const status = row.original.activity_status
  if (status === 'red') return 'bg-red-50 hover:bg-red-100'
  if (status === 'yellow') return 'bg-yellow-50 hover:bg-yellow-100'
  return ''
}

// DataTable呼び出し部分
<DataTable
  columns={columns}
  data={members}
  getRowClassName={getMemberRowClassName}
/>
```

### Pattern 4: 「前回セッション」カラム追加パターン

**What:** columns.tsxに新カラムを追加する。ソートはISO文字列の比較で対応（nullを末尾に）。

```typescript
// src/app/admin/members/columns.tsx に追加

{
  accessorKey: "last_session_at",
  header: ({ column }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      前回セッション
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  ),
  cell: ({ row }) => {
    const lastSessionAt = row.original.last_session_at
    if (!lastSessionAt) return <span className="text-muted-foreground text-sm">未訪問</span>
    const daysAgo = Math.floor(
      (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    return `${daysAgo}日前`
  },
  sortingFn: (rowA, rowB) => {
    const a = rowA.original.last_session_at ?? ""
    const b = rowB.original.last_session_at ?? ""
    return a < b ? -1 : a > b ? 1 : 0
  },
},
```

### Pattern 5: FollowUpListコンポーネントパターン

**What:** ダッシュボード用のServer Componentとして独立させる。

```typescript
// src/app/admin/dashboard/follow-up-list.tsx
// Server Component (async)

import { getFollowUpMembers } from "@/lib/actions/admin/members"
import type { Member } from "@/lib/actions/admin/members"

export async function FollowUpList() {
  const members = await getFollowUpMembers()

  const redMembers = members.filter(m => m.activity_status === 'red')
  const yellowMembers = members.filter(m => m.activity_status === 'yellow')

  // 赤セクション(60日超)を上、黄セクション(30〜60日)を下 (D-04, specifics)
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">フォローが必要な会員</h2>
      {/* 赤セクション */}
      <FollowUpSection
        title="60日以上未訪問"
        members={redMembers}
        colorClass="text-red-600"
        bgClass="bg-red-50"
      />
      {/* 黄色セクション */}
      <FollowUpSection
        title="30〜60日未訪問"
        members={yellowMembers}
        colorClass="text-yellow-700"
        bgClass="bg-yellow-50"
      />
    </div>
  )
}
```

**getFollowUpMembers() Server Action:**

```typescript
// src/lib/actions/admin/members.ts に追加

export async function getFollowUpMembers(): Promise<Member[]> {
  await requireAdmin()
  // getMembers() と同様のクエリだが、activity_status !== 'normal' のみ返す
  // 実装はgetMembers()のロジックを再利用し、フィルタをかける
  const all = await getMembers()
  return all.filter(m =>
    m.member_plan?.status === 'active' &&
    (m.activity_status === 'yellow' || m.activity_status === 'red')
  )
}
```

**注:** DRY原則を守るため、`getMembers()` と `getFollowUpMembers()` でDBクエリロジックを共有する。内部のヘルパー関数 `fetchMembersWithActivity()` に集約してもよい。

### Anti-Patterns to Avoid

- **`getMembers()` と `getFollowUpMembers()` でDBクエリを重複実装する:** DRY違反。共通ロジックを内部ヘルパーに抽出する。
- **DataTableのcolumns定義からTableRowを制御しようとする:** TanStack Tableのアーキテクチャ上、columnsからTableRowのclassNameは制御不可。DataTableにpropsを追加する。
- **Supabase JSで3段ネストJOIN (`profiles→member_plans→bookings`) を無理に実装する:** 複雑なSQLになりデバッグ困難。2段階クエリ + JS集計がシンプル。
- **30日/60日閾値を環境変数や設定値にする:** YAGNI。要件で固定なので定数で十分。
- **ダッシュボードのフォローリストをClient Componentにする:** データフェッチが必要なのでServer Componentが適切。状態管理不要。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 日付差分計算 | カスタム日付ライブラリ | ネイティブDate + Math.floor | 要件はdaysAgo計算のみ、YAGNI |
| 行ソート | カスタムソートアルゴリズム | TanStack Table sortingFn | 既にgetSortedRowModel()が導入済み |
| フォローリストのページング | カスタムページャー | 全件表示（件数が少ない想定） | ダッシュボードは概要表示が目的 |

**Key insight:** このフェーズはUI追加のみ。既存パターン（Server Action + DataTable + Server Component）を拡張するだけで実装できる。

---

## Common Pitfalls

### Pitfall 1: bookingsとmember_plansの結合キー混同

**What goes wrong:** `bookings.member_plan_id` と `profiles.id` を直接結合しようとする。
**Why it happens:** `getMembers()` が `profiles.id` を返すが、bookingsは `member_plan_id` で紐づく。
**How to avoid:** `profiles → member_plans (user_id = profiles.id, id = bookings.member_plan_id)` の2段階結合を意識する。具体的には、Step1でprofilesとmember_plans.idを取得し、Step2でmember_plan_idでbookingsを絞る。
**Warning signs:** 「会員全員のbookingsが0件で返ってくる」「クエリエラー」。

### Pitfall 2: `activity_status` の計算場所

**What goes wrong:** Client Component（members-client.tsx）でactivity_statusを計算しようとする。
**Why it happens:** 見た目の制御をClientでやりたくなる。
**How to avoid:** `activity_status` はServer Action（members.ts）で計算してMember型に含める。ClientはUIの制御のみ（`row.original.activity_status` を参照）。
**Warning signs:** Client Componentに日付計算ロジックが入る。

### Pitfall 3: DataTable の `getRowClassName` 型エラー

**What goes wrong:** `Row<TData>` のimportを忘れてTypeScriptエラーが発生する。
**Why it happens:** TanStack Tableの型をインポートしていない。
**How to avoid:** `import type { Row } from "@tanstack/react-table"` を追加する。DataTablePropsの型定義でも同様。

### Pitfall 4: nullの last_session_at のソート

**What goes wrong:** `last_session_at: null` の行が意図しない位置（先頭）に来る。
**Why it happens:** デフォルトのISO文字列ソートでは `null` → `""` → 最小値として先頭に来る。
**How to avoid:** カスタム `sortingFn` で null を `""` に変換する（文字列比較で最小 = 降順ソート時は末尾）。昇順の際は未訪問が先頭、降順では末尾になる — どちらも直感的に問題ない。

### Pitfall 5: dashboard/page.tsx の非同期化

**What goes wrong:** `AdminDashboard` 関数が現在 `async` でないため、`await getFollowUpMembers()` を直接呼べない。
**Why it happens:** 現在はデータフェッチなしのServer Component。
**How to avoid:** `FollowUpList` を別の `async` Server Componentとして作成し、dashboard/page.tsx からimportしてレンダリングするだけにする。dashboard/page.tsxを `async` にしなくて良い。

---

## Code Examples

### 既存のgetMembers()集計追加の完全パターン

```typescript
// src/lib/actions/admin/members.ts (抜粋)

// activity_status計算ヘルパー
function calcActivityStatus(
  lastSessionAt: string | null,
  hasFutureBooking: boolean
): ActivityStatus {
  if (hasFutureBooking) return 'normal'
  if (lastSessionAt === null) return 'red'  // セッション実績なし = 赤
  const daysAgo = Math.floor(
    (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysAgo >= 60) return 'red'
  if (daysAgo >= 30) return 'yellow'
  return 'normal'
}

export async function getMembers(): Promise<Member[]> {
  await requireAdmin()
  const supabase = getSupabaseServiceRole()

  // Step1: profiles + member_plans
  const { data: profiles, error } = await (supabase as any)
    .from("profiles")
    .select(`
      id, email, full_name, role, created_at,
      member_plans ( id, plan_id, current_points, status, plans ( name ) )
    `)
    .eq("role", "member")
    .order("created_at", { ascending: false })

  if (error) throw new Error(`会員の取得に失敗しました: ${error.message}`)

  const memberPlanIds = (profiles ?? [])
    .map((p: any) => p.member_plans?.[0]?.id)
    .filter(Boolean) as number[]

  // Step2a: 最終completedセッション
  const { data: lastSessions } = memberPlanIds.length > 0
    ? await (supabase as any)
        .from("bookings")
        .select("member_plan_id, end_time")
        .in("member_plan_id", memberPlanIds)
        .eq("status", "completed")
        .order("end_time", { ascending: false })
    : { data: [] }

  // Step2b: 将来のconfirmed予約
  const now = new Date().toISOString()
  const { data: futureBookings } = memberPlanIds.length > 0
    ? await (supabase as any)
        .from("bookings")
        .select("member_plan_id")
        .in("member_plan_id", memberPlanIds)
        .eq("status", "confirmed")
        .gt("start_time", now)
    : { data: [] }

  // JS集計
  const lastSessionMap = new Map<number, string>()
  for (const row of lastSessions ?? []) {
    if (!lastSessionMap.has(row.member_plan_id)) {
      lastSessionMap.set(row.member_plan_id, row.end_time)
    }
  }
  const hasFutureBookingSet = new Set(
    (futureBookings ?? []).map((r: any) => r.member_plan_id)
  )

  return (profiles ?? []).map((profile: any) => {
    const memberPlan = profile.member_plans?.[0]
    const memberPlanId = memberPlan?.id
    const lastSessionAt = memberPlanId ? (lastSessionMap.get(memberPlanId) ?? null) : null
    const hasFutureBooking = memberPlanId ? hasFutureBookingSet.has(memberPlanId) : false
    const activity_status = calcActivityStatus(lastSessionAt, hasFutureBooking)

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      created_at: profile.created_at,
      member_plan: memberPlan ? {
        id: memberPlan.id,
        plan_id: memberPlan.plan_id,
        current_points: memberPlan.current_points,
        status: memberPlan.status,
        plan: { name: memberPlan.plans?.name ?? "不明" },
      } : null,
      last_session_at: lastSessionAt,
      has_future_booking: hasFutureBooking,
      activity_status,
    }
  })
}
```

### DataTableのgetRowClassName追加

```typescript
// src/components/ui/data-table.tsx (変更箇所のみ)

import { ColumnDef, flexRender, getCoreRowModel, /* 既存 */ Row } from "@tanstack/react-table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  getRowClassName?: (row: Row<TData>) => string  // 追加
}

// TableRow部分
<TableRow
  key={row.id}
  data-state={row.getIsSelected() && "selected"}
  className={getRowClassName?.(row)}  // 追加
>
```

### Tailwind CSS 色コード推奨

shadcn/uiテーマはモノクロ（neutral）なので、Tailwindデフォルトカラーを使用する:

| 状態 | 背景色クラス | ホバー時 |
|------|------------|--------|
| 黄色（30日〜60日） | `bg-yellow-50` | `hover:bg-yellow-100` |
| 赤（60日超） | `bg-red-50` | `hover:bg-red-100` |

これらはTailwind v4でも使用可能（標準カラースケール維持）。

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase深いネストJOIN | 2段階クエリ + JS集計 | — | パフォーマンスとシンプルさのバランス |
| DataTableに行スタイルなし | getRowClassName propsで動的制御 | Phase 16 | 再利用可能な汎用DataTableを維持 |

---

## Open Questions

1. **`getFollowUpMembers()` の実装方式**
   - What we know: `getMembers()` を内部で呼んでフィルタするのが最も簡潔（DRY）
   - What's unclear: `getMembers()` のクエリが重複することを避けたい場合、内部ヘルパーに分割するか
   - Recommendation: まず `getMembers()` 再利用方式（最もシンプル）で実装し、パフォーマンス問題が出たら分割を検討する（YAGNI）

2. **ダッシュボードのフォローリストが0件の場合の表示**
   - What we know: 全員が30日以内に来ている場合
   - What's unclear: 非表示にするか「フォロー必要な会員はいません」と表示するか
   - Recommendation: `{members.length === 0 && <p>フォローが必要な会員はいません。</p>}` でシンプルに対応

---

## Environment Availability

Step 2.6: SKIPPED (外部ツール依存なし — コード変更のみ)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (jsdom環境) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

**注意:** `src/lib/actions/**` は vitest.config.ts の coverage excludeに含まれているが、テストファイル自体の実行は除外されていない。

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACT-01 | 30日以上&将来予約なし → activity_status = 'yellow' | unit | `npm test -- src/__tests__/lib/actions/activity-status.test.ts` | ❌ Wave 0 |
| ACT-02 | 60日以上&将来予約なし → activity_status = 'red' | unit | `npm test -- src/__tests__/lib/actions/activity-status.test.ts` | ❌ Wave 0 |
| ACT-02 | セッション実績なし&将来予約なし → activity_status = 'red' | unit | 同上 | ❌ Wave 0 |
| ACT-01/02 | 将来予約あり → activity_status = 'normal' | unit | 同上 | ❌ Wave 0 |
| ACT-03 | ダッシュボード表示 | manual | 管理画面 /admin/dashboard 目視確認 | manual-only |

**manual-only 理由 (ACT-03):** ダッシュボードはServer ComponentのUIレンダリング確認が必要なため、VitestのjsdomよりE2E（Playwright）か目視確認が現実的。E2Eテスト追加はYAGNI（既にPlaywright設定あり）。

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/lib/actions/activity-status.test.ts` — calcActivityStatus関数のユニットテスト (ACT-01, ACT-02)

*(note: calcActivityStatusをmembers.tsから分離してエクスポートするか、テスト対象に含まれるようにする)*

---

## Sources

### Primary (HIGH confidence)

- 直接コード調査: `src/components/ui/data-table.tsx` — DataTablePropsのAPI確認
- 直接コード調査: `src/lib/actions/admin/members.ts` — getMembers()の既存実装確認
- 直接コード調査: `supabase/migrations/20260222000001_initial_schema.sql` — bookingsテーブルスキーマ確認
- TanStack Table v8 (プロジェクト: 8.21.3) — `Row<TData>` 型とgetRowModel()API

### Secondary (MEDIUM confidence)

- globals.css 調査: shadcn/uiテーマはneutral（モノクロ）— Tailwindデフォルトカラーが最適と判断
- package.json 調査: date-fns 未導入を確認 — ネイティブDate使用を推奨

### Tertiary (LOW confidence)

- なし

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — プロジェクト既存技術の拡張のみ
- Architecture: HIGH — 既存パターン（Server Action + DataTable + Server Component）の踏襲
- Pitfalls: HIGH — コードを直接読んで確認済み（DataTableのprops不足、bookingsの結合キー等）

**Research date:** 2026-03-29
**Valid until:** 2026-04-30（安定した既存スタックのため）
