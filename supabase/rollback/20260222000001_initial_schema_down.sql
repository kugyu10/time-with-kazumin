-- =============================================================================
-- Rollback Migration for Initial Schema
-- =============================================================================

-- Triggers
DROP TRIGGER IF EXISTS set_guest_token ON bookings;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS update_weekly_schedules_updated_at ON weekly_schedules;
DROP TRIGGER IF EXISTS update_meeting_menus_updated_at ON meeting_menus;
DROP TRIGGER IF EXISTS update_member_plans_updated_at ON member_plans;
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Functions
DROP FUNCTION IF EXISTS generate_guest_token();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Indexes (dropped with tables via CASCADE)

-- Tables (逆順で削除)
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS point_transactions CASCADE;
DROP TABLE IF EXISTS weekly_schedules CASCADE;
DROP TABLE IF EXISTS meeting_menus CASCADE;
DROP TABLE IF EXISTS member_plans CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Extensions
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS btree_gist;
