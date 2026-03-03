/**
 * Auto Complete Bookings Edge Function
 *
 * 15分ごとに実行され、終了時刻から30分経過した予約を自動的に完了にする
 * - 30分前に終了した予約を抽出（±15分ウィンドウ）
 * - statusを'confirmed'から'completed'に更新
 * - task_execution_logs記録
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface Booking {
  id: number
  end_time: string
  status: string
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

  const startedAt = new Date().toISOString()

  try {
    // 30分前に終了したウィンドウを計算（±15分）
    const now = new Date()
    const targetTime = new Date(now.getTime() - 30 * 60 * 1000) // -30分
    const windowStart = new Date(targetTime.getTime() - 15 * 60 * 1000) // -15分
    const windowEnd = new Date(targetTime.getTime() + 15 * 60 * 1000) // +15分

    console.log(`[AutoComplete] Checking bookings ended between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`)

    // 対象予約を抽出
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, end_time, status')
      .eq('status', 'confirmed')
      .gte('end_time', windowStart.toISOString())
      .lte('end_time', windowEnd.toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`)
    }

    if (!bookings || bookings.length === 0) {
      console.log('[AutoComplete] No bookings to complete')

      await supabase.from('task_execution_logs').insert({
        task_name: 'auto_complete_bookings',
        status: 'success',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        total_count: 0,
        success_count: 0,
        failed_count: 0,
        details: { message: 'No bookings in window' },
      })

      return new Response(
        JSON.stringify({ success: true, message: 'No bookings to complete' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AutoComplete] Found ${bookings.length} bookings to complete`)

    // ステータス更新処理
    let successCount = 0
    let failedCount = 0
    const errors: Array<{ booking_id: number; error: string }> = []

    for (const booking of bookings as Booking[]) {
      try {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', booking.id)

        if (updateError) {
          throw new Error(`Failed to update status: ${updateError.message}`)
        }

        console.log(`[AutoComplete] Booking ${booking.id} marked as completed`)
        successCount++
      } catch (error) {
        failedCount++
        errors.push({
          booking_id: booking.id,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error(`[AutoComplete] Failed for booking ${booking.id}:`, error)
      }
    }

    // バッチログ記録
    const status = failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed'
    await supabase.from('task_execution_logs').insert({
      task_name: 'auto_complete_bookings',
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
    console.error('[AutoComplete] Task failed:', error)

    await supabase.from('task_execution_logs').insert({
      task_name: 'auto_complete_bookings',
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
