# Phase 12: DBスキーマ基盤 - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

プランタイプ別メニュー表示（Phase 14）を実装可能にするDBマイグレーションを適用する。管理画面UIはPhase 14で対応。このフェーズではスキーマ変更とseedデータ投入のみ。

</domain>

<decisions>
## Implementation Decisions

### メニューとプランの紐付け方式
- **D-01:** `meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL` カラムを追加する。NULLは全プランに表示（後方互換）。GINインデックスを適用する。
- **D-02:** 中間テーブルは使わない。プランタイプは2〜3種類で安定するため配列カラムで十分（KISS原則）。

### お金のブロック解消プラン
- **D-03:** 新プラン「お金のブロック解消プラン」を `plans` テーブルにINSERTする: monthly_points=120, max_points=240, price_monthly=50000
- **D-04:** 新メニュー「60分お金のブロック解消セッション」を `meeting_menus` にINSERTする: duration_minutes=60, points_required=60, zoom_account='A'（要確認）, allowed_plan_types に新プランIDを設定

### 管理画面UIの範囲
- **D-05:** Phase 12はDBマイグレーション + seedデータのみ。管理画面でのプランタイプ設定UIはPhase 14で実装する。

### Claude's Discretion
- マイグレーションファイルの命名規則（既存パターン踏襲）
- GINインデックスの具体的な構文
- seedデータのINSERT順序

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DBスキーマ
- `supabase/migrations/20260222000001_initial_schema.sql` — plans, meeting_menus テーブル定義（現在の構造を把握）
- `supabase/migrations/20260222200002_meeting_menus_zoom_account.sql` — zoom_account カラム追加パターン

### メニュー取得の既存コード
- `src/app/(member)/bookings/new/page.tsx` L52-57 — 現在のメニューフィルタ `.eq("zoom_account", "B")` ハードコード（Phase 14で置き換え対象）
- `src/lib/actions/admin/menus.ts` — メニューCRUD Server Actions

### 型定義
- `src/types/database.ts` — Supabase型定義（マイグレーション後に再生成必要）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 既存マイグレーションパターン: `supabase/migrations/` に5つのマイグレーションファイル。命名規則は `YYYYMMDDHHMMSS_description.sql`
- `src/types/database.ts`: Supabase CLI `supabase gen types` で自動生成

### Established Patterns
- カラム追加マイグレーション: `20260222200002_meeting_menus_zoom_account.sql` が参考パターン
- デフォルト値付きカラム追加で既存データに影響なし

### Integration Points
- `meeting_menus` テーブルを参照する箇所: bookings/new/page.tsx, bookings/confirm/page.tsx, saga.ts, admin/menus.ts, e2e/global-setup.ts
- `plans` テーブルを参照する箇所: admin Server Actions, member_plans JOIN

</code_context>

<specifics>
## Specific Ideas

- 既存の発光ポジティブ定期便プランのメニュー（30/60/90/120分）は `allowed_plan_types = NULL` のままにして全プラン表示を維持
- お金のブロック解消セッションメニューのみ `allowed_plan_types` に新プランIDを設定
- zoom_account はお金のブロック解消セッションでどちらを使うか未確定（D-04で要確認）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-db*
*Context gathered: 2026-03-27*
