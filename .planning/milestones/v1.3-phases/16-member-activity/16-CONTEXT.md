# Phase 16: 会員アクティビティ表示 - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

管理者が会員一覧を見るだけで、フォローが必要な会員を色分けで即座に把握できる。管理ダッシュボードにフォロー対象会員リストを表示する。

</domain>

<decisions>
## Implementation Decisions

### 色分けの表示方法
- **D-01:** 会員一覧テーブルの行背景色で表現する。30日以上未訪問 = 黄色（淡い背景）、60日以上未訪問 = 赤（淡い背景）。
- **D-02:** 会員一覧に「前回セッション」カラムを追加する。「XX日前」形式で直感的に表示。

### ダッシュボードのフォローリスト
- **D-03:** 管理ダッシュボード下部にフォロー必要会員をシンプルテーブル形式で表示する。
- **D-04:** テーブルには名前・プラン・前回セッション日時を表示。黄色セクション（30日〜60日）と赤セクション（60日超）に分けて表示。

### 「来ていない」の判定基準
- **D-05:** 最終セッション日は `bookings` テーブルで `status = 'completed'` の予約の `max(end_time)` で判定する。実際にセッションが行われた日を基準にする。
- **D-06:** 「次の予約なし」は `bookings` テーブルで `status = 'confirmed' AND start_time > now()` の予約が0件かどうかで判定する。将来のconfirmed予約がある会員はフォロー対象外。
- **D-07:** フォロー対象の条件: (最終セッション日から30日以上経過 OR セッション実績なし) AND (将来のconfirmed予約なし) AND (member_plans.status = 'active')。退会済み会員は対象外。

### Claude's Discretion
- 黄色/赤の具体的なCSS色コード（shadcn/uiテーマとの調和）
- 「前回セッション」カラムのソート実装方法
- ダッシュボードのフォローリストの件数上限（全件表示 or ページング）
- セッション実績なし会員の表示方法（「未訪問」ラベル等）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 会員一覧（色分け追加対象）
- `src/app/admin/members/page.tsx` — 会員一覧 Server Component。getMembers() + MembersClient パターン
- `src/app/admin/members/members-client.tsx` — 会員一覧 Client Component。DataTable + columns パターン
- `src/lib/actions/admin/members.ts` — getMembers Server Action。Member型定義（member_plan含む）

### ダッシュボード（フォローリスト追加対象）
- `src/app/admin/dashboard/page.tsx` — 管理ダッシュボード。現在クイックリンクカードのみ

### 予約テーブル
- `supabase/migrations/20260222000001_initial_schema.sql` — bookings テーブル定義（status, start_time, end_time, user_id）

### 要件
- `.planning/REQUIREMENTS.md` — ACT-01, ACT-02, ACT-03の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getMembers()`: 会員一覧取得 Server Action — member_plan JOINパターン確立済み。bookings集計の追加が必要
- shadcn/ui DataTable: 会員一覧で使用中。行のclassName制御でスタイル変更可能
- shadcn/ui Badge: ステータス表示に使用実績あり
- shadcn/ui Card: ダッシュボードのクイックリンクで使用中

### Established Patterns
- Server Component → Client Component props パターン（members/page.tsx → MembersClient）
- `getSupabaseServiceRole()` + `.from().select()` パターン

### Integration Points
- `members-client.tsx` の columns 定義: 「前回セッション」カラム追加 + 行背景色制御
- `dashboard/page.tsx`: フォロー対象会員リストコンポーネント追加
- `members.ts` の `getMembers()`: bookings テーブルとのJOIN/サブクエリ追加

</code_context>

<specifics>
## Specific Ideas

- 30日/60日の閾値は要件で固定。設定化は不要（YAGNI）
- 行背景色は「一目で分かる」ことが重要 — 淡い色で目に優しく、でも見逃さない程度
- ダッシュボードのフォローリストは「今すぐフォローが必要な人」を一覧するもの — 赤（60日超）を上に、黄（30〜60日）を下に

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-member-activity*
*Context gathered: 2026-03-29*
