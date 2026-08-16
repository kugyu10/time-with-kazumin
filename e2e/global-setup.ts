import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import * as fs from 'fs'
import * as path from 'path'

export default async function globalSetup() {
  // storageState ディレクトリを事前作成（Pitfall 3対策）
  const authDir = path.join(__dirname, '.auth')
  fs.mkdirSync(authDir, { recursive: true })

  // specs ディレクトリを事前作成
  fs.mkdirSync(path.join(__dirname, 'specs'), { recursive: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 会員テストユーザー作成（既存なら取得）
  const { data: memberData } = await supabase.auth.admin.createUser({
    email: process.env.E2E_MEMBER_EMAIL!,
    password: process.env.E2E_MEMBER_PASSWORD!,
    email_confirm: true,
    user_metadata: { name: 'E2E Test Member' },
  })

  let memberUserId = memberData?.user?.id
  if (!memberUserId) {
    // 既存ユーザーの場合はIDを取得
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users?.users?.find(u => u.email === process.env.E2E_MEMBER_EMAIL!)
    memberUserId = existing?.id
  }

  // 会員の profiles レコードを作成（RLS対象外のservice_roleで直接INSERT）
  if (memberUserId) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: memberUserId,
      email: process.env.E2E_MEMBER_EMAIL!,
      full_name: 'E2E Test Member',
      role: 'member',
    })
    if (profileError) {
      console.warn('[global-setup] profiles upsert error (member):', profileError.message)
    }

    // member_plans 挿入
    const { data: activePlan } = await supabase
      .from('plans')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (activePlan) {
      await supabase.from('member_plans').upsert({
        user_id: memberUserId,
        plan_id: activePlan.id,
        status: 'active',
        current_points: 100,
        monthly_points: 10,
      })
    } else {
      console.warn('[global-setup] plans テーブルにアクティブなプランがありません。会員予約テストが失敗する可能性があります')
    }
  }

  // weekly_schedules 存在確認・投入（月〜金 9:00-17:00）
  const { count: scheduleCount } = await supabase
    .from('weekly_schedules')
    .select('*', { count: 'exact', head: true })
  if (!scheduleCount) {
    const schedules = [1, 2, 3, 4, 5].map(day => ({
      day_of_week: day,
      start_time: '09:00',
      end_time: '17:00',
    }))
    const { error: scheduleError } = await supabase
      .from('weekly_schedules')
      .insert(schedules)
    if (scheduleError) {
      console.warn('[global-setup] weekly_schedules 投入失敗:', scheduleError.message)
    }
  }

  // 管理者テストユーザー作成（既存なら取得）
  const { data: adminData } = await supabase.auth.admin.createUser({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
    email_confirm: true,
    user_metadata: { name: 'E2E Test Admin' },
  })

  let adminUserId = adminData?.user?.id
  if (!adminUserId) {
    const { data: users } = await supabase.auth.admin.listUsers()
    const existing = users?.users?.find(u => u.email === process.env.E2E_ADMIN_EMAIL!)
    adminUserId = existing?.id
  }

  // 管理者の profiles レコードを作成（role: 'admin' を設定）
  if (adminUserId) {
    const { error: adminProfileError } = await supabase.from('profiles').upsert({
      id: adminUserId,
      email: process.env.E2E_ADMIN_EMAIL!,
      full_name: 'E2E Test Admin',
      role: 'admin',
    })
    if (adminProfileError) {
      console.warn('[global-setup] profiles upsert error (admin):', adminProfileError.message)
    }
  }

  // ゲスト予約テスト用 booking レコード挿入
  const { data: activeMenu } = await supabase
    .from('meeting_menus')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!activeMenu) {
    console.warn('[global-setup] meeting_menus が空です。success ページテストが失敗する可能性があります')
    return
  }

  // 明日の 10:00 JST（UTC での 01:00）
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const startTimeStr = `${tomorrow.toISOString().slice(0, 10)}T01:00:00.000Z`
  const endTimeStr = `${tomorrow.toISOString().slice(0, 10)}T01:30:00.000Z`

  // 既存レコードの確認（guest_token による重複チェック）
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id')
    .eq('guest_token', 'e2e-test-guest-token')
    .maybeSingle()

  let bookingId: number

  if (existingBooking) {
    await supabase
      .from('bookings')
      .update({
        guest_name: 'E2E テストゲスト',
        guest_email: 'e2e-guest@example.com',
        start_time: startTimeStr,
        end_time: endTimeStr,
        status: 'confirmed',
        zoom_join_url: 'https://zoom.us/j/e2e-mock-meeting-12345',
        menu_id: activeMenu.id,
      })
      .eq('guest_token', 'e2e-test-guest-token')
    bookingId = existingBooking.id
  } else {
    const { data: insertedBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        guest_token: 'e2e-test-guest-token',
        guest_name: 'E2E テストゲスト',
        guest_email: 'e2e-guest@example.com',
        start_time: startTimeStr,
        end_time: endTimeStr,
        status: 'confirmed',
        zoom_join_url: 'https://zoom.us/j/e2e-mock-meeting-12345',
        menu_id: activeMenu.id,
      })
      .select('id')
      .single()
    if (insertError || !insertedBooking) {
      console.warn('[global-setup] ゲスト予約レコードの挿入に失敗しました:', insertError?.message)
      return
    }
    bookingId = insertedBooking.id
  }

  // cancel_token 生成
  const secret = new TextEncoder().encode(
    process.env.JWT_CANCEL_SECRET || 'default-cancel-secret-do-not-use-in-production'
  )
  const cancelToken = await new SignJWT({
    booking_id: bookingId,
    email: 'e2e-guest@example.com',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  // cancel_token を JSON ファイルに書き出し
  fs.writeFileSync(
    path.join(authDir, 'e2e-tokens.json'),
    JSON.stringify({ guest_token: 'e2e-test-guest-token', cancel_token: cancelToken })
  )
}
