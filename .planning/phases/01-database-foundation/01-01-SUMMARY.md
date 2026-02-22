# Plan 01-01 Summary: スキーマとマイグレーション基盤

**完了日:** 2026-02-22
**ステータス:** 完了

## 成果物

### 作成されたテーブル（8テーブル）

```
┌─────────────────────┐      ┌─────────────────────┐
│    profiles         │      │      plans          │
│  (ユーザー情報)       │      │  (サブスクプラン)    │
└─────────────────────┘      └─────────────────────┘
         │                            │
         └──────────┬─────────────────┘
                    ▼
         ┌─────────────────────┐
         │   member_plans      │
         │ (会員プラン+残高)    │
         └─────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌─────────────────────┐  ┌─────────────────────┐
│  point_transactions │  │     bookings        │
│    (ポイント履歴)     │  │     (予約)          │
└─────────────────────┘  └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   meeting_menus     │
                    │   (セッション種別)   │
                    └─────────────────────┘

独立テーブル:
┌─────────────────────┐  ┌─────────────────────┐
│  weekly_schedules   │  │    app_settings     │
│    (営業時間)        │  │   (アプリ設定)       │
└─────────────────────┘  └─────────────────────┘
```

### テーブル詳細

| テーブル | 目的 | 主要カラム |
|---------|------|-----------|
| profiles | ユーザー情報（Supabase Auth連携） | id (UUID), email, full_name, role |
| plans | サブスクプラン定義 | name, monthly_points, max_points, price_monthly |
| member_plans | 会員のプラン契約+ポイント残高 | user_id, plan_id, current_points, status |
| meeting_menus | セッション種別 | name, duration_minutes, points_required, zoom_account |
| weekly_schedules | 営業時間設定 | day_of_week, start_time, end_time |
| point_transactions | ポイント操作履歴（監査証跡） | points, transaction_type, balance_after |
| bookings | 予約 | start_time, end_time, status, guest_token |
| app_settings | アプリ設定（KV形式） | key, value |

### 実装された制約

1. **EXCLUDE制約（二重予約防止）**
   - `bookings.no_overlapping_bookings`: 時間範囲の重複を自動防止
   - canceledステータスは除外（再予約可能）

2. **CHECK制約**
   - `member_plans.positive_points`: ポイント残高 >= 0
   - `bookings.valid_booking_time_range`: start_time < end_time
   - `bookings.member_or_guest`: 会員かゲストのどちらか必須

3. **外部キーインデックス**
   - 全外部キーカラムにインデックス作成済み
   - RLSポリシーで参照されるカラムも最適化

### シードデータ

**plans（4レコード）:**
- 無料プラン: 0pt/月, 上限0
- ベーシックプラン: 400pt/月, 上限800
- スタンダードプラン: 1000pt/月, 上限2000
- プレミアムプラン: 2000pt/月, 上限4000

**meeting_menus（4レコード）:**
- カジュアル30分: 0pt, Zoom B（ゲスト用）
- ショートセッション: 100pt, Zoom A
- スタンダードセッション: 200pt, Zoom A
- ロングセッション: 300pt, Zoom A

**weekly_schedules（5レコード）:**
- 月〜金 10:00-18:00

## ファイル一覧

| ファイル | 行数 | 目的 |
|---------|------|------|
| supabase/migrations/20260222000001_initial_schema.sql | ~180 | 8テーブル+制約+インデックス+トリガー |
| supabase/rollback/20260222000001_initial_schema_down.sql | ~25 | ロールバック用 |
| supabase/seed.sql | ~30 | マスターデータ |

## Phase 2への引き継ぎ事項

1. **Stored Procedures呼び出し方法**
   - `supabase.rpc('consume_points', { p_member_plan_id: ..., p_points: ... })`
   - ロック取得失敗時（55P03エラー）はリトライロジック実装が必要

2. **ゲスト予約作成**
   - `guest_token`は自動生成（トリガー）
   - API経由でservice_roleを使用してINSERT

3. **タイムゾーン処理**
   - 全時刻はTIMESTAMPTZ（UTC保存、取得時に変換）
   - アプリケーション層でISO 8601形式で送受信
