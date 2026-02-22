-- =============================================================================
-- Rollback Migration for RLS Policies
-- =============================================================================

-- Drop all policies
DROP POLICY IF EXISTS "Admins can manage app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can view all transactions" ON point_transactions;
DROP POLICY IF EXISTS "Members can view their own transactions" ON point_transactions;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON bookings;
DROP POLICY IF EXISTS "Guests cannot directly access bookings" ON bookings;
DROP POLICY IF EXISTS "Members can cancel their own bookings" ON bookings;
DROP POLICY IF EXISTS "Members can create their own bookings" ON bookings;
DROP POLICY IF EXISTS "Members can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can manage schedules" ON weekly_schedules;
DROP POLICY IF EXISTS "Anyone can view schedules" ON weekly_schedules;
DROP POLICY IF EXISTS "Admins can manage menus" ON meeting_menus;
DROP POLICY IF EXISTS "Anyone can view active menus" ON meeting_menus;
DROP POLICY IF EXISTS "Admins can manage all member plans" ON member_plans;
DROP POLICY IF EXISTS "Members can view their own plan" ON member_plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON plans;
DROP POLICY IF EXISTS "Anyone can view active plans" ON plans;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

-- Disable RLS
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE member_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
