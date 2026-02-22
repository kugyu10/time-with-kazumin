/**
 * Exponential Backoff Retry Utility
 * Phase 4: 外部API呼び出し時のレート制限対策
 *
 * Google Calendar APIなどの10 QPS制限に対応
 * 403/429エラー時に指数バックオフでリトライ
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number // milliseconds
  maxDelay?: number // milliseconds
  retryableStatusCodes?: number[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryableStatusCodes: [403, 429, 500, 502, 503, 504],
}

/**
 * 指数バックオフでリトライ
 *
 * @param fn - 実行する非同期関数
 * @param options - リトライオプション
 * @returns 関数の実行結果
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let attempt = 0
  let lastError: Error | null = null

  while (attempt < opts.maxRetries) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // エラーコードを抽出
      const statusCode = extractStatusCode(error)
      const isRetryable =
        statusCode !== null && opts.retryableStatusCodes.includes(statusCode)

      // 最後の試行、またはリトライ不可能なエラーの場合は即座にthrow
      if (attempt >= opts.maxRetries - 1 || !isRetryable) {
        throw error
      }

      // 指数バックオフ + jitter
      const baseWait = opts.baseDelay * Math.pow(2, attempt)
      const jitter = Math.random() * 1000
      const delay = Math.min(baseWait + jitter, opts.maxDelay)

      console.log(
        `[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed ` +
          `(status: ${statusCode}). Retrying in ${Math.round(delay)}ms...`
      )

      await sleep(delay)
      attempt++
    }
  }

  // ここには到達しないはずだが、型安全のため
  throw lastError || new Error("Max retries exceeded")
}

/**
 * エラーからHTTPステータスコードを抽出
 */
function extractStatusCode(error: unknown): number | null {
  if (error && typeof error === "object") {
    // googleapis/GaxiosErrorの形式
    if ("code" in error && typeof error.code === "number") {
      return error.code
    }
    // 標準的なHTTPエラーの形式
    if ("status" in error && typeof error.status === "number") {
      return error.status
    }
    // response.statusの形式
    if (
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "status" in error.response &&
      typeof error.response.status === "number"
    ) {
      return error.response.status
    }
  }
  return null
}

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
