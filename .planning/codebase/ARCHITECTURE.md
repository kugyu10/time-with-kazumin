# アーキテクチャ

**分析日:** 2026-02-22

## パターン概要

**全体:** フルスタック Jamstack（Next.js + Supabase）

**主要特性:**
- サーバーレス関数 + マネージド DB を活用したサーバーレスアーキテクチャ
- 外部API連携（Google Calendar, Zoom, Resend）を Route Handlers で統一的に管理
- PostgreSQL トランザクション + 関数によるポイント管理の整合性確保
- RLS（Row-Level Security）による行レベルのアクセス制御

## レイヤー構成

**プレゼンテーション層:**
- 場所: `src/app/`, `src/components/`
- 含まれるもの: Next.js App Router ページコンポーネント、shadcn/ui コンポーネント、フォーム
- 依存先: API Route Handlers、Supabase クライアント（ブラウザ）
- 用途先: ユーザーからのリクエスト受信

**API レイヤー（Route Handlers）:**
- 場所: `src/app/api/`
- 含まれるもの: 外部API連携、複合処理、認証チェック、トランザクション処理
- 依存先: `lib/` の各種ラッパー、Supabase サーバークライアント、service_role キー
- 用途先: フロントエンド、エッジ関数

**外部連携ラッパー層:**
- 場所: `src/lib/google-calendar.ts`, `src/lib/zoom.ts`, `src/lib/email.ts`
- 含まれるもの: Google Calendar API、Zoom API、Resend メール API の薄いラッパー
- 依存先: 環境変数（認証情報）
- 用途先: Route Handlers、Edge Functions

**データ層:**
- 場所: Supabase PostgreSQL
- 含まれるもの: 8テーブル（profiles, plans, member_plans, meeting_menus, weekly_schedules, bookings, point_transactions, app_settings）
- RLS ポリシー、PostgreSQL 関数（ポイント操作）、Edge Functions
- 依存先: 認証情報（Auth.users）
- 用途先: Route Handlers、フロントエンド Supabase クライアント

**自動処理層（Edge Functions）:**
- 場所: `supabase/functions/` （Deno ベース）
- 含まれるもの: 月次ポイント付与（cron）、リマインダーメール（cron）、サンキューメール（cron）
- スケジュール: 毎月1日、毎日9:00 JST、30分ごと
- 依存先: Supabase Admin クライアント、Resend

## データフロー

**予約作成フロー（最重要）:**

1. ユーザーが `POST /api/bookings` をリクエスト（ゲスト or 会員）
2. Route Handler でバリデーション実施
3. ポイント消費（会員のみ、PostgreSQL `consume_points()` 関数）
4. スロット確認（Google Calendar busy時間 + 既存予約との重複チェック）
5. Zoom 会議作成（`lib/zoom.ts` を呼び出し）
6. Google Calendar に管理者イベント追加（`lib/google-calendar.ts`）
7. `bookings` テーブルにレコード挿入
8. 予約確認メール送信（`lib/email.ts` → Resend）
9. 成功レスポンス返却（booking + Zoom URL）

**エラーハンドリング:**
- ステップ3の後でエラー → `refund_points()` で返還
- ステップ5の後でエラー → Zoom 会議削除
- 補償トランザクション（Saga パターン）

**空きスロット取得フロー:**

1. `GET /api/slots?date=2026-03-01` リクエスト
2. 前回同期タイムスタンプ確認（`app_settings.last_calendar_sync`）
3. 経過時間が15分以上 → Google Calendar API 呼び出し
4. freebusy.query でビジー時間取得、events.list で祝日確認
5. `weekly_schedules` で営業時間決定
6. バッファを含めたブロック時間帯生成
7. 既存 `bookings` テーブルと重複チェック
8. 30分スロット単位で利用可能メニューを判定
9. JSON レスポンス返却

**ポイント管理フロー:**

- **付与:** 月初に Edge Function `monthly-point-grant` が実行 → 会員ごとのプラン設定に従い自動付与
- **消費:** 予約時に Route Handler が `consume_points()` PostgreSQL 関数を呼び出し
- **返還:** キャンセル時に `refund_points()` PostgreSQL 関数を呼び出し
- **履歴:** 各操作は `point_transactions` に記録（監査ログ）

**キャンセルフロー:**

1. ユーザーが `DELETE /api/bookings/[id]` をリクエスト
2. 権限チェック（本人 or 管理者）
3. ポイント返還（会員の場合、PostgreSQL `refund_points()`）
4. Zoom 会議削除（`booking.zoom_meeting_id` から）
5. Google Calendar イベント削除（`booking.google_event_id` から）
6. `bookings.status = 'cancelled'` に更新
7. キャンセルメール送信
8. レスポンス返却

## 主要な抽象化

**Supabase クライアント（3パターン）:**
- `lib/supabase/client.ts`: ブラウザ用（Anon キー、RLS あり）
- `lib/supabase/server.ts`: サーバー用（RLS あり）
- `lib/supabase/admin.ts`: 管理者用（service_role キー、RLS バイパス）

**外部API ラッパー:**
- `lib/google-calendar.ts`: freebusy.query, events.insert, events.delete, events.list の薄いラッパー
- `lib/zoom.ts`: Server-to-Server OAuth でクレデンシャル取得、ミーティング作成・削除
- `lib/email.ts`: Resend クライアント + React Email テンプレートのコンポーネント統合

**認証ガード:**
- `src/app/dashboard/layout.tsx`: 会員認証ガード（ユーザー確認）
- `src/app/admin/layout.tsx`: 管理者認証ガード（role === 'admin' 確認）

## エントリーポイント

**ウェブアプリケーション:**
- `src/app/layout.tsx`: メインレイアウト（ナビゲーション、認証状態管理）
- `src/app/page.tsx`: トップページ（サービス説明）

**API エントリーポイント:**
- `POST /api/bookings`: 予約作成（ゲスト・会員共用）
- `DELETE /api/bookings/[id]`: 予約キャンセル（本人・管理者）
- `GET /api/slots`: 空きスロット取得（全員）
- `POST /api/admin/members`: 会員登録（管理者のみ）
- `POST /api/admin/points`: ポイント手動調整（管理者のみ）
- `POST /api/integrations/google-calendar/sync`: Google Calendar 同期（オンデマンド）

**自動処理:**
- `supabase/functions/monthly-point-grant/index.ts`: 毎月1日 0:00 実行
- `supabase/functions/send-reminder/index.ts`: 毎日 9:00 実行
- `supabase/functions/send-thankyou/index.ts`: 毎時 0分、30分実行

## エラーハンドリング戦略

**予約作成の補償トランザクション:**
- ポイント消費後エラー: `refund_points()` で返還
- Zoom 作成後エラー: Zoom 会議削除
- Calendar 追加後エラー: Calendar イベント削除
- 最後に `bookings` レコード未作成で終了 → クライアントに例外返却

**データ整合性:**
- ポイント操作は PostgreSQL 関数（トランザクション）で原子性確保
- RLS ポリシーで不正アクセス防止
- Edge Functions は Supabase Admin クライアント使用（信頼できる環境）

**外部API フォールバック:**
- Google Calendar: 15分キャッシュで API 呼び出し削減
- Zoom: アカウント A/B 割り当てで負荷分散
- メール: 非同期送信（Edge Functions 使用）で失敗しても予約は成立

## クロスカッティング・コンサーン

**ロギング:**
- 予約作成・キャンセルは `point_transactions` テーブルに記録（監査ログ）
- Edge Functions は Supabase ログ、エラーは console.error で記録

**バリデーション:**
- フロント: Zod や Conform で入力検証（UX向上）
- サーバー: Route Handler で再度検証（セキュリティ）
- DB: CHECK 制約、NOT NULL で最後の砦

**認証:**
- Supabase Auth: JWT（HTTPOnly Cookie）
- RLS ポリシー: `auth.uid()` で自動的にアクセス制御
- Route Handlers: `supabase.auth.getUser()` で認証チェック

**認可:**
- `profiles.role` で権限管理（admin / member / guest）
- Route Handlers で `if (role !== 'admin') return 403`
- RLS ポリシーで `auth.jwt() ->> 'user_role' = 'admin'` の条件

---

*アーキテクチャ分析: 2026-02-22*
