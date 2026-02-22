/**
 * Check Reminder Emails Edge Function
 *
 * 15分ごとに実行され、24時間後のセッションにリマインダーメールを送信する
 * - 24時間後の予約を抽出（±15分ウィンドウ）
 * - 会員/ゲスト両対応
 * - Resendでメール送信
 * - reminder_sent_atフラグを更新（重複防止）
 * - task_execution_logs記録
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Booking {
  id: string
  start_time: string
  guest_email: string | null
  member_plans: {
    user: {
      email: string
      full_name: string
    }
  } | null
  meeting_menus: {
    title: string
  }
  zoom_join_url: string | null
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
  const adminEmail = Deno.env.get('ADMIN_EMAIL')

  if (!resendApiKey || !fromEmail) {
    console.warn('[Reminder] Resend not configured, skipping')
    return new Response(
      JSON.stringify({ success: true, message: 'Resend not configured' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const startedAt = new Date().toISOString()

  try {
    // 24時間後のウィンドウを計算（±15分）
    const now = new Date()
    const targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // +24時間
    const windowStart = new Date(targetTime.getTime() - 15 * 60 * 1000) // -15分
    const windowEnd = new Date(targetTime.getTime() + 15 * 60 * 1000) // +15分

    // 対象予約を抽出
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        start_time,
        guest_email,
        zoom_join_url,
        member_plans!inner (
          user:profiles!inner (
            email,
            full_name
          )
        ),
        meeting_menus!inner (
          title
        )
      `)
      .eq('status', 'confirmed')
      .is('reminder_sent_at', null)
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`)
    }

    if (!bookings || bookings.length === 0) {
      // 対象なし
      await supabase.from('task_execution_logs').insert({
        task_name: 'reminder_email',
        status: 'success',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        total_count: 0,
        success_count: 0,
        failed_count: 0,
        details: { message: 'No bookings in window' },
      })

      return new Response(
        JSON.stringify({ success: true, message: 'No bookings to remind' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // メール送信処理
    let successCount = 0
    let failedCount = 0
    const errors: Array<{ booking_id: string; error: string }> = []

    for (const booking of bookings as unknown as Booking[]) {
      try {
        // ユーザー情報を取得（会員 or ゲスト）
        const userEmail = booking.member_plans?.user?.email || booking.guest_email
        const userName = booking.member_plans?.user?.full_name || 'ゲスト様'

        if (!userEmail) {
          throw new Error('No user email found')
        }

        const sessionTitle = booking.meeting_menus?.title || 'セッション'
        const zoomJoinUrl = booking.zoom_join_url || 'https://zoom.us'

        // BookingReminderテンプレートのHTML生成
        const emailHtml = await renderBookingReminder({
          userName,
          sessionTitle,
          startTime: booking.start_time,
          zoomJoinUrl,
          isAdminCopy: false,
        })

        const adminEmailHtml = await renderBookingReminder({
          userName,
          sessionTitle,
          startTime: booking.start_time,
          zoomJoinUrl,
          isAdminCopy: true,
        })

        // メール送信（ユーザー + 管理者）
        await sendEmailWithRetry(
          resendApiKey,
          fromEmail,
          userEmail,
          `明日のセッションリマインダー: ${sessionTitle}`,
          emailHtml
        )

        if (adminEmail) {
          await sendEmailWithRetry(
            resendApiKey,
            fromEmail,
            adminEmail,
            `[管理者通知] 明日のセッション: ${sessionTitle}`,
            adminEmailHtml
          )
        }

        // reminder_sent_atフラグを更新
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', booking.id)

        if (updateError) {
          throw new Error(`Failed to update reminder_sent_at: ${updateError.message}`)
        }

        // 個別ログ記録
        await supabase.from('task_execution_logs').insert({
          task_name: 'reminder_email',
          status: 'success',
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          reference_type: 'booking',
          reference_id: booking.id,
          total_count: 1,
          success_count: 1,
          failed_count: 0,
          details: { email: userEmail, session: sessionTitle },
        })

        successCount++
      } catch (error) {
        failedCount++
        errors.push({
          booking_id: booking.id,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error(`[Reminder] Failed for booking ${booking.id}:`, error)
      }
    }

    // バッチログ記録
    const status = failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed'
    await supabase.from('task_execution_logs').insert({
      task_name: 'reminder_email',
      status,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      total_count: bookings.length,
      success_count: successCount,
      failed_count: failedCount,
      error_details: errors.length > 0 ? errors : null,
    })

    return new Response(
      JSON.stringify({
        success: true,
        total: bookings.length,
        success_count: successCount,
        failed_count: failedCount,
        status,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Reminder] Task failed:', error)

    await supabase.from('task_execution_logs').insert({
      task_name: 'reminder_email',
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
 * BookingReminderテンプレートのHTMLを生成
 */
async function renderBookingReminder(props: {
  userName: string
  sessionTitle: string
  startTime: string
  zoomJoinUrl: string
  isAdminCopy: boolean
}): Promise<string> {
  const { userName, sessionTitle, startTime, zoomJoinUrl, isAdminCopy } = props

  // 日時フォーマット
  const formattedDateTime = formatDateTime(startTime)

  // シンプルなHTMLテンプレート（React EmailのスタイルをベースにしたHTML）
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
        ${isAdminCopy ? '明日のセッションリマインダー' : `${userName}さん、明日のセッションをお忘れなく!`}
      </h1>

      <p style="font-size: 16px; line-height: 26px; color: #4a4a4a;">
        明日のセッションについてのリマインダーをお送りします。
      </p>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">セッション</p>
        <p style="font-size: 16px; color: #1a1a1a; margin-top: 0; margin-bottom: 16px;">${sessionTitle}</p>

        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">日時</p>
        <p style="font-size: 16px; color: #1a1a1a; margin-top: 0; margin-bottom: 16px;">${formattedDateTime}</p>

        <p style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Zoomリンク</p>
        <a href="${zoomJoinUrl}" style="color: #2563eb; text-decoration: none; font-size: 14px; word-break: break-all;">${zoomJoinUrl}</a>
      </div>

      <hr style="border-color: #e5e7eb; margin-top: 24px; margin-bottom: 24px;" />

      <div style="text-align: center; margin-bottom: 12px;">
        <a href="${zoomJoinUrl}" style="background-color: #2563eb; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; display: inline-block; padding: 12px 24px;">
          Zoomミーティングに参加
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 16px;">
        開始時刻の数分前にご参加いただけるとスムーズです。
      </p>

      ${
        isAdminCopy
          ? `<div style="margin-top: 24px; padding: 12px; background-color: #fef3c7; border-radius: 8px;">
               <p style="font-size: 14px; color: #92400e; margin: 0;">予約者: ${userName}</p>
             </div>`
          : ''
      }
    </div>
  </div>
</body>
</html>
`
}

/**
 * 日時フォーマット
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }
  return date.toLocaleDateString('ja-JP', options)
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
