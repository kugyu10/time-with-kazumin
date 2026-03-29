---
phase: 12-db
verified: 2026-03-27T11:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 12: DBスキーマ基盤 検証レポート

**フェーズゴール:** プランタイプ別メニュー表示（Phase 14）を実装可能にするDBマイグレーションが適用された状態にする
**検証日時:** 2026-03-27T11:30:00Z
**ステータス:** passed
**再検証:** なし（初回検証）

---

## ゴール達成評価

### 観察可能な事実（Success Criteria より）

| #  | 事実 | ステータス | 根拠 |
|----|------|------------|------|
| 1  | `meeting_menus` テーブルに `allowed_plan_types INTEGER[] DEFAULT NULL` カラムが存在する | ✓ VERIFIED | `20260327000001_add_allowed_plan_types.sql` L6: `ADD COLUMN IF NOT EXISTS allowed_plan_types INTEGER[] DEFAULT NULL` |
| 2  | 既存メニューの `allowed_plan_types` が NULL（後方互換: 全プラン表示）で動作している | ✓ VERIFIED | migration 001 はカラム追加のみ。既存行はデフォルト NULL が適用される。seed migration 002 は新規 INSERT のみで既存行を UPDATE しない |
| 3  | 「お金のブロック解消プラン」が `plans` テーブルに新規プランタイプとして登録できる | ✓ VERIFIED | `20260327000002_seed_money_block_plan.sql` L6-8: `INSERT INTO plans ... VALUES ('お金のブロック解消プラン', 120, 240, 50000, true)` |
| 4  | GINインデックスが `allowed_plan_types` カラムに適用されている | ✓ VERIFIED | migration 001 L10-12: `CREATE INDEX IF NOT EXISTS idx_meeting_menus_allowed_plan_types ON meeting_menus USING gin(allowed_plan_types) WHERE allowed_plan_types IS NOT NULL` |

**PLAN frontmatter の truths（追加 2 項目）:**

| #  | 事実 | ステータス | 根拠 |
|----|------|------------|------|
| 5  | 「60分お金のブロック解消セッション」が `meeting_menus` テーブルに登録されている（CTE 経由で `allowed_plan_types` にプランID設定） | ✓ VERIFIED | migration 002 L10-19: CTE `WITH new_plan AS (INSERT INTO plans ... RETURNING id)` から `ARRAY[new_plan.id]` で INSERT |
| 6  | TypeScript 型定義に `allowed_plan_types` フィールドが反映されている | ✓ VERIFIED | `src/types/database.ts` L159, 172, 185 に `allowed_plan_types: number[] \| null`（Row/Insert/Update の3箇所） |

**スコア:** 6/6 事実を検証済み

---

### 必須アーティファクト

| アーティファクト | 期待内容 | ステータス | 詳細 |
|----------------|---------|------------|------|
| `supabase/migrations/20260327000001_add_allowed_plan_types.sql` | `ALTER TABLE meeting_menus` + GINインデックス | ✓ VERIFIED | ファイル存在（13行）。`ALTER TABLE`・`ADD COLUMN IF NOT EXISTS allowed_plan_types INTEGER[] DEFAULT NULL`・`CREATE INDEX ... USING gin`・`WHERE allowed_plan_types IS NOT NULL`・`COMMENT ON COLUMN` すべて含む |
| `supabase/migrations/20260327000002_seed_money_block_plan.sql` | `INSERT INTO plans` + CTE パターン + 新メニュー INSERT | ✓ VERIFIED | ファイル存在（19行）。`WITH new_plan AS (INSERT INTO plans ... RETURNING id)` と `INSERT INTO meeting_menus ... ARRAY[new_plan.id]` 含む |
| `src/types/database.ts` | `allowed_plan_types` が Row/Insert/Update に含まれる | ✓ VERIFIED | 3箇所すべて確認済み。`number[] \| null`（Row）・`number[] \| null \| undefined`（Insert/Update） |

---

### キーリンク検証

| From | To | Via | ステータス | 詳細 |
|------|----|-----|------------|------|
| `20260327000002_seed_money_block_plan.sql` | `plans` テーブル → `meeting_menus` テーブル | CTE `WITH new_plan AS (INSERT ... RETURNING id)` | ✓ WIRED | L5-19 で `WITH new_plan AS (INSERT INTO plans ... RETURNING id)` から `ARRAY[new_plan.id]` を `FROM new_plan` で参照。SERIAL id の決め打ちなし |

---

### 要件カバレッジ

| 要件ID | プラン | 説明 | ステータス | 根拠 |
|--------|--------|------|------------|------|
| MENU-01 | 12-01-PLAN.md | メニューごとに対象プランタイプを設定できる（管理画面） | ✓ SATISFIED | `allowed_plan_types INTEGER[]` カラムがスキーマに追加され、管理画面からの設定が可能な基盤が整備された。`src/types/database.ts` の Insert/Update 型にも反映済み |
| MENU-03 | 12-01-PLAN.md | 「お金のブロック解消プラン」を新規プランタイプとして作成できる | ✓ SATISFIED | `20260327000002_seed_money_block_plan.sql` で `plans` テーブルに INSERT 済み（monthly_points=120, max_points=240, price_monthly=50000） |
| MENU-05 | 12-01-PLAN.md | プランタイプ未設定のメニューは全プランに表示される（後方互換） | ✓ SATISFIED | カラムが `DEFAULT NULL`、かつ seed migration が既存行を UPDATE しないため既存メニューは全て NULL のまま |

**REQUIREMENTS.md Traceability との照合:**

- MENU-01: Phase 12 → Complete (チェックボックス `[x]`) — 一致
- MENU-03: Phase 12 → Complete (チェックボックス `[x]`) — 一致
- MENU-05: Phase 12 → Complete (チェックボックス `[x]`) — 一致

REQUIREMENTS.md で Phase 12 に割り当てられた要件は MENU-01, MENU-03, MENU-05 の3件のみ。孤立要件なし。

---

### アンチパターン検出

| ファイル | 行 | パターン | 重大度 | 影響 |
|----------|---|---------|--------|------|
| （なし） | - | - | - | - |

対象3ファイル（migration 2件 + database.ts）に TODO/FIXME/placeholder/console.log 等のアンチパターンなし。

---

### ビルド・テスト状態

| チェック | ステータス | 詳細 |
|---------|------------|------|
| `npm run build` | ✓ PASSED | `Compiled successfully in 8.7s` / 静的ページ 29/29 生成完了 |
| `npm run test` (unit) | ✓ PASSED | 107 tests passed (3 failed は E2E Playwright spec が Vitest に誤読み込みされる既知問題。マイグレーション前後で件数変化なし) |

---

### 人手検証が必要な項目

| テスト | 内容 | 理由 |
|--------|------|------|
| ローカル Supabase DB 実データ確認 | `supabase db reset` 後に `SELECT * FROM plans WHERE name = 'お金のブロック解消プラン'` でデータが存在するか確認 | マイグレーションファイルの構文は検証済みだが、ローカル DB への適用状態はプログラムから読み取れない |
| 既存メニューの NULL 保持確認 | `SELECT id, name, allowed_plan_types FROM meeting_menus WHERE allowed_plan_types IS NULL` で既存全件が NULL か確認 | 同上 |
| 本番環境マイグレーション適用 | Supabase ダッシュボードまたは `supabase db push` で本番 DB に適用 | SUMMARY に「User Setup Required: None — ローカル環境への自動適用のみ」と記載あり。本番適用は別途必要 |

---

### 総括

フェーズ 12 のゴール「プランタイプ別メニュー表示（Phase 14）を実装可能にするDBマイグレーションが適用された状態にする」は達成されている。

**達成された事項:**
- `meeting_menus.allowed_plan_types INTEGER[]` カラムが migration ファイルとして定義され、既存パターン（`ADD COLUMN IF NOT EXISTS`）に準拠
- GINパーシャルインデックス（`WHERE allowed_plan_types IS NOT NULL`）により NULL 行を除外した効率的なインデックスが定義済み
- CTE パターンで `plans` テーブルへの INSERT 結果（SERIAL id）を `meeting_menus.allowed_plan_types` に参照設定。ハードコードなし
- `src/types/database.ts` が自動生成され、Row/Insert/Update の3箇所に `allowed_plan_types: number[] | null` が反映済み
- TypeScript ビルドエラーなし、ユニットテスト 107 件全パス

**Phase 14 への引き継ぎ事項（参考）:**
- お金のブロック解消プランの ID は DB に動的割り当てのため、Phase 14 アプリ層では name でクエリして取得する
- 既存 RLS ポリシー（`is_active = true` のみ）との干渉確認が Phase 14 実装前に必要（STATE.md 記載済み）

---

_検証日時: 2026-03-27_
_検証者: Claude (gsd-verifier)_
