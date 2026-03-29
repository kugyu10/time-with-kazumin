# Phase 12: DBスキーマ基盤 - Research

**Researched:** 2026-03-27
**Domain:** PostgreSQL マイグレーション / Supabase スキーマ変更 / Seed データ
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL` カラムを追加する。NULLは全プランに表示（後方互換）。GINインデックスを適用する。
- **D-02:** 中間テーブルは使わない。プランタイプは2〜3種類で安定するため配列カラムで十分（KISS原則）。
- **D-03:** 新プラン「お金のブロック解消プラン」を `plans` テーブルにINSERTする: monthly_points=120, max_points=240, price_monthly=50000
- **D-04:** 新メニュー「60分お金のブロック解消セッション」を `meeting_menus` にINSERTする: duration_minutes=60, points_required=60, zoom_account='A'（要確認）, allowed_plan_types に新プランIDを設定
- **D-05:** Phase 12はDBマイグレーション + seedデータのみ。管理画面でのプランタイプ設定UIはPhase 14で実装する。

### Claude's Discretion
- マイグレーションファイルの命名規則（既存パターン踏襲）
- GINインデックスの具体的な構文
- seedデータのINSERT順序

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MENU-01 | メニューごとに対象プランタイプを設定できる（管理画面） | `allowed_plan_types INTEGER[]` カラム追加マイグレーションで実現。Phase 14のUI実装のための基盤。 |
| MENU-03 | 「お金のブロック解消プラン」を新規プランタイプとして作成できる | `plans` テーブルへのINSERT seedデータで実現。 |
| MENU-05 | プランタイプ未設定のメニューは全プランに表示される（後方互換） | `DEFAULT NULL` + NULLを「全プラン表示」と解釈するアプリ層ロジックで実現。 |
</phase_requirements>

---

## Summary

Phase 12 は純粋な DB 変更フェーズである。作業は大きく2つ：(1) `meeting_menus` テーブルへの `allowed_plan_types INTEGER[]` カラム追加とGINインデックス適用、(2) 新プランとメニューの seed データ INSERT。既存の 9 本のマイグレーションファイルがすべて同一パターン（`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `INSERT ... ON CONFLICT DO NOTHING`）を使用しており、このフェーズでも同じパターンを踏襲する。

アプリ層（TypeScript 型定義）は Supabase CLI の `supabase gen types` コマンドで自動再生成できるため、手動修正は不要。ただし型定義を再生成しないとコンパイルエラーが起きる可能性があるため、マイグレーション適用後に必ず実行する必要がある。

**Primary recommendation:** `supabase/migrations/20260327000001_add_allowed_plan_types.sql` と `20260327000002_seed_money_block_plan.sql` の2ファイルを作成し、既存パターンを踏襲して適用する。型定義の再生成まで含めて完了とする。

---

## Standard Stack

### Core

| ツール | バージョン | 目的 | 理由 |
|--------|-----------|------|------|
| Supabase CLI | プロジェクト既存 | マイグレーション管理・型生成 | 全既存マイグレーションがこのCLIで管理されている |
| PostgreSQL | Supabase 管理 | 配列型・GINインデックス | `INTEGER[]` と `gin` インデックスはPostgresネイティブ機能 |

### 既存マイグレーションパターン

```
命名規則: YYYYMMDDHHMMSS_description.sql
現在の最新: 20260303000002_auto_complete_bookings.sql
Phase 12 用: 20260327000001_add_allowed_plan_types.sql
           20260327000002_seed_money_block_plan.sql
```

**Installation:** 追加パッケージ不要（Supabase CLI は既存）

---

## Architecture Patterns

### カラム追加マイグレーションのパターン

`20260222200002_meeting_menus_zoom_account.sql` が参考パターン：

```sql
-- Source: supabase/migrations/20260222200002_meeting_menus_zoom_account.sql
ALTER TABLE meeting_menus
ADD COLUMN IF NOT EXISTS zoom_account CHAR(1) DEFAULT 'A' CHECK (zoom_account IN ('A', 'B'));

COMMENT ON COLUMN meeting_menus.zoom_account IS 'Zoom account to use for meetings created from this menu (A or B)';
```

### INTEGER[] 配列カラム + GINインデックス

```sql
-- Source: PostgreSQL 公式ドキュメント (配列型 + GINインデックス)
ALTER TABLE meeting_menus
ADD COLUMN IF NOT EXISTS allowed_plan_types INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN meeting_menus.allowed_plan_types IS 'NULL = 全プランに表示（後方互換）。INTEGER配列でプランIDを指定すると対象プランのみ表示。';

CREATE INDEX IF NOT EXISTS idx_meeting_menus_allowed_plan_types
ON meeting_menus USING gin(allowed_plan_types)
WHERE allowed_plan_types IS NOT NULL;
```

**GINインデックスについて:**
- `WHERE allowed_plan_types IS NOT NULL` のパーシャルインデックスにすることで、NULL（全プラン表示）の既存メニュー行はインデックス対象外となり効率的
- `@>` 演算子（配列包含）での検索に対応する: `WHERE allowed_plan_types IS NULL OR allowed_plan_types @> ARRAY[plan_id]`

### seed データの INSERT パターン

`supabase/seed.sql` の既存パターン：

```sql
-- Source: supabase/seed.sql
INSERT INTO plans (name, monthly_points, max_points, price_monthly, is_active) VALUES
('無料プラン', 0, 0, 0, true)
ON CONFLICT DO NOTHING;
```

Phase 12 の seed データは **マイグレーションファイル内** に含める（seed.sql は初期データ専用、後続追加は migration で管理するのがベストプラクティス）。

### INSERT 順序（依存関係）

```
1. plans INSERT（お金のブロック解消プラン）
   → plans.id が確定する（SERIAL PRIMARY KEY）
2. meeting_menus INSERT（60分お金のブロック解消セッション）
   → allowed_plan_types = ARRAY[新プランのid] を設定
```

ただし `plans` は SERIAL なので id が事前にわからない。対策として CTE（Common Table Expression）またはサブクエリを使う：

```sql
-- CTEで plans INSERT の id を取得してから meeting_menus に使う
WITH new_plan AS (
  INSERT INTO plans (name, monthly_points, max_points, price_monthly, is_active)
  VALUES ('お金のブロック解消プラン', 120, 240, 50000, true)
  RETURNING id
)
INSERT INTO meeting_menus (name, duration_minutes, points_required, zoom_account, description, is_active, allowed_plan_types)
SELECT
  '60分お金のブロック解消セッション',
  60,
  60,
  'A',
  'お金のブロック解消プラン会員向け60分セッション',
  true,
  ARRAY[new_plan.id]
FROM new_plan;
```

### 型定義の再生成

マイグレーション適用後：

```bash
# Source: Supabase CLI 公式ドキュメント
supabase gen types typescript --local > src/types/database.ts
```

`src/types/database.ts` の `meeting_menus` テーブル型に `allowed_plan_types` カラムが追加される。

### Anti-Patterns を避けること

- **`ON CONFLICT DO NOTHING` を seed マイグレーションに使う**: CTEを使う場合は適用できないため、冪等性はマイグレーションファイル自体の一回適用で担保する（同じマイグレーションは2度適用されない）
- **型定義の手動修正**: `supabase gen types` で自動生成する。手動修正はスキーマとのズレを生む

---

## Don't Hand-Roll

| 問題 | 手作りしない | 使うもの | 理由 |
|------|------------|---------|------|
| TypeScript 型定義の更新 | 手動で `database.ts` を編集 | `supabase gen types` CLI | スキーマから自動生成が正確・漏れなし |
| 配列列のフィルタリング | カスタム関数 | PostgreSQL `@>` 演算子 + GINインデックス | PostgreSQL ネイティブで最適化済み |
| SERIAL id の予測 | マジックナンバーでid固定 | CTE (`RETURNING id`) | 環境依存のid参照は壊れやすい |

---

## Common Pitfalls

### Pitfall 1: `send_thank_you_email` カラムの存在確認

**何が起きるか:** `menus.ts` の `createMenu` / `updateMenu` が `send_thank_you_email` フィールドを参照しているが、`initial_schema.sql` には定義がない。別のマイグレーションで追加されている可能性がある。
**根本原因:** `database.ts` の型定義にも `send_thank_you_email` がない（初期 schema には存在しない）のに `menus.ts` で参照されている。
**回避策:** `meeting_menus` テーブルの実際のカラム一覧を `supabase db diff` や Supabase Studio で確認してから migration を書く。
**警告サイン:** マイグレーション適用時のエラー「column does not exist」

### Pitfall 2: 型再生成を忘れる

**何が起きるか:** `allowed_plan_types` カラムが DB に存在するのに TypeScript コンパイルエラー
**根本原因:** `src/types/database.ts` が古いまま
**回避策:** マイグレーション適用直後に `supabase gen types typescript --local > src/types/database.ts` を実行する
**警告サイン:** `Property 'allowed_plan_types' does not exist on type` エラー

### Pitfall 3: GINインデックスと NULL 値

**何が起きるか:** GINインデックスは NULL 値にマッチしないため、NULL のメニューを取得するクエリがインデックスを利用できない
**根本原因:** PostgreSQL の GIN インデックスは NULL をインデックス対象にしない
**回避策:** クエリは `WHERE allowed_plan_types IS NULL OR allowed_plan_types @> ARRAY[$1]` と書く。パーシャルインデックス `WHERE allowed_plan_types IS NOT NULL` でINSERT・UPDATE時のインデックス対象を限定する
**警告サイン:** NULL のメニューが予約画面に表示されない（Phase 14実装時）

### Pitfall 4: RLS ポリシーとの干渉なし

**確認事項:** `meeting_menus` の RLS ポリシー `"Anyone can view active menus"` は `USING (is_active = true)` のみ。`allowed_plan_types` によるフィルタは**アプリ層**で行う（RLSは変更不要）。これは STATE.md でも確認済み。
**回避策:** RLS ポリシーを変更しない。Phase 14 でアプリ層フィルタを実装する。

---

## Code Examples

### マイグレーション 1: カラムとインデックス追加

```sql
-- Source: 既存パターン (20260222200002_meeting_menus_zoom_account.sql) + PostgreSQL docs
-- File: supabase/migrations/20260327000001_add_allowed_plan_types.sql

ALTER TABLE meeting_menus
ADD COLUMN IF NOT EXISTS allowed_plan_types INTEGER[] DEFAULT NULL;

COMMENT ON COLUMN meeting_menus.allowed_plan_types IS 'NULL = 全プランに表示（後方互換）。ARRAY[plan_id, ...] で対象プランを限定する。';

CREATE INDEX IF NOT EXISTS idx_meeting_menus_allowed_plan_types
ON meeting_menus USING gin(allowed_plan_types)
WHERE allowed_plan_types IS NOT NULL;
```

### マイグレーション 2: Seed データ投入（CTE使用）

```sql
-- Source: PostgreSQL CTE INSERT ... RETURNING パターン
-- File: supabase/migrations/20260327000002_seed_money_block_plan.sql

-- お金のブロック解消プランを追加し、そのIDで専用メニューも挿入する
WITH new_plan AS (
  INSERT INTO plans (name, monthly_points, max_points, price_monthly, is_active)
  VALUES ('お金のブロック解消プラン', 120, 240, 50000, true)
  RETURNING id
)
INSERT INTO meeting_menus (name, duration_minutes, points_required, zoom_account, description, is_active, allowed_plan_types)
SELECT
  '60分お金のブロック解消セッション',
  60,
  60,
  'A',
  'お金のブロック解消プラン会員向け専用60分セッション',
  true,
  ARRAY[new_plan.id]
FROM new_plan;
```

### Phase 14 で使うクエリパターン（参考）

```typescript
// Phase 14 が参照するクエリパターン（Phase 12 では実装しない）
// Source: Supabase JS クライアント + PostgreSQL 配列演算子
const { data: menus } = await supabase
  .from('meeting_menus')
  .select('*')
  .eq('is_active', true)
  // allowed_plan_types IS NULL または planId を含む
  // → アプリ層フィルタで実装（RLS変更なし）
```

---

## State of the Art

| 旧アプローチ | 現アプローチ | 変更理由 |
|------------|------------|---------|
| 中間テーブル（menu_plan_types）| `INTEGER[]` 配列カラム | プランタイプが2〜3種類で安定。KISS原則に従い配列で十分。 |
| seed.sql への追加 | migration ファイル内でseed | 後続追加データはマイグレーションで管理が正しい。seed.sqlは初期データ専用。 |

---

## Open Questions

1. **`send_thank_you_email` カラムの存在確認**
   - 現状: `initial_schema.sql` に未定義だが `menus.ts` で参照されている
   - 不明点: どのマイグレーションで追加されたか（または型定義の不整合か）
   - 推奨: 実装開始前に `supabase db diff` または Supabase Studio のテーブル定義で確認する

2. **zoom_account の確認（D-04）**
   - 現状: CONTEXT.md で `zoom_account='A'`（要確認）と記載
   - 不明点: お金のブロック解消セッションで使用する Zoom アカウントが未確定
   - 推奨: 実装者がユーザーに確認する。暫定として `'A'` を使用し、後で変更可能

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit) + Playwright (e2e) |
| Config file | `vitest.config.ts` / `playwright.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test && npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MENU-01 | `meeting_menus` に `allowed_plan_types` カラムが存在する | manual (DB確認) | `supabase db diff` | ❌ Wave 0不要（SQL確認で十分） |
| MENU-03 | `plans` に「お金のブロック解消プラン」が存在する | manual (DB確認) | Supabase Studio / psql query | ❌ Wave 0不要 |
| MENU-05 | 既存メニューの `allowed_plan_types` が NULL | manual (DB確認) | `SELECT allowed_plan_types FROM meeting_menus` | ❌ Wave 0不要 |

**注記:** Phase 12 はスキーマ変更と seed データのみで、アプリコードの変更がない。自動テストよりも SQL 実行結果の手動確認が主な検証手段となる。

### Sampling Rate

- **Per task commit:** なし（スキーマ変更はコミット前に `supabase db diff` で確認）
- **Per wave merge:** `npm run test`（既存テストが壊れていないことを確認）
- **Phase gate:** 全 Success Criteria の DB 確認完了後に `/gsd:verify-work`

### Wave 0 Gaps

- [ ] 新規テストファイルは不要 — 既存 Playwright e2e テストが `meeting_menus` テーブルを参照するため、マイグレーション後も既存テストが通ることを確認する

---

## Sources

### Primary (HIGH confidence)

- プロジェクト内 `supabase/migrations/20260222000001_initial_schema.sql` — plans, meeting_menus テーブル定義を直接確認
- プロジェクト内 `supabase/migrations/20260222200002_meeting_menus_zoom_account.sql` — カラム追加パターンを直接確認
- プロジェクト内 `supabase/migrations/20260222000002_rls_policies.sql` — RLSポリシーを直接確認（meeting_menus は is_active のみ）
- プロジェクト内 `supabase/seed.sql` — 既存seed データパターンを直接確認
- プロジェクト内 `src/types/database.ts` — 現在の型定義を直接確認
- プロジェクト内 `.planning/phases/12-db/12-CONTEXT.md` — ユーザー決定事項を直接確認

### Secondary (MEDIUM confidence)

- PostgreSQL 公式ドキュメント — `INTEGER[]` 型、GINインデックス、CTE (`WITH ... RETURNING`)
- Supabase CLI ドキュメント — `supabase gen types typescript` コマンド

### Tertiary (LOW confidence)

なし

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 既存マイグレーションファイルを直接読み込んで確認
- Architecture: HIGH — 既存パターンから直接導出、PostgreSQL 標準機能のみ使用
- Pitfalls: HIGH — 実際のコード（menus.ts, database.ts, rls_policies.sql）を読んで特定

**Research date:** 2026-03-27
**Valid until:** 2026-06-27（Supabase・PostgreSQL バージョン変更がない限り安定）
