/**
 * Point Overflow Notify Edge Function
 *
 * 毎月20日に実行され、翌月付与でポイントが上限を超える予定の会員にリマインダーメールを送信する
 * - 冪等性チェック: task_execution_logs に当月分の point_overflow_notify が存在する場合はスキップ
 * - 溢れ判定: current_points + monthly_points > max_points (D-05)
 * - Resend でメール送信（リトライロジック付き）
 * - task_execution_logs 記録 (D-11)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface MemberPlan {
  id: string
  current_points: number
  monthly_points: number
  user: {
    email: string
    full_name: string
  }
  plan: {
    max_points: number
  }
}

Deno.serve(async (req) => {
  // 認証ヘッダー検証
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('FROM_EMAIL')
  const siteUrl = Deno.env.get('SITE_URL') || 'https://time-with-kazumin.vercel.app'

  if (!resendApiKey || !fromEmail) {
    console.warn('[PointOverflow] Resend not configured, skipping')
    return new Response(
      JSON.stringify({ success: true, message: 'Resend not configured' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const startedAt = new Date().toISOString()

  try {
    // 冪等性チェック: 当月分の point_overflow_notify が既に処理済みか確認 (D-09)
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data: existingLog, error: checkError } = await supabase
      .from('task_execution_logs')
      .select('id')
      .eq('task_name', 'point_overflow_notify')
      .in('status', ['success', 'partial_success'])
      .gte('started_at', `${currentMonth}-01T00:00:00Z`)
      .lt('started_at', `${currentMonth}-31T23:59:59Z`)
      .limit(1)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Idempotency check failed: ${checkError.message}`)
    }

    if (existingLog) {
      // 既に今月分が処理済み
      await supabase
        .from('task_execution_logs')
        .insert({
          task_name: 'point_overflow_notify',
          status: 'success',
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          total_count: 0,
          success_count: 0,
          failed_count: 0,
          details: { message: 'Already processed this month', month: currentMonth },
        })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Already processed this month',
          month: currentMonth,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 溢れ対象会員クエリ: アクティブ会員を member_plans + plans で JOIN (D-05)
    const { data: members, error: fetchError } = await supabase
      .from('member_plans')
      .select(`
        id,
        current_points,
        monthly_points,
        user:profiles!inner (
          email,
          full_name
        ),
        plan:plans!inner (
          max_points
        )
      `)
      .eq('status', 'active')
      .not('plan.max_points', 'is', null)

    if (fetchError) {
      throw new Error(`Failed to fetch members: ${fetchError.message}`)
    }

    // アプリ層フィルタ: current_points + monthly_points > max_points (D-05)
    const targets = (members as unknown as MemberPlan[]).filter(
      (m) => m.current_points + m.monthly_points > m.plan.max_points
    )

    if (targets.length === 0) {
      // 対象者なし
      await supabase.from('task_execution_logs').insert({
        task_name: 'point_overflow_notify',
        status: 'success',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        total_count: 0,
        success_count: 0,
        failed_count: 0,
        details: { message: 'No overflow targets found', month: currentMonth },
      })

      return new Response(
        JSON.stringify({ success: true, message: 'No overflow targets found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // メール送信ループ
    let successCount = 0
    let failedCount = 0
    const errors: Array<{ member_plan_id: string; error: string }> = []
    const bookingUrl = `${siteUrl}/bookings/new`

    for (const member of targets) {
      try {
        const overflow = member.current_points + member.monthly_points - member.plan.max_points // D-06
        const emailHtml = renderPointOverflowHtml({
          userName: member.user.full_name,
          currentPoints: member.current_points,
          monthlyPoints: member.monthly_points,
          maxPoints: member.plan.max_points,
          overflow,
          bookingUrl,
        })

        await sendEmailWithRetry(
          resendApiKey,
          fromEmail,
          member.user.email,
          '【かずみん時間】ポイントがもったいないです！',
          emailHtml
        )

        successCount++
      } catch (error) {
        failedCount++
        errors.push({
          member_plan_id: member.id,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error(`[PointOverflow] Failed for member_plan ${member.id}:`, error)
      }
    }

    // task_execution_logs 記録 (D-07, D-11)
    const status = failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed'
    await supabase.from('task_execution_logs').insert({
      task_name: 'point_overflow_notify',
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      total_count: targets.length,
      success_count: successCount,
      failed_count: failedCount,
      details: { month: currentMonth, targets_found: targets.length },
      error_details: errors.length > 0 ? errors : null,
    })

    return new Response(
      JSON.stringify({
        success: true,
        total: targets.length,
        success_count: successCount,
        failed_count: failedCount,
        status,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[PointOverflow] Task failed:', error)

    await supabase.from('task_execution_logs').insert({
      task_name: 'point_overflow_notify',
      status: 'failed',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      total_count: 0,
      success_count: 0,
      failed_count: 0,
      error_details: {
        error: error instanceof Error ? error.message : String(error),
      },
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * ポイント溢れ通知メールのインライン HTML を生成 (D-01, D-02, D-03)
 */
function renderPointOverflowHtml(props: {
  userName: string
  currentPoints: number
  monthlyPoints: number
  maxPoints: number
  overflow: number
  bookingUrl: string
}): string {
  const { userName, currentPoints, monthlyPoints, maxPoints, overflow, bookingUrl } = props

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="padding: 24px;">
      <h1 style="font-size: 24px; font-weight: bold; color: #1a1a1a; margin-bottom: 16px;">
        ${userName}さん、ポイントがもったいないです!
      </h1>

      <p style="font-size: 16px; line-height: 26px; color: #4a4a4a;">
        来月のポイント付与で、ポイントが上限を超えてしまいます。<br>
        せっかくのポイントが無駄になる前に、ぜひかずみんに会いに来てください！
      </p>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">現在のポイント</p>
        <p style="font-size: 16px; color: #1a1a1a; margin-top: 0; margin-bottom: 16px;">${currentPoints}ポイント</p>

        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">月次付与</p>
        <p style="font-size: 16px; color: #1a1a1a; margin-top: 0; margin-bottom: 16px;">+${monthlyPoints}ポイント</p>

        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">ポイント上限</p>
        <p style="font-size: 16px; color: #1a1a1a; margin-top: 0; margin-bottom: 16px;">${maxPoints}ポイント</p>

        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">溢れるポイント</p>
        <p style="font-size: 16px; color: #dc2626; font-weight: bold; margin-top: 0; margin-bottom: 0;">${overflow}ポイントが使えなくなります！</p>
      </div>

      <hr style="border-color: #e5e7eb; margin-top: 24px; margin-bottom: 24px;" />

      <div style="text-align: center; margin-bottom: 12px;">
        <a href="${bookingUrl}" style="background-color: #2563eb; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 12px 24px;">
          今すぐ予約する
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 16px;">
        かずみん、時間空いてる？
      </p>
    </div>
  </div>
</body>
</html>
`
}

/**
 * メール送信（リトライロジック付き）
 */
async function sendEmailWithRetry(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Resend API error: ${response.status} ${error}`)
      }

      // 成功したらループを抜ける
      return
    } catch (error) {
      console.error(`[Email] Attempt ${attempt}/${maxRetries} failed:`, error)
      if (attempt === maxRetries) {
        throw error
      }
      // 即時リトライ
    }
  }
}
