# Phase 14: プランタイプ別メニュー表示 - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

会員が予約画面を開いたとき、自分のプランタイプに対応するメニューのみが表示され、無関係なメニューが見えない。管理画面でメニューごとに対象プランタイプを設定できる。ゲスト予約画面は変更なし。

</domain>

<decisions>
## Implementation Decisions

### メニューフィルタリング方式
- **D-01:** アプリ層フィルタを採用する。RLSポリシー変更なし（STATE.md既定方針）。
- **D-02:** `bookings/new/page.tsx` で会員の `plan_type_id` を `member_plans` テーブルから直接取得し、取得したメニュー一覧を `allowed_plan_types` でフィルタする。
- **D-03:** 現在の `.eq("zoom_account", "B")` ハードコードフィルタを撤去し、`allowed_plan_types` ベースのフィルタに置き換える。
- **D-04:** フィルタロジック: `allowed_plan_types` が NULL → 全プラン表示（後方互換）。`allowed_plan_types` に会員の `plan_type_id` が含まれる → 表示。含まれない → 非表示。

### 管理画面UI
- **D-05:** メニュー編集画面にプランタイプ選択UIを追加する。チェックボックス形式で複数選択。
- **D-06:** 全プランタイプ未選択（チェックなし）= `allowed_plan_types = NULL` = 全プランに表示。
- **D-07:** `MenuSchema` (zod) と `createMenu` / `updateMenu` Server Actions に `allowed_plan_types` フィールドを追加する。
- **D-08:** `getMenus()` のselect結果に `allowed_plan_types` を含める。

### ゲスト予約への影響
- **D-09:** ゲスト予約画面（`/guest/booking`）は変更なし。別パスで30分固定のまま。Phase 14のフィルタは会員予約画面（`/bookings/new`）のみに影響。

### Claude's Discretion
- チェックボックスUIの具体的なレイアウト（shadcn/ui Checkbox活用）
- プランタイプ一覧の取得方法（plansテーブルからSELECT DISTINCT or ハードコード）
- `bookings/confirm/page.tsx` でのメニュー再取得時のフィルタ適用要否

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DBスキーマ（Phase 12で追加済み）
- `supabase/migrations/20260222000001_initial_schema.sql` — plans, meeting_menus テーブル定義
- `src/types/database.ts` — Supabase型定義（allowed_plan_types カラム含む）

### 会員予約画面（フィルタ置き換え対象）
- `src/app/(member)/bookings/new/page.tsx` L52-57 — 現在の `.eq("zoom_account", "B")` ハードコード（置き換え対象）
- `src/app/(member)/bookings/confirm/page.tsx` — 予約確認画面のメニュー参照

### 管理画面（CRUD拡張対象）
- `src/lib/actions/admin/menus.ts` — メニューCRUD Server Actions。MenuSchema, createMenu, updateMenu, getMenus を拡張

### 会員プラン取得パターン
- `src/app/(member)/layout.tsx` L35-40 — member_plans クエリパターンの参考（plan_type_id取得を追加）

### 要件
- `.planning/REQUIREMENTS.md` — MENU-02, MENU-04の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn/ui Checkbox`: チェックボックスコンポーネント利用可能
- `MenuSchema` (zod): 既存バリデーションスキーマを拡張するだけ
- `member_plans` クエリパターン: layout.tsx で確立済み — `plan_type_id` を追加SELECT
- `getSupabaseServiceRole()`: 管理画面Server Actionsで確立済み

### Established Patterns
- Server Actions パターン: `requireAdmin()` → `getSupabaseServiceRole()` → CRUD → `revalidatePath()`
- クライアント側Supabaseクエリ: `createClient()` → `.from().select().eq()` パターン

### Integration Points
- `bookings/new/page.tsx`: メニュー取得クエリの書き換え（zoom_accountフィルタ → allowed_plan_typesフィルタ）
- `admin/menus.ts`: MenuSchema拡張 + CRUD Server Actions拡張
- 管理画面メニュー編集フォーム: チェックボックスUI追加

</code_context>

<specifics>
## Specific Ideas

- 既存の発光ポジティブ定期便プランのメニュー（30/60/90/120分）は `allowed_plan_types = NULL` のままで全プラン表示を維持
- お金のブロック解消セッションメニューのみ `allowed_plan_types` に新プランIDを設定済み（Phase 12 seedデータ）
- プランタイプは現在2種類（発光ポジティブ定期便、お金のブロック解消）で安定

</specifics>

<deferred>
## Deferred Ideas

- ゲスト予約で1時間/2時間セッションを予約可能にする — 将来フェーズで別パス対応
- プランタイプの自動切り替え（有効期限ベース） — REQUIREMENTS.md v2 (MENU-F01)

</deferred>

---

*Phase: 14-plan-type-menu*
*Context gathered: 2026-03-28*
