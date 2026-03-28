---
phase: 14-plan-type-menu
verified: 2026-03-28T12:52:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 14: プランタイプ別メニュー表示 Verification Report

**Phase Goal:** 会員が予約画面を開いたとき、自分のプランタイプに対応するメニューのみが表示され、無関係なメニューが見えない
**Verified:** 2026-03-28T12:52:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| #   | Truth                                                                                  | Status     | Evidence                                                                 |
| --- | -------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| 1   | 管理画面でメニューごとに「対象プランタイプ」を設定でき、保存が反映される              | ✓ VERIFIED | menu-form.tsx L236-268: チェックボックスUI実装済み。onSubmit L81-84でDB保存。 |
| 2   | 通常プラン会員の予約画面には、通常プラン対象メニューのみ表示される                    | ✓ VERIFIED | bookings/new/page.tsx L81: filterMenusByPlanType(menusData, userPlanId)が適用済み |
| 3   | 「お金のブロック解消プラン」会員の予約画面には、そのプラン専用メニューが表示される   | ✓ VERIFIED | filterMenusByPlanType: allowed_plan_types=[plan_id]のメニューはそのplan_idの会員にのみ表示される（ユニットテスト確認済み） |
| 4   | `allowed_plan_types` が NULL のメニューは全プランの会員に表示される（後方互換）       | ✓ VERIFIED | menu-filter.ts L11: `if (menu.allowed_plan_types === null) return true` + テストケース確認済み |

**Score:** 4/4 truths verified

---

### Required Artifacts

#### Plan 01 Artifacts

| Artifact                                           | Expected                                   | Status     | Details                                                                                  |
| -------------------------------------------------- | ------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `src/lib/actions/admin/menus.ts`                   | MenuSchema + CRUD support with allowed_plan_types | ✓ VERIFIED | L17: MenuSchema, L67: createMenu insert, L100: updateMenu update, L162: getMenus戻り値型 — 4箇所にallowed_plan_typesが存在 |
| `src/components/admin/forms/menu-form.tsx`         | Plan type checkbox UI                      | ✓ VERIFIED | formSchema L36, MenuFormProps L51、defaultValues L72、onSubmit変換 L81-84、チェックボックスUI L236-268 |
| `src/app/admin/menus/columns.tsx`                  | Menu type with allowed_plan_types          | ✓ VERIFIED | L25: `allowed_plan_types: number[] | null` が型定義に追加済み |

#### Plan 02 Artifacts

| Artifact                                           | Expected                                        | Status     | Details                                                     |
| -------------------------------------------------- | ----------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `src/app/(member)/bookings/new/page.tsx`           | Plan-type filtered menu display for members     | ✓ VERIFIED | filterMenusByPlanType import L9、member_plans query L57-62、allowed_plan_types select L68、filter適用 L81、zoom_account="B"削除済み |
| `src/lib/utils/menu-filter.ts`                     | Pure filter function filterMenusByPlanType      | ✓ VERIFIED | export function filterMenusByPlanType ジェネリック実装 (15行) |
| `src/lib/utils/menu-filter.test.ts`                | Unit tests for filter logic                     | ✓ VERIFIED | 5テストケース全パス (vitest run 確認済み)                   |

---

### Key Link Verification

| From                                          | To                         | Via                                         | Status     | Details                                                               |
| --------------------------------------------- | -------------------------- | ------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `src/app/admin/menus/page.tsx`                | plans table                | Supabase query for plan list                | ✓ WIRED    | L9-13: `.from("plans").select("id, name").eq("is_active", true)`       |
| `src/components/admin/forms/menu-form.tsx`    | `src/lib/actions/admin/menus.ts` | createMenu/updateMenu with allowed_plan_types | ✓ WIRED | L84-88: `const submitValues = {...values, allowed_plan_types: allowedPlanTypes}` → createMenu/updateMenu に渡す |
| `src/app/(member)/bookings/new/page.tsx`      | member_plans table         | Supabase query for user plan_id             | ✓ WIRED    | L57-62: `.from("member_plans").select("plan_id").eq("user_id", user.id).eq("status", "active")` |
| `src/app/(member)/bookings/new/page.tsx`      | `src/lib/utils/menu-filter.ts` | import filterMenusByPlanType              | ✓ WIRED    | L9: import、L81: `filterMenusByPlanType(menusData ?? [], userPlanId)` で使用 |

---

### Data-Flow Trace (Level 4)

| Artifact                                      | Data Variable   | Source                               | Produces Real Data | Status      |
| --------------------------------------------- | --------------- | ------------------------------------ | ------------------ | ----------- |
| `src/app/(member)/bookings/new/page.tsx`      | `menus` (state) | meeting_menus table + member_plans table | Yes — DB query at L66-70 + plan_id query at L57-62 | ✓ FLOWING |
| `src/components/admin/forms/menu-form.tsx`    | `plans` prop    | page.tsx で plans テーブルからフェッチ | Yes — page.tsx L9-13: DB query | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                                        | Command                                                                                   | Result                       | Status  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- | ------- |
| filterMenusByPlanType: 5テストケースが全パスする                | `npx vitest run src/lib/utils/menu-filter.test.ts`                                       | 5 passed (3ms)               | ✓ PASS  |
| zoom_account="B" ハードコードが撤去されている                  | `grep -n "zoom_account.*B" bookings/new/page.tsx`                                        | NOT_FOUND                    | ✓ PASS  |
| TypeScriptコンパイルがエラーなしで通る                         | `npx tsc --noEmit`                                                                        | exit 0 (エラーなし)          | ✓ PASS  |
| allowed_plan_types が menus.ts の4箇所に存在する               | `grep -c "allowed_plan_types" menus.ts`                                                  | 4                            | ✓ PASS  |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                               | Status     | Evidence                                                                           |
| ----------- | ----------- | --------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| MENU-02     | 14-01, 14-02 | 会員は自分のプランタイプに対応するメニューのみ予約画面に表示される                                        | ✓ SATISFIED | filterMenusByPlanType + bookings/new/page.tsx で allowed_plan_types ベースフィルタ実装済み |
| MENU-04     | 14-01, 14-02 | 「お金のブロック解消120分セッション」メニューはお金のブロック解消プランの会員のみに表示される           | ✓ SATISFIED | allowed_plan_types=[plan_id] でプラン限定表示。zoom_account="B" ハードコード撤去済み |

---

### Anti-Patterns Found

なし。スタブ、プレースホルダ、ハードコード空データは検出されなかった。

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | — | — | — |

---

### Human Verification Required

以下の項目はプログラム的に検証できないため、手動確認が推奨される。

#### 1. 管理画面でのプランタイプ設定UI動作

**Test:** 管理画面 `/admin/menus` でメニュー編集ダイアログを開き、「対象プランタイプ」のチェックボックスが表示されること、チェックを入れて保存後、DBに正しく反映されること
**Expected:** チェックボックスが plans テーブルのアクティブなプラン数だけ表示される。チェックした plan_id の配列が DB の allowed_plan_types カラムに保存される。全チェックを外すと NULL が保存される
**Why human:** UIの表示状態・ダイアログの動作はプログラム的に確認不可

#### 2. 通常プラン会員の予約画面でのフィルタ確認

**Test:** 通常プランに属する会員アカウントでログインし、`/bookings/new` を開く
**Expected:** 通常プラン対応メニュー（allowed_plan_types に通常プランの plan_id が含まれるもの）と allowed_plan_types=NULL のメニューのみ表示され、他のプラン専用メニューが表示されない
**Why human:** 実際のDBデータと認証状態に依存した表示結果はローカルDB環境でのみ確認可能

#### 3. お金のブロック解消プラン会員の限定メニュー表示

**Test:** お金のブロック解消プランに属する会員でログインし、`/bookings/new` を開く
**Expected:** そのプラン専用メニューが表示される。通常プランのみに割り当てられたメニューは表示されない
**Why human:** 特定のプランタイプのテストアカウントが必要

---

### Commit Verification

全コミットが git log で確認済み:

| Commit  | Phase | Description                                                             |
| ------- | ----- | ----------------------------------------------------------------------- |
| 3efc3a5 | 14-01 | feat: add allowed_plan_types to MenuSchema, CRUD, and Menu type         |
| a8ee4c3 | 14-01 | feat: add plan type checkbox UI to menu form                            |
| 973d21f | 14-02 | feat: add filterMenusByPlanType pure function with unit tests            |
| 5210718 | 14-02 | feat: replace zoom_account hardcode with allowed_plan_types filter in bookings/new |

---

### Summary

Phase 14 のゴール「会員が予約画面を開いたとき、自分のプランタイプに対応するメニューのみが表示され、無関係なメニューが見えない」は、コードベース上で完全に実現されている。

- **Plan 01** (管理画面CRUD対応): MenuSchema/createMenu/updateMenu/getMenusの全てにallowed_plan_typesが追加済み。管理画面フォームにプランタイプチェックボックスが実装済みで、plansテーブルからアクティブなプランを取得してUIに表示するサーバーサイドフェッチも配線済み。
- **Plan 02** (会員予約画面フィルタ): filterMenusByPlanType純粋関数がTDDで実装され5ユニットテスト全パス。予約画面でmember_plansテーブルからplan_idを取得し、allowed_plan_typesベースのフィルタが適用されている。zoom_account="B"ハードコードは完全に撤去済み。
- **要件カバレッジ**: MENU-02・MENU-04ともに実装根拠が存在し、SATISFIED。

自動検証は全て通過。実環境での動作確認（UIインタラクション・実際の会員データによるフィルタ結果）については人間による確認が推奨される。

---

_Verified: 2026-03-28T12:52:00Z_
_Verifier: Claude (gsd-verifier)_
