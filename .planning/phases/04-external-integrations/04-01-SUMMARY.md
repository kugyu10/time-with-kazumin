---
phase: 04-external-integrations
plan: 01
subsystem: integrations
tags: [google-calendar, oauth, freebusy, lru-cache, exponential-backoff]

# Dependency graph
requires:
  - phase: 03-guest-booking-experience
    provides: "空きスロットAPI基盤"
  - phase: 02-authentication-booking-core
    provides: "認証フロー、Sagaパターン基盤"
provides:
  - "Google OAuth 2.0認証フロー（access_type: offline）"
  - "oauth_tokensテーブル（pgcrypto暗号化）"
  - "Google Calendar FreeBusy API統合"
  - "15分TTLキャッシュ付きbusy時間取得"
  - "指数バックオフリトライユーティリティ"
affects: [04-02, 04-03, 05-admin-settings]

# Tech tracking
tech-stack:
  added: [googleapis]
  patterns: [遅延初期化, LRUキャッシュ, 指数バックオフ, トークン自動リフレッシュ]

key-files:
  created:
    - supabase/migrations/20260222200001_oauth_tokens.sql
    - src/lib/integrations/oauth/google.ts
    - src/lib/integrations/oauth/tokens.ts
    - src/lib/utils/retry.ts
    - src/app/api/admin/oauth/google/route.ts
    - src/app/api/admin/oauth/google/callback/route.ts
  modified:
    - src/lib/integrations/google-calendar.ts
    - src/app/api/public/slots/route.ts

key-decisions:
  - "pgp_sym_encryptでOAuthトークンを暗号化（AES-256相当）"
  - "googleapis 'tokens'イベントでリフレッシュ検出・DB自動更新"
  - "OAuthトークン未設定時はモックフォールバック（予約可能を維持）"

patterns-established:
  - "OAuth認証フロー: 認証URL生成 -> コールバック -> トークンDB保存 -> 自動リフレッシュ"
  - "外部API呼び出し: retryWithExponentialBackoff()でラップ"
  - "キャッシュ戦略: LRUCache with TTL for API rate limit対策"

requirements-completed: [ADMIN-02]

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 4 Plan 1: Google Calendar OAuth統合 Summary

**Google OAuth 2.0認証フロー、pgcrypto暗号化トークン保存、FreeBusy API統合、15分キャッシュ付きbusy時間取得を実装**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T12:00:37Z
- **Completed:** 2026-02-22T12:07:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Google OAuth 2.0認証フロー（管理者がCalendar API権限を付与）
- oauth_tokensテーブルでトークンを暗号化保存（pgcrypto pgp_sym_encrypt）
- Google Calendar FreeBusy APIでbusy時間を取得
- 空きスロットAPIがbusy時間を反映して計算（予約不可スロットを自動除外）
- 15分TTLキャッシュでAPI呼び出し数を削減
- 指数バックオフリトライでレート制限に対応

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuthトークン管理基盤** - `10e8a3a` (feat)
2. **Task 2: Google Calendar FreeBusy統合と空きスロットAPI拡張** - `d10d3ed` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/20260222200001_oauth_tokens.sql` - OAuthトークン暗号化テーブル、RPC関数
- `src/lib/integrations/oauth/tokens.ts` - トークン暗号化・復号化・DB保存ユーティリティ
- `src/lib/integrations/oauth/google.ts` - Google OAuth client、認証URL生成、トークン自動リフレッシュ
- `src/lib/utils/retry.ts` - 指数バックオフリトライユーティリティ
- `src/app/api/admin/oauth/google/route.ts` - 認証URL取得API（管理者専用）
- `src/app/api/admin/oauth/google/callback/route.ts` - OAuthコールバック処理
- `src/lib/integrations/google-calendar.ts` - FreeBusy API統合、イベント追加/削除本実装
- `src/app/api/public/slots/route.ts` - busy時間チェックを統合

## Decisions Made

- **pgp_sym_encrypt使用**: PostgreSQLネイティブの暗号化でAES-256相当のセキュリティを確保
- **遅延初期化パターン**: 環境変数未設定時のビルドエラーを回避
- **モックフォールバック**: OAuthトークン未設定時は予約可能を維持（開発時の利便性）
- **'tokens'イベント監視**: googleapisの自動リフレッシュ時にDB更新

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**External services require manual configuration.** This plan added Google OAuth integration.

**Required environment variables:**
- `GOOGLE_CLIENT_ID` - Google Cloud Console -> APIs & Services -> Credentials
- `GOOGLE_CLIENT_SECRET` - Google Cloud Console -> APIs & Services -> Credentials
- `GOOGLE_REDIRECT_URI` - http://localhost:3000/api/admin/oauth/google/callback (開発時)
- `ENCRYPTION_KEY` - `openssl rand -hex 32` で生成した32バイトキー

**Dashboard configuration:**
1. Google Cloud Console -> OAuth consent screen で同意画面を設定
2. Google Cloud Console -> APIs & Services -> Library -> Google Calendar API を有効化
3. OAuth 2.0 Client ID作成時にリダイレクトURIを設定

## Next Phase Readiness

- OAuth基盤完成、04-02でZoom/Resend統合へ進める
- Google Calendar API呼び出しパターン確立済み（retryWithExponentialBackoff）
- 空きスロットAPIがbusy時間を反映済み

## Self-Check: PASSED

- All 8 key files verified to exist on disk
- 2 commits found with "04-01" scope

---
*Phase: 04-external-integrations*
*Completed: 2026-02-22*
