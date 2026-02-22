-- =============================================================================
-- Row Level Security (RLS) Policies for Time with Kazumin
-- =============================================================================
-- Phase 1: JWT ClaimベースのRLSポリシー
-- guest, member, admin の3ロール対応
-- =============================================================================

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- profiles テーブル
-- =============================================================================
-- 会員: 自分のプロフィールのみ参照可能
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 会員: 自分のプロフィールのみ更新可能
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 管理者: 全プロフィール参照可能
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- 管理者: 全プロフィール更新可能
CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- 管理者: プロフィール作成可能（会員招待時）
CREATE POLICY "Admins can insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- =============================================================================
-- plans テーブル
-- =============================================================================
-- 全員: アクティブなプラン一覧参照可能（公開情報）
CREATE POLICY "Anyone can view active plans"
ON plans FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 管理者: プラン管理（作成・更新・削除）
CREATE POLICY "Admins can manage plans"
ON plans FOR ALL
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- =============================================================================
-- member_plans テーブル
-- =============================================================================
-- 会員: 自分のプラン契約のみ参照可能
CREATE POLICY "Members can view their own plan"
ON member_plans FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 管理者: 全会員プラン参照・管理可能
CREATE POLICY "Admins can manage all member plans"
ON member_plans FOR ALL
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- =============================================================================
-- meeting_menus テーブル
-- =============================================================================
-- 全員: アクティブなメニュー一覧参照可能（公開情報）
CREATE POLICY "Anyone can view active menus"
ON meeting_menus FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 管理者: メニュー管理
CREATE POLICY "Admins can manage menus"
ON meeting_menus FOR ALL
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- =============================================================================
-- weekly_schedules テーブル
-- =============================================================================
-- 全員: 営業時間参照可能（空きスロット計算で使用）
CREATE POLICY "Anyone can view schedules"
ON weekly_schedules FOR SELECT
TO anon, authenticated
USING (true);

-- 管理者: 営業時間管理
CREATE POLICY "Admins can manage schedules"
ON weekly_schedules FOR ALL
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- =============================================================================
-- bookings テーブル
-- =============================================================================
-- 会員: 自分の予約のみ参照可能
CREATE POLICY "Members can view their own bookings"
ON bookings FOR SELECT
TO authenticated
USING (
    member_plan_id IN (
        SELECT id FROM member_plans WHERE user_id = auth.uid()
    )
);

-- 会員: 自分の予約を作成可能
CREATE POLICY "Members can create their own bookings"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (
    member_plan_id IN (
        SELECT id FROM member_plans WHERE user_id = auth.uid()
    )
);

-- 会員: 自分の予約をキャンセル可能（ステータス更新）
CREATE POLICY "Members can cancel their own bookings"
ON bookings FOR UPDATE
TO authenticated
USING (
    member_plan_id IN (
        SELECT id FROM member_plans WHERE user_id = auth.uid()
    )
)
WITH CHECK (status IN ('confirmed', 'canceled'));

-- ゲスト: anonキーでの直接アクセスは禁止
-- Note: ゲスト予約はAPI経由でservice_roleを使用
CREATE POLICY "Guests cannot directly access bookings"
ON bookings FOR SELECT
TO anon
USING (false);

-- 管理者: 全予約参照・管理可能
CREATE POLICY "Admins can manage all bookings"
ON bookings FOR ALL
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- =============================================================================
-- point_transactions テーブル
-- =============================================================================
-- 会員: 自分のポイント履歴のみ参照可能
CREATE POLICY "Members can view their own transactions"
ON point_transactions FOR SELECT
TO authenticated
USING (
    member_plan_id IN (
        SELECT id FROM member_plans WHERE user_id = auth.uid()
    )
);

-- 管理者: 全履歴参照可能（監査目的）
CREATE POLICY "Admins can view all transactions"
ON point_transactions FOR SELECT
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');

-- Note: INSERTはStored Procedureのみ許可（直接挿入は禁止）

-- =============================================================================
-- app_settings テーブル
-- =============================================================================
-- 管理者のみアクセス可能（システム設定）
CREATE POLICY "Admins can manage app settings"
ON app_settings FOR ALL
TO authenticated
USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role')::TEXT = 'admin');
