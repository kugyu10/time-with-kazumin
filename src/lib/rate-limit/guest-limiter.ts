/**
 * Guest Rate Limiter
 *
 * ゲスト予約のレート制限を管理。
 * IP単独とIP+email複合キーで制限を適用。
 */

import { LRUCache } from "lru-cache"

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// IP単独の制限: 1時間に5回
const IP_LIMIT = 5
// IP+email複合キーの制限: 1時間に3回
const IP_EMAIL_LIMIT = 3
// TTL: 1時間（ミリ秒）
const TTL_MS = 60 * 60 * 1000

// LRUキャッシュの設定
const cache = new LRUCache<string, RateLimitEntry>({
  max: 500,
  ttl: TTL_MS,
})

/**
 * ゲスト予約のレート制限をチェック
 *
 * @param ip - クライアントIPアドレス
 * @param email - ゲストのメールアドレス
 * @returns レート制限結果
 */
export function checkGuestRateLimit(ip: string, email: string): RateLimitResult {
  const now = Date.now()

  // IP単独のキー
  const ipKey = `ip:${ip}`
  // IP+email複合キー
  const compositeKey = `ip:${ip}:email:${email.toLowerCase()}`

  // IP単独のチェック
  const ipResult = checkLimit(ipKey, IP_LIMIT, now)
  if (!ipResult.allowed) {
    return ipResult
  }

  // IP+email複合キーのチェック
  const compositeResult = checkLimit(compositeKey, IP_EMAIL_LIMIT, now)
  if (!compositeResult.allowed) {
    return compositeResult
  }

  // 両方通過: カウントをインクリメント
  incrementCount(ipKey, now)
  incrementCount(compositeKey, now)

  // より制限の厳しい方の残り回数を返す
  const remaining = Math.min(ipResult.remaining - 1, compositeResult.remaining - 1)
  const resetAt = Math.max(ipResult.resetAt, compositeResult.resetAt)

  return {
    allowed: true,
    remaining: Math.max(0, remaining),
    resetAt,
  }
}

function checkLimit(key: string, limit: number, now: number): RateLimitResult {
  const entry = cache.get(key)

  if (!entry) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + TTL_MS,
    }
  }

  // リセット時刻を過ぎていたらリセット
  if (now >= entry.resetAt) {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + TTL_MS,
    }
  }

  // 制限超過チェック
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    allowed: true,
    remaining: limit - entry.count - 1,
    resetAt: entry.resetAt,
  }
}

function incrementCount(key: string, now: number): void {
  const entry = cache.get(key)

  if (!entry || now >= entry.resetAt) {
    cache.set(key, {
      count: 1,
      resetAt: now + TTL_MS,
    })
  } else {
    cache.set(key, {
      count: entry.count + 1,
      resetAt: entry.resetAt,
    })
  }
}
