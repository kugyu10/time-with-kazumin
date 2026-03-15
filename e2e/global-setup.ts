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

  // 会員テストユーザー作成
  const { data: memberData } = await supabase.auth.admin.createUser({
    email: process.env.E2E_MEMBER_EMAIL!,
    password: process.env.E2E_MEMBER_PASSWORD!,
    email_confirm: true,
    user_metadata: { name: 'E2E Test Member' },
  })

  // 会員の profiles レコードを作成（RLS対象外のservice_roleで直接INSERT）
  if (memberData?.user) {
    await supabase.from('profiles').upsert({
      id: memberData.user.id,
      email: process.env.E2E_MEMBER_EMAIL!,
      name: 'E2E Test Member',
      role: 'member',
    })

    // member_plans 挿入
    const { data: activePlan } = await supabase
      .from('plans')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (activePlan) {
      await supabase.from('member_plans').upsert({
        user_id: memberData.user.id,
        plan_id: activePlan.id,
        status: 'active',
        current_points: 100,
        monthly_points: 10,
      })
    } else {
      console.warn('[global-setup] plans テーブルにアクティブなプランがありません。会員予約テストが失敗する可能性があります')
    }
  }

  // weekly_schedules 存在確認
  const { count: scheduleCount } = await supabase
    .from('weekly_schedules')
    .select('*', { count: 'exact', head: true })

  if (scheduleCount === 0) {
    console.warn('[global-setup] weekly_schedules が空です。スロット表示テストが失敗する可能性があります')
  }

  // 管理者テストユーザー作成
  const { data: adminData } = await supabase.auth.admin.createUser({
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
    email_confirm: true,
    user_metadata: { name: 'E2E Test Admin' },
  })

  // 管理者の profiles レコードを作成（role: 'admin' を設定）
  if (adminData?.user) {
    await supabase.from('profiles').upsert({
      id: adminData.user.id,
      email: process.env.E2E_ADMIN_EMAIL!,
      name: 'E2E Test Admin',
      role: 'admin',
    })
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
        booking_type: 'guest',
      })
      .eq('guest_token', 'e2e-test-guest-token')
    bookingId = existingBooking.id
  } else {
    const { data: insertedBooking } = await supabase
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
        booking_type: 'guest',
      })
      .select('id')
      .single()
    bookingId = insertedBooking!.id
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
