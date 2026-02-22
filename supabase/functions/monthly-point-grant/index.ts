/**
 * Monthly Point Grant Edge Function
 *
 * 毎月1日に実行され、全アクティブ会員にポイントを付与する
 * - 冪等性チェック: 今月分が既に処理されているかをチェック
 * - grant_monthly_points RPC呼び出し
 * - リトライロジック: 失敗時に最大3回即時リトライ
 * - task_execution_logs記録
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface GrantResult {
  success_count: number
  failed_count: number
  total_count: number
  errors?: Array<{ user_id: string; error: string }>
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
    // 冪等性チェック: 今月分が既に処理されているかをチェック
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data: existingGrant, error: checkError } = await supabase
      .from('point_transactions')
      .select('id')
      .eq('transaction_type', 'monthly_grant')
      .gte('created_at', `${currentMonth}-01T00:00:00Z`)
      .lt('created_at', `${currentMonth}-31T23:59:59Z`)
      .limit(1)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Idempotency check failed: ${checkError.message}`)
    }

    if (existingGrant) {
      // 既に今月分が処理済み
      await supabase
        .from('task_execution_logs')
        .insert({
          task_name: 'monthly_point_grant',
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

    // grant_monthly_points RPC呼び出し（リトライロジック付き）
    let result: GrantResult | null = null
    let lastError: Error | null = null
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.rpc('grant_monthly_points')

        if (error) {
          throw new Error(`RPC call failed: ${error.message}`)
        }

        // RPCの結果を解析
        result = {
          success_count: data?.success_count ?? 0,
          failed_count: data?.failed_count ?? 0,
          total_count: data?.total_count ?? 0,
          errors: data?.errors ?? [],
        }

        // 成功したらループを抜ける
        break
      } catch (error) {
        lastError = error as Error
        console.error(`Attempt ${attempt}/${maxRetries} failed:`, error)

        if (attempt === maxRetries) {
          throw error
        }
        // 即時リトライ（指数バックオフなし）
      }
    }

    if (!result) {
      throw new Error('Failed to grant monthly points after retries')
    }

    // 実行結果をログに記録
    const status = result.failed_count === 0
      ? 'success'
      : result.success_count > 0
        ? 'partial_success'
        : 'failed'

    await supabase
      .from('task_execution_logs')
      .insert({
        task_name: 'monthly_point_grant',
        status,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        total_count: result.total_count,
        success_count: result.success_count,
        failed_count: result.failed_count,
        error_details: result.errors && result.errors.length > 0 ? result.errors : null,
      })

    return new Response(
      JSON.stringify({
        success: true,
        result,
        status,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Monthly point grant failed:', error)

    // エラーログを記録
    await supabase
      .from('task_execution_logs')
      .insert({
        task_name: 'monthly_point_grant',
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
