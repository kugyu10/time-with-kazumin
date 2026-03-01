---
type: quick
task: admin-header-link
files_modified:
  - src/components/layout/Header.tsx
  - src/app/(member)/layout.tsx
autonomous: true
---

<objective>
ログインしている管理者ユーザーに対して、ヘッダーに「管理画面へ」リンクを表示する。

Purpose: 管理者がダッシュボードから管理画面へ簡単にアクセスできるようにする
Output: Header.tsxにadmin判定ロジック追加、管理画面リンク表示
</objective>

<context>
@src/components/layout/Header.tsx
@src/app/(member)/layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: HeaderコンポーネントにisAdmin propを追加し管理画面リンクを表示</name>
  <files>
    src/components/layout/Header.tsx
    src/app/(member)/layout.tsx
  </files>
  <action>
1. Header.tsx を修正:
   - HeaderProps インターフェースに `isAdmin?: boolean` を追加
   - lucide-react から `Settings` アイコンをインポート
   - isAdmin が true の場合、「予約する」ボタンの前に管理画面リンクを追加
   - リンクは `/admin/dashboard` へ遷移
   - ボタンスタイルは既存の「予約する」と同様（variant="ghost", size="sm"）
   - アイコンとテキスト（「管理画面」）を表示（モバイルではアイコンのみ）

2. (member)/layout.tsx を修正:
   - 既に取得している profile.role を利用
   - `isAdmin={profile.role === "admin"}` を Header に渡す
  </action>
  <verify>
npm run build でビルドエラーがないことを確認
ブラウザでadminユーザーでログインし、ヘッダーに「管理画面」リンクが表示されることを確認
  </verify>
  <done>
- adminユーザーでログイン時: ヘッダーに「管理画面へ」リンクが表示される
- 非adminユーザーでログイン時: リンクは表示されない
- リンクをクリックすると /admin/dashboard に遷移する
  </done>
</task>

</tasks>

<verification>
- npm run build が成功すること
- adminユーザーでログイン後、ヘッダーに管理画面リンクが表示されること
- 非adminユーザーではリンクが表示されないこと
</verification>

<success_criteria>
- ヘッダーに条件付きで管理画面リンクが表示される
- ビルドが通る
- 既存の機能が壊れていない
</success_criteria>
