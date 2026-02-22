-- =============================================================================
-- Initial Schema Migration for Time with Kazumin
-- =============================================================================
-- Phase 1: データベース基盤
-- 8テーブル定義、EXCLUDE制約による二重予約防止、インデックス、トリガー
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. profiles テーブル（Supabase Authと連携）
-- =============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('guest', 'member', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. plans テーブル（サブスクプラン定義）
-- =============================================================================
CREATE TABLE plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_points INTEGER NOT NULL,
    max_points INTEGER,  -- 繰り越し上限、NULLは無制限
    price_monthly DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. member_plans テーブル（会員のプラン契約と残高）
-- =============================================================================
CREATE TABLE member_plans (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    current_points INTEGER NOT NULL DEFAULT 0,
    monthly_points INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_points CHECK (current_points >= 0)
);

-- =============================================================================
-- 4. meeting_menus テーブル（セッション種別）
-- =============================================================================
CREATE TABLE meeting_menus (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    points_required INTEGER NOT NULL,
    zoom_account TEXT NOT NULL CHECK (zoom_account IN ('A', 'B')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. weekly_schedules テーブル（営業時間設定）
-- =============================================================================
CREATE TABLE weekly_schedules (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=日曜
    is_holiday_pattern BOOLEAN NOT NULL DEFAULT false,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- =============================================================================
-- 6. point_transactions テーブル（監査証跡）
-- =============================================================================
CREATE TABLE point_transactions (
    id SERIAL PRIMARY KEY,
    member_plan_id INTEGER NOT NULL REFERENCES member_plans(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('consume', 'refund', 'monthly_grant', 'manual_adjust')),
    reference_id INTEGER,  -- booking_idなど
    notes TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. bookings テーブル（予約）
-- =============================================================================
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    member_plan_id INTEGER REFERENCES member_plans(id) ON DELETE SET NULL,
    menu_id INTEGER NOT NULL REFERENCES meeting_menus(id),
    guest_email TEXT,
    guest_name TEXT,
    guest_token TEXT UNIQUE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'canceled')),
    zoom_meeting_id TEXT,
    zoom_join_url TEXT,
    google_event_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- 二重予約防止（EXCLUDE制約 + btree_gist）
    CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status != 'canceled'),
    -- 時間制約
    CONSTRAINT valid_booking_time_range CHECK (start_time < end_time),
    -- 会員またはゲストのいずれかが必須
    CONSTRAINT member_or_guest CHECK (
        (member_plan_id IS NOT NULL AND guest_email IS NULL)
        OR
        (member_plan_id IS NULL AND guest_email IS NOT NULL)
    )
);

-- =============================================================================
-- 8. app_settings テーブル（アプリ設定）
-- =============================================================================
CREATE TABLE app_settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- インデックス（全外部キー + パフォーマンス最適化）
-- =============================================================================
CREATE INDEX idx_member_plans_user_id ON member_plans(user_id);
CREATE INDEX idx_member_plans_plan_id ON member_plans(plan_id);
CREATE INDEX idx_point_transactions_member_plan_id ON point_transactions(member_plan_id);
CREATE INDEX idx_bookings_member_plan_id ON bookings(member_plan_id);
CREATE INDEX idx_bookings_menu_id ON bookings(menu_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time) WHERE status != 'canceled';
CREATE INDEX idx_bookings_guest_token ON bookings(guest_token) WHERE guest_token IS NOT NULL;

-- =============================================================================
-- updated_at 自動更新トリガー
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_plans_updated_at
    BEFORE UPDATE ON member_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_menus_updated_at
    BEFORE UPDATE ON meeting_menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_schedules_updated_at
    BEFORE UPDATE ON weekly_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ゲストトークン自動生成トリガー
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_guest_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.guest_email IS NOT NULL AND NEW.guest_token IS NULL THEN
        NEW.guest_token := uuid_generate_v4()::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_guest_token
    BEFORE INSERT ON bookings
    FOR EACH ROW EXECUTE FUNCTION generate_guest_token();
