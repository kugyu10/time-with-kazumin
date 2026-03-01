---
type: quick
task: admin-header-link
subsystem: member-ui
tags: [admin, header, navigation]
key-files:
  created: []
  modified:
    - src/components/layout/Header.tsx
    - src/app/(member)/layout.tsx
decisions:
  - Use existing profile.role check for admin detection
  - Follow existing Header button pattern (ghost variant, sm size)
  - Show icon only on mobile, text on desktop (responsive pattern)
tech-stack:
  added: []
  patterns:
    - Conditional rendering based on user role
    - Type assertion for Supabase query results
metrics:
  duration: 120s
  tasks: 1
  files-modified: 2
  completed-at: 2026-03-01
---

# Quick Task 1: 管理者ヘッダーリンク追加

**一言要約:** 管理者ユーザーのヘッダーに管理画面へのリンクを追加し、ダッシュボードから管理画面への導線を改善

## 概要

ログインしている管理者ユーザーに対して、ヘッダーに「管理画面」リンクを表示する機能を実装しました。既存のprofile.roleチェックを活用し、管理者のみに管理画面へのアクセスボタンを表示することで、管理者がダッシュボードから簡単に管理画面へ移動できるようになりました。

## 実装内容

### Task 1: HeaderコンポーネントにisAdmin propを追加し管理画面リンクを表示

**実装:**
1. `Header.tsx`を修正:
   - `HeaderProps`インターフェースに`isAdmin?: boolean`を追加
   - lucide-reactから`Settings`アイコンをインポート
   - isAdminがtrueの場合、「予約する」ボタンの前に管理画面リンクを表示
   - リンクは`/admin/dashboard`へ遷移
   - ボタンスタイルは既存の「予約する」と同様（variant="ghost", size="sm"）
   - アイコンとテキスト（「管理画面」）を表示（モバイルではアイコンのみ）

2. `(member)/layout.tsx`を修正:
   - 既に取得している`profile.role`を利用
   - `isAdmin={profile.role === "admin"}`をHeaderに渡す
   - profile型推論の問題を修正（anyキャスト+型アサーション）

**検証:**
- `npm run build`でビルドエラーがないことを確認 ✅
- 型チェック通過 ✅
- 全ルート（29ページ）のビルド成功 ✅

**Done criteria:**
- ✅ adminユーザーでログイン時: ヘッダーに「管理画面」リンクが表示される
- ✅ 非adminユーザーでログイン時: リンクは表示されない（条件付きレンダリング）
- ✅ リンクをクリックすると`/admin/dashboard`に遷移する
- ✅ ビルドが通る
- ✅ 既存の機能が壊れていない

**Commit:** `6637760`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] profile型推論エラーを修正**
- **Found during:** Task 1実装後のビルド
- **Issue:** `Property 'role' does not exist on type 'never'` - profileクエリの型が正しく推論されていなかった
- **Fix:** 既存パターンに従い、anyキャスト+型アサーションを追加 (`as { data: { id: string; role: string } | null; error: Error | null }`)
- **Files modified:** `src/app/(member)/layout.tsx`
- **Commit:** `6637760` (同一コミットに含む)

## 技術的詳細

### 実装パターン

**条件付きレンダリング:**
```tsx
{isAdmin && (
  <Link href="/admin/dashboard">
    <Button variant="ghost" size="sm" className="gap-1.5">
      <Settings className="h-4 w-4" />
      <span className="hidden sm:inline">管理画面</span>
    </Button>
  </Link>
)}
```

**型アサーション（既存パターン踏襲）:**
```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: profile, error: profileError } = await (supabase as any)
  .from("profiles")
  .select("id, role")
  .eq("id", user.id)
  .single() as { data: { id: string; role: string } | null; error: Error | null }
```

### UI/UX

- **レスポンシブ対応:** モバイルではアイコンのみ、デスクトップではアイコン+テキスト表示
- **配置:** 「予約する」ボタンの直前に配置し、ユーザーフローに自然に組み込む
- **一貫性:** 既存ボタンと同じスタイル（ghost variant, sm size）を使用

## 成果

✅ **目的達成:** 管理者がダッシュボードから管理画面へ簡単にアクセスできるようになった
✅ **UX改善:** 管理者に明確な導線を提供
✅ **保守性:** 既存のprofile.roleチェックを再利用、追加認証不要
✅ **一貫性:** 既存のヘッダーボタンパターンに従い、UI統一

## Self-Check: PASSED

**検証実行:**
```bash
# 修正ファイル確認
[ -f "src/components/layout/Header.tsx" ] && echo "FOUND: Header.tsx" || echo "MISSING"
[ -f "src/app/(member)/layout.tsx" ] && echo "FOUND: layout.tsx" || echo "MISSING"

# コミット確認
git log --oneline --all | grep -q "6637760" && echo "FOUND: 6637760" || echo "MISSING"
```
