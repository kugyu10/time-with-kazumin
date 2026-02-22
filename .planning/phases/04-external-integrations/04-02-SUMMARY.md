---
phase: 04-external-integrations
plan: 02
subsystem: integrations
tags: [zoom, resend, react-email, saga, oauth, lru-cache]

# Dependency graph
requires:
  - phase: 04-external-integrations
    plan: 01
    provides: "Google Calendar OAuth, retryWithExponentialBackoff, oauth_tokens"
  - phase: 02-authentication-booking-core
    provides: "Sagaパターン基盤、予約フロー"
  - phase: 03-guest-booking-experience
    provides: "キャンセルトークン生成"
provides:
  - "Zoom Server-to-Server OAuth統合（複数アカウント対応）"
  - "meeting_menus.zoom_accountカラム（A/Bアカウント切り替え）"
  - "Resend + React Email統合（予約確認メール）"
  - "本実装版Sagaオーケストレーター（Zoom/Calendar/Email統合）"
  - "キャンセルURL・GoogleカレンダーURL付きメール送信"
affects: [04-03, 05-admin-settings]

# Tech tracking
tech-stack:
  added: [resend, "@react-email/components"]
  patterns: [Server-to-Server OAuth, LRUトークンキャッシュ, 並列メール送信, 補償トランザクションリトライ]

key-files:
  created:
    - supabase/migrations/20260222200002_meeting_menus_zoom_account.sql
    - src/emails/components/Layout.tsx
    - src/emails/BookingConfirmation.tsx
  modified:
    - src/lib/integrations/zoom.ts
    - src/lib/integrations/email.ts
    - src/lib/bookings/saga.ts
    - src/lib/bookings/types.ts

key-decisions:
  - "Zoom Server-to-Server OAuth: アプリケーションレベル認証でユーザー認証不要"
  - "LRUキャッシュでZoomトークンを~1時間保持（APIコール削減）"
  - "meeting_menus.zoom_account: メニューごとにZoomアカウントA/B選択可能"
  - "メール送信失敗は非クリティカル: Promise.allSettledで並列送信、失敗しても予約は成功"
  - "補償トランザクションにretryWithExponentialBackoff適用"

patterns-established:
  - "Server-to-Server OAuth: アカウント資格情報でトークン取得、キャッシュ管理"
  - "React Emailテンプレート: コンポーネントベースのメール構築"
  - "Resend並列送信: ユーザー+管理者にPromise.allSettledで同時送信"

requirements-completed: [SYS-02, SYS-04, SYS-07]

# Metrics
duration: 9min
completed: 2026-02-22
---

# Phase 4 Plan 2: Zoom・Calendar・Email統合 Summary

**Zoom Server-to-Server OAuth（複数アカウント）、Resend+React Emailテンプレート、Sagaの本実装への拡張を完成**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-22T12:10:49Z
- **Completed:** 2026-02-22T12:19:49Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Zoom Server-to-Server OAuth統合（アカウントA/Bの使い分け）
- meeting_menusテーブルにzoom_accountカラム追加
- React Emailテンプレート（BookingConfirmation）とResend統合
- Sagaの本実装版への拡張（Zoom会議作成、Calendar追加、メール送信）
- キャンセルURL・GoogleカレンダーURL付き予約確認メール

## Task Commits

Each task was committed atomically:

1. **Task 1: Zoom Server-to-Server OAuth統合** - `a2596a4` (feat)
2. **Task 2: Resend + React Email統合** - `f9c0012` (feat)
3. **Task 3: Saga拡張（本実装統合）** - `1a3a605` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260222200002_meeting_menus_zoom_account.sql` - zoom_accountカラム追加
- `src/lib/integrations/zoom.ts` - Zoom Server-to-Server OAuth本実装
- `src/emails/components/Layout.tsx` - 共通メールレイアウト
- `src/emails/BookingConfirmation.tsx` - 予約確認メールテンプレート
- `src/lib/integrations/email.ts` - Resend統合、並列メール送信
- `src/lib/bookings/saga.ts` - 本実装版Saga（Zoom/Calendar/Email統合）
- `src/lib/bookings/types.ts` - zoomStartUrl, zoomAccountType追加

## Decisions Made

- **Zoom Server-to-Server OAuth選択**: ユーザー認証不要でアプリケーションレベルでAPI呼び出し可能
- **LRUキャッシュ（TTL 3500秒）**: Zoomトークンは約1時間有効、バッファを持たせてキャッシュ
- **非クリティカルメール送信**: メール失敗でも予約は成功扱い（ユーザー体験優先）
- **補償トランザクションリトライ**: 外部API削除時もretryWithExponentialBackoff適用

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**External services require manual configuration.**

### Zoom (2アカウント)

**環境変数:**
- `ZOOM_ACCOUNT_A_ID` - Zoom App Marketplace -> Server-to-Server OAuth -> Account ID
- `ZOOM_ACCOUNT_A_CLIENT_ID` - Server-to-Server OAuth App -> Client ID
- `ZOOM_ACCOUNT_A_CLIENT_SECRET` - Server-to-Server OAuth App -> Client Secret
- `ZOOM_ACCOUNT_B_ID` - 2つ目のアカウントで同様に設定
- `ZOOM_ACCOUNT_B_CLIENT_ID` - 2つ目のアカウント
- `ZOOM_ACCOUNT_B_CLIENT_SECRET` - 2つ目のアカウント

**ダッシュボード設定:**
1. Zoom App Marketplace -> Develop -> Build App -> Server-to-Server OAuth
2. meeting:write:admin scope を付与

### Resend

**環境変数:**
- `RESEND_API_KEY` - Resend Dashboard -> API Keys
- `FROM_EMAIL` - Resendで検証済みのメールアドレス
- `ADMIN_EMAIL` - 管理者通知用メールアドレス

**ダッシュボード設定:**
1. Resend Dashboard -> Domains でドメイン検証

## Next Phase Readiness

- 04-03でキャンセルフロー拡張（メール送信、Calendar/Zoom削除）
- 05でAdmin設定画面（meeting_menus.zoom_account設定UI）
- 全外部API統合が本実装完了

## Self-Check: PASSED

- All 7 key files verified to exist on disk
- 3 commits found with "04-02" scope

---
*Phase: 04-external-integrations*
*Completed: 2026-02-22*
