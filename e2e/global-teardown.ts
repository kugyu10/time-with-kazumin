import { createClient } from '@supabase/supabase-js'

export default async function globalTeardown() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const emails = [
    process.env.E2E_MEMBER_EMAIL!,
    process.env.E2E_ADMIN_EMAIL!,
  ]

  const { data } = await supabase.auth.admin.listUsers()
  for (const email of emails) {
    const user = data?.users.find((u) => u.email === email)
    if (user) {
      await supabase.auth.admin.deleteUser(user.id)
    }
  }
}
