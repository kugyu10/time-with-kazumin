import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

export default async function globalSetup() {
  // storageState ディレクトリを事前作成（Pitfall 3対策）
  const authDir = path.join(__dirname, '.auth')
  fs.mkdirSync(authDir, { recursive: true })

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
}
