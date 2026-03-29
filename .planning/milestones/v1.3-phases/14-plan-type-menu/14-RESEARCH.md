# Phase 14: プランタイプ別メニュー表示 - Research

**Researched:** 2026-03-28
**Domain:** Next.js App Router クライアントコンポーネント フィルタリング + 管理画面フォーム拡張
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** アプリ層フィルタを採用する。RLSポリシー変更なし（STATE.md既定方針）。
- **D-02:** `bookings/new/page.tsx` で会員の `plan_type_id` を `member_plans` テーブルから直接取得し、取得したメニュー一覧を `allowed_plan_types` でフィルタする。
- **D-03:** 現在の `.eq("zoom_account", "B")` ハードコードフィルタを撤去し、`allowed_plan_types` ベースのフィルタに置き換える。
- **D-04:** フィルタロジック: `allowed_plan_types` が NULL → 全プラン表示（後方互換）。`allowed_plan_types` に会員の `plan_type_id` が含まれる → 表示。含まれない → 非表示。
- **D-05:** メニュー編集画面にプランタイプ選択UIを追加する。チェックボックス形式で複数選択。
- **D-06:** 全プランタイプ未選択（チェックなし）= `allowed_plan_types = NULL` = 全プランに表示。
- **D-07:** `MenuSchema` (zod) と `createMenu` / `updateMenu` Server Actions に `allowed_plan_types` フィールドを追加する。
- **D-08:** `getMenus()` のselect結果に `allowed_plan_types` を含める。
- **D-09:** ゲスト予約画面（`/guest/booking`）は変更なし。Phase 14のフィルタは会員予約画面（`/bookings/new`）のみに影響。

### Claude's Discretion

- チェックボックスUIの具体的なレイアウト（shadcn/ui Checkbox活用）
- プランタイプ一覧の取得方法（plansテーブルからSELECT DISTINCT or ハードコード）
- `bookings/confirm/page.tsx` でのメニュー再取得時のフィルタ適用要否

### Deferred Ideas (OUT OF SCOPE)

- ゲスト予約で1時間/2時間セッションを予約可能にする — 将来フェーズで別パス対応
- プランタイプの自動切り替え（有効期限ベース） — REQUIREMENTS.md v2 (MENU-F01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MENU-02 | 会員は自分のプランタイプに対応するメニューのみ予約画面に表示される | bookings/new/page.tsx の fetchData でplan_id取得 + JSフィルタで実現可能 |
| MENU-04 | 「お金のブロック解消セッション」メニューはお金のブロック解消プランの会員のみに表示される | meeting_menus.allowed_plan_types にseedデータが投入済み。フィルタロジックで自動対応 |
</phase_requirements>

---

## Summary

Phase 14は純粋なアプリ層フィルタリング実装フェーズ。DBスキーマ（`allowed_plan_types INTEGER[]`）はPhase 12で追加済みであり、新規マイグレーションは不要。

変更対象は3箇所に限定される。(1) 会員予約画面（`bookings/new/page.tsx`）: `.eq("zoom_account", "B")` ハードコードを削除し、会員の `plan_id` を取得した上でJSフィルタを適用する。(2) 管理画面メニューフォーム（`menu-form.tsx`）: `allowed_plan_types` チェックボックスUIを追加する。(3) 管理画面のServer Actions（`menus.ts`）と型定義（`columns.tsx`）: `allowed_plan_types` フィールドを追加する。

フィルタロジックはシンプル: `allowed_plan_types === null` なら全プラン表示、そうでなければ `allowed_plan_types.includes(userPlanId)` で判定する。RLSポリシーは変更しない（`meeting_menus` の既存ポリシーは `is_active = true` のみを制限）。

**Primary recommendation:** `bookings/new/page.tsx` の fetchData を修正してmember_plansから `plan_id` を追加取得し、JSフィルタで絞り込む。管理画面フォームには shadcn/ui Checkbox を使った `allowed_plan_types` 選択UIを追加する。

---

## Project Constraints (from CLAUDE.md)

グローバルCLAUDE.md（`~/.claude/CLAUDE.md`）より:

- **回答は日本語** — コードコメント、変数名は英語継続可
- **KISS:** コードは可能な限りシンプルに保つ
- **YAGNI:** 今必要なコードのみ追加する（将来の拡張を先読みしない）
- **DRY:** 同じコードの繰り返しを避ける

プロジェクト固有の `CLAUDE.md` は存在しない。

---

## Standard Stack

### Core（既存 — 変更なし）

| Library | Version | Purpose | 備考 |
|---------|---------|---------|------|
| Next.js | 15.x | App Router, Server Actions, クライアントコンポーネント | 既存 |
| Supabase JS | 2.x | DBクエリ（client.ts / server.ts） | 既存 |
| Zod | 3.x | Server Actions バリデーションスキーマ | 既存 |
| React Hook Form | 7.x | 管理画面フォーム | 既存 |
| shadcn/ui | latest | Checkbox, Form コンポーネント | 既存、Checkbox は menu-form.tsx で既にimport済み |

### 新規インストール不要

Phase 14で新たにインストールするパッケージはない。全て既存スタック内で完結する。

---

## Architecture Patterns

### 既存のコード構造（変更対象ファイル）

```
src/
├── app/
│   ├── (member)/
│   │   └── bookings/
│   │       ├── new/page.tsx          # フィルタ変更対象 ("use client")
│   │       └── confirm/page.tsx      # 変更不要（menu_idで直接fetch）
│   └── admin/
│       └── menus/
│           ├── page.tsx              # getMenus()呼び出し（変更不要）
│           ├── menus-client.tsx      # MenuForm props変更（型合わせ）
│           └── columns.tsx           # Menu型にallowed_plan_types追加
├── components/
│   └── admin/forms/
│       └── menu-form.tsx             # allowed_plan_types チェックボックスUI追加
└── lib/
    └── actions/admin/
        └── menus.ts                  # MenuSchema + CRUD拡張
```

### Pattern 1: bookings/new/page.tsx のフィルタ置き換え

**What:** クライアントコンポーネントで認証ユーザーのplan_idを取得し、JSフィルタで表示メニューを絞り込む

**既存コード（L49-58）の問題点:**
```typescript
// 現在: zoom_account="B" ハードコード（L52-57）
const { data: menusData } = await supabase
  .from("meeting_menus")
  .select("id, name, description, duration_minutes, points_required")
  .eq("is_active", true)
  .eq("zoom_account", "B")   // ← 削除対象
  .order("points_required", { ascending: true })
```

**変更後のパターン:**
```typescript
// Step 1: ユーザー認証
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  router.push("/login")
  return
}

// Step 2: 会員のplan_idを取得
const { data: memberPlan } = await supabase
  .from("member_plans")
  .select("plan_id")
  .eq("user_id", user.id)
  .eq("status", "active")
  .single()

// Step 3: 全アクティブメニューを取得（zoom_accountフィルタなし）
const { data: allMenus } = await supabase
  .from("meeting_menus")
  .select("id, name, description, duration_minutes, points_required, allowed_plan_types")
  .eq("is_active", true)
  .order("points_required", { ascending: true })

// Step 4: JSフィルタでplan_typeに合うメニューのみ抽出（D-04ロジック）
const userPlanId = memberPlan?.plan_id ?? null
const filteredMenus = (allMenus ?? []).filter((menu) => {
  if (menu.allowed_plan_types === null) return true  // NULL = 全プラン表示
  if (userPlanId === null) return false               // プランなし会員は限定メニュー非表示
  return menu.allowed_plan_types.includes(userPlanId)
})

setMenus(filteredMenus)
```

**注意:** `Menu` 型（`@/components/bookings/MenuSelect` の `type Menu`）に `allowed_plan_types` は不要。フィルタ後の結果のみ渡す。

### Pattern 2: MenuSchema + Server Actions 拡張

**対象:** `src/lib/actions/admin/menus.ts`

```typescript
// MenuSchema に追加
const MenuSchema = z.object({
  // ... 既存フィールド ...
  allowed_plan_types: z.array(z.number()).nullable().optional(),
})

// createMenu の insert に追加
.insert({
  // ... 既存フィールド ...
  allowed_plan_types: validated.allowed_plan_types ?? null,
})

// updateMenu の update に追加
.update({
  // ... 既存フィールド ...
  allowed_plan_types: validated.allowed_plan_types ?? null,
  updated_at: new Date().toISOString(),
})
```

### Pattern 3: menu-form.tsx チェックボックスUI

**What:** プランタイプ一覧をplansテーブルから取得し、チェックボックスで複数選択。未選択 = NULL（全プラン表示）

**プランタイプ一覧の取得:** フォームをServer Componentから呼び出す管理画面では、`plans` テーブルから `SELECT id, name WHERE is_active = true` で取得してpropsとして渡す方法が最も単純（YAGNI原則）。

```typescript
// menu-form.tsx の formSchema に追加
allowed_plan_types: z.array(z.number()).optional(),  // チェックなし = undefined = NULL

// defaultValues
allowed_plan_types: menu?.allowed_plan_types ?? [],

// フォーム送信時の変換
// [] (空配列) → null として送信（D-06: 未選択 = NULL = 全プラン表示）
const allowedPlanTypes = values.allowed_plan_types?.length
  ? values.allowed_plan_types
  : null
await updateMenu(menu.id, { ...values, allowed_plan_types: allowedPlanTypes })
```

**チェックボックスUIパターン（既存 is_active チェックボックスと同じ構造）:**
```tsx
// FormField で plan ごとにチェックボックスをレンダリング
{plans.map((plan) => (
  <FormField
    key={plan.id}
    control={form.control}
    name="allowed_plan_types"
    render={({ field }) => (
      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
        <FormControl>
          <Checkbox
            checked={field.value?.includes(plan.id)}
            onCheckedChange={(checked) => {
              const current = field.value ?? []
              field.onChange(
                checked
                  ? [...current, plan.id]
                  : current.filter((id) => id !== plan.id)
              )
            }}
          />
        </FormControl>
        <FormLabel className="font-normal">{plan.name}</FormLabel>
      </FormItem>
    )}
  />
))}
```

### Pattern 4: columns.tsx と getMenus() の型更新

**columns.tsx の Menu 型拡張:**
```typescript
export type Menu = {
  // ... 既存フィールド ...
  allowed_plan_types: number[] | null  // 追加
}
```

**getMenus() の戻り値型更新:** `getMenus()` は既に `.select("*")` で全カラム取得しているため、クエリ変更は不要。戻り値の型定義に `allowed_plan_types` を追加するだけ。

### Anti-Patterns to Avoid

- **RLS変更を試みる:** アプリ層フィルタで十分（D-01ロック）。RLSを変更すると既存のゲスト予約フローと競合するリスクがある
- **allowed_plan_types を DB側でフィルタする（.contains() Supabase演算子）:** 会員のplan_idがNULLの場合やallowed_plan_typesがNULLの場合の処理がDB側クエリでは複雑になる。JSフィルタの方がシンプル
- **zoom_account="B" フィルタを残す:** 撤去対象（D-03ロック）。残すと将来のZoomアカウント変更時にバグになる
- **confirm/page.tsx にフィルタを追加する:** 不要（D-09スコープ外）。confirm画面はmenu_idで直接fetchするだけで十分

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| チェックボックス複数選択 | 独自チェックボックスコンポーネント | shadcn/ui Checkbox (既にimport済み) | アクセシビリティ対応済み、プロジェクト統一 |
| 配列フィールドバリデーション | 独自バリデーション | `z.array(z.number()).nullable()` | 既存zodパターンの延長で対応可能 |
| プランタイプ一覧取得 | ハードコード配列 | `plans` テーブルから SELECT | 将来のプラン追加時に管理画面変更不要 |

---

## Common Pitfalls

### Pitfall 1: plan_id と plan_type_id の混同
**What goes wrong:** `member_plans.plan_id` が `plans.id` への外部キー。`plans` テーブルに `plan_type_id` カラムは存在しない。プランIDが即ちプランタイプID。
**Why it happens:** CONTEXT.mdの「plan_type_id」という表記は論理的な呼称であり、カラム名ではない
**How to avoid:** `member_plans.plan_id` と `meeting_menus.allowed_plan_types[]` の値を直接比較する
**Warning signs:** `plan_type_id` カラムを select しようとするとエラーになる

### Pitfall 2: ユーザー未認証状態での fetchData
**What goes wrong:** `bookings/new/page.tsx` はクライアントコンポーネント（"use client"）。`useEffect` で fetchData を呼ぶ際にユーザー未認証のケースを処理しないと null 参照エラーが発生する
**Why it happens:** layout.tsx でリダイレクト保護があるが、クライアント側では非同期認証確認が必要
**How to avoid:** fetchData の冒頭で `supabase.auth.getUser()` を呼び、user が null なら `router.push("/login")` してリターン
**Warning signs:** `memberPlan` が null でも filteredMenus の計算がクラッシュしないよう `?? null` でハンドリング

### Pitfall 3: 空配列 [] と NULL の混同
**What goes wrong:** フォームで全チェックを外したとき `allowed_plan_types = []`（空配列）になるが、DBに保存すべきは `NULL`（全プラン表示の意味）
**Why it happens:** zodスキーマとフォームの defaultValues が空配列で初期化されるため
**How to avoid:** onSubmit 前に `values.allowed_plan_types?.length ? values.allowed_plan_types : null` に変換する（D-06）
**Warning signs:** DB に `{}` や `{}`（空配列）が保存されると、フィルタロジックで全プランが「表示されない」状態になる

### Pitfall 4: allowed_plan_types フィールドが getMenus() の戻り値型に含まれない
**What goes wrong:** `getMenus()` は `select("*")` で取得しているが、戻り値の型アノテーションに `allowed_plan_types` が含まれていないため TypeScript が型エラーを出す
**Why it happens:** `menus.ts` の `getMenus()` の型キャスト部分に `allowed_plan_types` が未記述
**How to avoid:** `getMenus()` の戻り値型定義（L150〜163付近の型キャスト）に `allowed_plan_types: number[] | null` を追加する

### Pitfall 5: Menu コンポーネントへの allowed_plan_types 漏洩
**What goes wrong:** `MenuSelect` コンポーネントの `Menu` 型（`src/components/bookings/MenuSelect`）に `allowed_plan_types` を追加すると、コンポーネントが内部実装詳細を知ることになる
**Why it happens:** フィルタ済みのメニューを渡すので、MenuSelectコンポーネントはallowed_plan_typesを知る必要がない
**How to avoid:** `bookings/new/page.tsx` 内でフィルタした後、既存の `Menu` 型（id, name, description, duration_minutes, points_required）のみ渡す。`allowed_plan_types` は中間変数として保持するだけ

---

## Code Examples

### メニューフィルタロジック（D-04）
```typescript
// bookings/new/page.tsx 内
const userPlanId = memberPlan?.plan_id ?? null
const filteredMenus = (allMenus ?? []).filter((menu) => {
  // NULL = 全プランに表示（後方互換）
  if (menu.allowed_plan_types === null) return true
  // プランなし会員は限定メニュー非表示
  if (userPlanId === null) return false
  // 会員のplan_idが allowed_plan_types に含まれるか
  return menu.allowed_plan_types.includes(userPlanId)
})
```

### MenuSchema 拡張（menus.ts）
```typescript
const MenuSchema = z.object({
  name: z.string().min(1).max(100),
  duration_minutes: z.number().min(15).max(480),
  points_required: z.number().min(0),
  zoom_account: z.enum(["A", "B"]),
  description: z.string().optional().nullable(),
  is_active: z.boolean(),
  send_thank_you_email: z.boolean(),
  allowed_plan_types: z.array(z.number()).nullable().optional(),  // 追加
})
```

### 管理画面でのプランタイプ一覧取得（menus/page.tsx のServer Component）
```typescript
// page.tsx (Server Component) でプラン一覧を取得してMenuFormに渡す
const supabase = getSupabaseServiceRole()
const { data: plans } = await supabase
  .from("plans")
  .select("id, name")
  .eq("is_active", true)
  .order("id", { ascending: true })

// MenusClient に plans を追加で渡す
<MenusClient initialMenus={menus} plans={plans ?? []} />
```

---

## Runtime State Inventory

> このフェーズはgreenfield/アプリ層変更フェーズ。RLS変更・DBマイグレーション・データ移行なし。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | meeting_menus.allowed_plan_types: seedデータで「お金のブロック解消セッション」に plans.id が設定済み | なし（Phase 12完了済み） |
| Live service config | なし | なし |
| OS-registered state | なし | なし |
| Secrets/env vars | なし | なし |
| Build artifacts | なし | なし |

---

## Environment Availability

> Step 2.6: SKIPPED (Phase 14は純粋なコード/設定変更フェーズ。外部依存ツールなし。)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest（`zoom.test.ts` 等で確認済み） |
| Config file | `vitest.config.ts`（プロジェクトルート） |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | 備考 |
|--------|----------|-----------|------|
| MENU-02 | フィルタロジック: NULL→全表示、plan_id一致→表示、不一致→非表示 | unit | フィルタ関数を抽出してテスト可能 |
| MENU-04 | お金のブロック解消メニューが該当プラン会員のみに表示 | manual smoke test | 実DBのseedデータに依存するためE2E的確認が現実的 |

**フィルタロジックのユニットテスト（推奨）:**
```typescript
// フィルタ関数を純粋関数として抽出するとテストが容易
function filterMenusByPlanType(
  menus: Array<{ allowed_plan_types: number[] | null; [key: string]: unknown }>,
  userPlanId: number | null
) {
  return menus.filter((menu) => {
    if (menu.allowed_plan_types === null) return true
    if (userPlanId === null) return false
    return menu.allowed_plan_types.includes(userPlanId)
  })
}
```

### Wave 0 Gaps
- フィルタロジックのユニットテストファイルは存在しない（新規作成推奨）
- ただしKISSの観点から、フィルタ関数が十分シンプルであれば手動テストで代替可

---

## Open Questions

1. **confirm/page.tsx のフィルタ適用要否（Claude裁量）**
   - What we know: CONTEXT.md D-09で「変更なし」とあるが明示的な理由記述なし
   - What's unclear: URLパラメータで `menu_id` を直接指定するため、別プラン会員が手動URLで別プランのメニューを確認画面に進めるリスクがある
   - Recommendation: scope外（D-09）として今回は対応しない。確認画面はポイント消費前の確認のみで、実際の予約作成はAPIに委譲するため。もしAPIでバリデーションが必要なら別フェーズで対応

2. **プランタイプ一覧のキャッシュ（Claude裁量）**
   - What we know: プランは現在2種類のみで安定している（CONTEXT.md Specifics）
   - What's unclear: 管理画面フォームを開くたびに `plans` テーブルをSELECTするか、ページレベルで1回取得するか
   - Recommendation: `menus/page.tsx` のServer Component（ページ全体レンダリング時）でまとめて取得してpropsで渡す。Next.js App Routerのリクエストデデュープにより重複クエリは自動最適化される

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| zoom_account="B" ハードコードフィルタ | allowed_plan_types JSフィルタ | Phase 14 (2026-03-28) | プランタイプ追加時にコード変更不要になる |
| MenuSchema に allowed_plan_types なし | allowed_plan_types nullable array | Phase 14 (2026-03-28) | 管理画面からメニューのプランタイプ制限設定可能 |

---

## Sources

### Primary (HIGH confidence)
- プロジェクトコード直接調査: `src/app/(member)/bookings/new/page.tsx` L1-219
- プロジェクトコード直接調査: `src/lib/actions/admin/menus.ts` L1-170
- プロジェクトコード直接調査: `src/components/admin/forms/menu-form.tsx` L1-245
- プロジェクトコード直接調査: `src/types/database.ts` — meeting_menus.allowed_plan_types: number[] | null 確認
- マイグレーション確認: `supabase/migrations/20260327000001_add_allowed_plan_types.sql`
- マイグレーション確認: `supabase/migrations/20260327000002_seed_money_block_plan.sql`
- RLSポリシー確認: `supabase/migrations/20260222000002_rls_policies.sql`

### Secondary (MEDIUM confidence)
- CONTEXT.md ロック決定 D-01〜D-09（ユーザー確認済み）

---

## Metadata

**Confidence breakdown:**
- フィルタロジック: HIGH - 既存コードと型定義から完全に仕様が確定できる
- 管理画面UI変更: HIGH - 既存パターン（is_active Checkbox）と同じ構造で実装可能
- RLS非干渉: HIGH - ポリシーは is_active のみを制限、allowed_plan_types は対象外

**Research date:** 2026-03-28
**Valid until:** 安定スキーマのため 90日以上有効
