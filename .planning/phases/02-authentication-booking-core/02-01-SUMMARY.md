---
phase: 02-authentication-booking-core
plan: 01
subsystem: auth
tags: [supabase, next-auth, google-oauth, ssr, middleware]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: profiles table, RLS policies
provides:
  - Supabase SSRクライアント3パターン (browser, server, middleware)
  - ログインページ (Google OAuth + メール/パスワード)
  - OAuthコールバック処理
  - 認証ミドルウェア (保護ルート)
  - 会員レイアウト (招待制チェック)
affects: [02-02-booking-flow, 02-03-booking-management, 03-guest-booking]

# Tech tracking
tech-stack:
  added:
    - "@supabase/ssr@0.8.0"
    - "shadcn/ui (button, input, label, card)"
    - "lucide-react"
  patterns:
    - "Server/Client Component分離 (認証状態取得はServer Component)"
    - "Next.js middleware による保護ルート"
    - "@supabase/ssr の3パターンクライアント使い分け"

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/middleware.ts
    - src/app/(auth)/login/page.tsx
    - src/app/auth/callback/route.ts
    - src/middleware.ts
    - src/app/(member)/layout.tsx
    - src/components/auth/GoogleSignInButton.tsx
    - src/components/auth/LoginForm.tsx
    - src/types/database.ts
  modified:
    - package.json
    - next.config.ts

key-decisions:
  - "Next.js 15.3.3を使用 (Next.js 16のTurbopackは日本語パス名でバグが発生するため)"
  - "招待制チェックはprofilesテーブル存在確認で実装"
  - "Google OAuthを優先表示、メール/パスワードを代替手段として配置"

patterns-established:
  - "Server Component内での認証: await createClient() + supabase.auth.getUser()"
  - "Client Component内での認証: createClient() + OAuth/signInWithPassword"
  - "保護ルートパターン: middleware.ts + (member)/layout.tsx 二重チェック"

requirements-completed:
  - MEMBER-01

# Metrics
duration: 10min
completed: 2026-02-22
---

# Phase 2 Plan 01: 認証基盤 Summary

**Supabase Auth + Next.js 15 App Routerによる会員認証基盤: Google OAuth優先ログイン、招待制チェック、保護ルートミドルウェア**

## Performance

- **Duration:** 約10分
- **Started:** 2026-02-22T09:08:08Z
- **Completed:** 2026-02-22T09:17:40Z
- **Tasks:** 3
- **Files modified:** 15+

## Accomplishments

- Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui プロジェクト基盤構築
- @supabase/ssr を使用した3パターンのSupabaseクライアント実装
- Google OAuth優先のログインページ実装（招待制注意書き付き）
- 認証ミドルウェアによる保護ルートとリダイレクト制御
- 会員レイアウトでの招待制チェック（profiles存在確認）

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabaseクライアント3パターン実装** - `eb12dff` (feat)
2. **Task 2: ログインページとOAuthコールバック実装** - `ec510e4` (feat)
3. **Task 3: 認証ミドルウェアと会員レイアウト実装** - `2fe6115` (feat)

## Files Created/Modified

- `src/lib/supabase/client.ts` - ブラウザ用Supabaseクライアント
- `src/lib/supabase/server.ts` - Server Components/Route Handlers用
- `src/lib/supabase/middleware.ts` - ミドルウェア用（セッションリフレッシュ）
- `src/app/(auth)/login/page.tsx` - ログインページ（Server Component）
- `src/app/auth/callback/route.ts` - OAuthコールバックRoute Handler
- `src/middleware.ts` - 認証ミドルウェア
- `src/app/(member)/layout.tsx` - 会員エリアレイアウト（招待制チェック）
- `src/components/auth/GoogleSignInButton.tsx` - Google OAuthボタン
- `src/components/auth/LoginForm.tsx` - メール/パスワードフォーム
- `src/types/database.ts` - Supabase Database型定義

## Decisions Made

1. **Next.js 16からNext.js 15へダウングレード**: TurbopackがUnicodeパス名（日本語ディレクトリ）で内部パニックを起こすため、Webpack使用のNext.js 15.3.3を採用
2. **招待制の実装方針**: profilesテーブルへのレコード追加を「招待」とし、存在チェックで未招待ユーザーをブロック

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.jsプロジェクト基盤がなかった**
- **Found during:** Task 1開始前
- **Issue:** Phase 1ではDBマイグレーションのみ実施されており、Next.jsプロジェクトが存在しなかった
- **Fix:** create-next-appでプロジェクト作成、shadcn/ui初期化、必要なパッケージインストール
- **Files modified:** package.json, tsconfig.json, src/* 全般
- **Verification:** npm run build 成功
- **Committed in:** eb12dff (Task 1 commit)

**2. [Rule 3 - Blocking] Turbopack日本語パス問題**
- **Found during:** Task 2 ビルド検証時
- **Issue:** Next.js 16のTurbopackがディレクトリ名「かずみん」でUnicode境界エラー
- **Fix:** Next.js 15.3.3にダウングレード（Webpack使用）
- **Files modified:** package.json
- **Verification:** npm run build 成功
- **Committed in:** ec510e4 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** 両方とも実行に必要な前提条件の修正。スコープクリープなし。

## Issues Encountered

- Next.js 16のTurbopackが日本語パス名で動作しない問題 → Next.js 15へダウングレードで解決

## User Setup Required

**外部サービス設定が必要です:**

1. **Supabase環境変数**: `.env.local`に以下を設定
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://rvhivweztxowtjbivzhs.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Google OAuth設定**: Supabase Dashboard → Authentication → Providers → Google
   - クライアントID/シークレット設定
   - リダイレクトURL: `https://rvhivweztxowtjbivzhs.supabase.co/auth/v1/callback`

3. **Vercel環境変数** (デプロイ時):
   - 上記2つの環境変数を設定

## Next Phase Readiness

- 認証基盤完了、予約フロー実装（Plan 02）の準備完了
- ログイン後のリダイレクト先 `/bookings/new` はプレースホルダー状態
- Sagaパターンによる予約作成フロー実装が次のステップ

## Self-Check: PASSED

All files verified:
- src/lib/supabase/client.ts - FOUND
- src/lib/supabase/server.ts - FOUND
- src/lib/supabase/middleware.ts - FOUND
- src/app/(auth)/login/page.tsx - FOUND
- src/app/auth/callback/route.ts - FOUND
- src/middleware.ts - FOUND
- src/app/(member)/layout.tsx - FOUND
- src/components/auth/GoogleSignInButton.tsx - FOUND
- src/components/auth/LoginForm.tsx - FOUND
- src/types/database.ts - FOUND

All commits verified:
- eb12dff - Task 1
- ec510e4 - Task 2
- 2fe6115 - Task 3

---
*Phase: 02-authentication-booking-core*
*Completed: 2026-02-22*
