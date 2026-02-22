# コードベース構造

**分析日:** 2026-02-22

## ディレクトリレイアウト

```
time-with-kazumin/
├── .env.local                  # 環境変数（secrets は含めない）
├── .env.example                # 環境変数テンプレート
├── next.config.ts              # Next.js 設定
├── package.json                # 依存パッケージ
├── tsconfig.json               # TypeScript 設定
├── tailwind.config.ts          # Tailwind CSS 設定
│
├── supabase/                   # Supabase プロジェクト設定
│   ├── config.toml             # 基本設定
│   ├── migrations/             # DB マイグレーション
│   │   ├── 001_create_profiles.sql
│   │   ├── 002_create_plans.sql
│   │   ├── 003_create_member_plans.sql
│   │   ├── 004_create_meeting_menus.sql
│   │   ├── 005_create_weekly_schedules.sql
│   │   ├── 006_create_bookings.sql
│   │   ├── 007_create_point_transactions.sql
│   │   ├── 008_create_app_settings.sql
│   │   ├── 009_create_rls_policies.sql
│   │   └── 010_create_point_functions.sql
│   ├── seed.sql                # 初期データ（管理者、プラン、メニュー、営業時間）
│   └── functions/              # Edge Functions（Deno）
│       ├── monthly-point-grant/
│       │   └── index.ts        # 毎月1日 0:00 - ポイント自動付与
│       ├── send-reminder/
│       │   └── index.ts        # 毎日 9:00 - リマインダーメール送信
│       └── send-thankyou/
│           └── index.ts        # 毎時 0分, 30分 - サンキューメール送信
│
├── src/
│   ├── app/                    # Next.js App Router ページ・API
│   │   ├── layout.tsx          # メインレイアウト（認証、ナビゲーション）
│   │   ├── page.tsx            # トップページ（サービス説明）
│   │   │
│   │   ├── (auth)/             # 認証ページ（レイアウトグループ）
│   │   │   ├── login/
│   │   │   │   └── page.tsx    # ログイン画面（Google OAuth + メール/パスワード）
│   │   │   └── callback/
│   │   │       └── route.ts    # OAuth コールバック（認証処理）
│   │   │
│   │   ├── booking/            # 顧客向け予約フロー
│   │   │   ├── page.tsx        # スロット選択 + セッション選択
│   │   │   ├── confirm/
│   │   │   │   └── page.tsx    # 予約確認画面
│   │   │   └── complete/
│   │   │       └── page.tsx    # 予約完了画面（Zoom リンク）
│   │   │
│   │   ├── dashboard/          # 会員向けマイページ（認証ガード）
│   │   │   ├── layout.tsx      # 認証チェック（ユーザー確認）
│   │   │   ├── page.tsx        # マイページ（ポイント残高 + 予約概要）
│   │   │   └── bookings/
│   │   │       └── page.tsx    # 予約一覧（キャンセル機能）
│   │   │
│   │   ├── admin/              # 管理者画面（認証ガード）
│   │   │   ├── layout.tsx      # admin ロール確認
│   │   │   ├── page.tsx        # ダッシュボード（今日の予約概要）
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx    # 予約管理（全予約一覧、ステータス変更）
│   │   │   ├── slots/
│   │   │   │   └── page.tsx    # スケジュール管理（曜日別営業時間、祝日）
│   │   │   ├── members/
│   │   │   │   ├── page.tsx    # 会員一覧（招待、退会）
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # 個別会員詳細（ポイント履歴、予約履歴）
│   │   │   ├── meeting-menus/
│   │   │   │   └── page.tsx    # メニュー管理（CRUD）
│   │   │   └── plans/
│   │   │       └── page.tsx    # プラン管理（CRUD）
│   │   │
│   │   └── api/                # API Route Handlers
│   │       ├── bookings/
│   │       │   ├── route.ts    # POST /api/bookings - 予約作成
│   │       │   └── [id]/
│   │       │       └── route.ts # DELETE /api/bookings/[id] - キャンセル
│   │       │
│   │       ├── slots/
│   │       │   └── route.ts    # GET /api/slots - 空きスロット取得（Google Calendar 同期）
│   │       │
│   │       ├── admin/
│   │       │   ├── members/
│   │       │   │   ├── route.ts # POST /api/admin/members - 会員登録
│   │       │   │   └── [id]/
│   │       │   │       └── route.ts # DELETE /api/admin/members/[id] - 退会処理
│   │       │   └── points/
│   │       │       └── route.ts # POST /api/admin/points - ポイント手動調整
│   │       │
│   │       └── integrations/
│   │           └── google-calendar/
│   │               └── sync/
│   │                   └── route.ts # POST - Google Calendar 同期（オンデマンド）
│   │
│   ├── lib/                    # ユーティリティと外部連携ラッパー
│   │   ├── supabase/
│   │   │   ├── client.ts       # ブラウザ用 Supabase クライアント（RLS 有効）
│   │   │   ├── server.ts       # サーバー用 Supabase クライアント（RLS 有効）
│   │   │   └── admin.ts        # 管理者用 Supabase クライアント（RLS バイパス）
│   │   │
│   │   ├── google-calendar.ts  # Google Calendar API ラッパー
│   │   │                        # - freebusy.query（空き/ビジー取得）
│   │   │                        # - events.insert（イベント追加）
│   │   │                        # - events.delete（イベント削除）
│   │   │                        # - events.list（祝日確認）
│   │   │
│   │   ├── zoom.ts             # Zoom API ラッパー
│   │   │                        # - Server-to-Server OAuth トークン取得
│   │   │                        # - createZoomMeeting（ミーティング作成、アカウント A/B 切り替え）
│   │   │                        # - deleteZoomMeeting（ミーティング削除）
│   │   │
│   │   ├── email.ts            # メール送信ラッパー（Resend）
│   │   │                        # - React Email テンプレート統合
│   │   │                        # - 送信エラーハンドリング
│   │   │
│   │   └── utils.ts            # その他ユーティリティ
│   │                            # - タイムゾーン変換（JST）
│   │                            # - スロット生成ロジック
│   │                            # - バッファ計算
│   │
│   ├── components/             # React コンポーネント
│   │   ├── ui/                 # shadcn/ui コンポーネント（自動生成）
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   └── ... その他 UI 部品
│   │   │
│   │   ├── booking/            # 予約フロー用コンポーネント
│   │   │   ├── SlotPicker.tsx  # カレンダー + スロット選択
│   │   │   ├── SessionSelect.tsx # メニュー選択
│   │   │   ├── BookingForm.tsx # 予約フォーム（ゲスト名＋メール or 会員）
│   │   │   └── ConfirmDialog.tsx # 確認ダイアログ
│   │   │
│   │   ├── dashboard/          # 会員向けコンポーネント
│   │   │   ├── PointBalance.tsx # ポイント残高表示
│   │   │   └── BookingList.tsx  # 予約一覧（フィルタ + キャンセル）
│   │   │
│   │   └── admin/              # 管理者向けコンポーネント
│   │       ├── SlotCalendar.tsx # スケジュール編集
│   │       ├── BookingTable.tsx # 予約一覧表示 + ステータス変更
│   │       ├── MemberTable.tsx  # 会員一覧
│   │       └── PointAdjustForm.tsx # ポイント調整フォーム
│   │
│   ├── emails/                 # React Email テンプレート
│   │   ├── BookingConfirmed.tsx # 予約確認メール
│   │   ├── BookingCancelled.tsx # キャンセルメール
│   │   ├── BookingReminder.tsx  # リマインダーメール
│   │   └── BookingThankyou.tsx  # サンキューメール
│   │
│   └── types/
│       └── database.ts         # Supabase 型定義（`supabase gen types` で自動生成）
│                               # - profiles, plans, member_plans, bookings 等の型
│
└── public/                     # 静的ファイル（画像、フォント）
    ├── favicon.ico
    └── ... その他 assets
```

## ディレクトリの目的

**supabase/:**
- DB スキーマ管理（マイグレーション）
- 初期データセット（seed）
- Edge Functions（Deno ベースの自動処理）

**src/app/:**
- Next.js ページコンポーネント（App Router）
- ページレイアウト、ルートグループによる画面体系化
- API Route Handlers（バックエンド）

**src/lib/:**
- 外部 API のラッパー関数（DRY 原則）
- Supabase クライアントの初期化（環境に応じた3パターン）
- ユーティリティ関数（タイムゾーン、スロット計算）

**src/components/:**
- UI コンポーネント（shadcn/ui）
- 機能別コンポーネント（booking, dashboard, admin）
- メールテンプレート（React Email）

## ファイル配置の鍵

**エントリーポイント:**
- `src/app/layout.tsx`: メイン入口（すべてのページの親）
- `src/app/page.tsx`: トップページ
- `src/app/api/`: API の入口

**設定ファイル:**
- `next.config.ts`: Next.js 設定
- `tailwind.config.ts`: デザインシステム（ブランドカラー定義）
- `tsconfig.json`: 型チェック設定
- `supabase/config.toml`: Supabase 設定

**主要なロジック:**
- 予約作成: `src/app/api/bookings/route.ts`
- 空きスロット: `src/app/api/slots/route.ts`
- ポイント管理: `supabase/migrations/010_create_point_functions.sql`（PostgreSQL 関数）

## 命名規則

**ファイル:**
- ページコンポーネント: `page.tsx`
- API Route: `route.ts`
- コンポーネント: PascalCase（例: `SlotPicker.tsx`）
- ユーティリティ: camelCase（例: `google-calendar.ts`）
- マイグレーション: `NNN_description.sql`（例: `001_create_profiles.sql`）

**ディレクトリ:**
- 機能ごと（例: `booking/`, `admin/`, `dashboard/`）
- API パスに合わせる（例: `api/bookings/`）
- ケバブケース（例: `google-calendar.ts`）

## 新規コード追加ガイドライン

**新機能の実装:**

1. **API が必要な場合:**
   - Route Handler を `src/app/api/[feature]/route.ts` に作成
   - 複雑なロジックは `src/lib/` に抽出

2. **UI コンポーネントが必要な場合:**
   - `src/components/[feature]/ComponentName.tsx` に配置
   - 汎用 UI は `src/components/ui/` から使用

3. **外部 API 連携の場合:**
   - `src/lib/` にラッパー関数を作成（例: `src/lib/new-service.ts`）
   - Route Handler からは薄くラッパーを呼び出すだけ

4. **DB スキーマ変更の場合:**
   - `supabase/migrations/NNN_description.sql` を作成
   - `supabase migration up` で実行

5. **定期実行の場合:**
   - Edge Function を `supabase/functions/feature-name/index.ts` に作成
   - `supabase/config.toml` で cron スケジュール設定

**テストの配置:**
- コンポーネント: `src/components/__tests__/` or `.test.tsx`（co-located）
- API: `src/app/api/__tests__/` or `route.test.ts`
- ユーティリティ: `src/lib/__tests__/` or `.test.ts`

## 特別なディレクトリ

**supabase/functions/:**
- Deno Runtime で動作
- 自動デプロイ（`supabase deploy` で Vercel 連携）
- スケジュール実行の定義は `supabase/config.toml` に記述

**src/types/database.ts:**
- `supabase gen types typescript --local > src/types/database.ts` で自動生成
- コミット対象（型安全性のため）
- 手動編集不可（マイグレーション実行後に再生成）

**src/emails/:**
- React Email フレームワーク
- Resend で送信（メール配信サービス）
- tsx ファイルで HTML をコンポーネント化

---

*構造分析: 2026-02-22*
