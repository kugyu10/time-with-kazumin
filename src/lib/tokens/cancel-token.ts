/**
 * JWT Cancel Token
 *
 * ゲストがセキュアに予約をキャンセルするためのJWTトークン生成・検証
 * アルゴリズム: HS256
 * 有効期限: 7日間
 */

import { SignJWT, jwtVerify } from "jose"

// 遅延初期化 - ビルド時エラー回避
let cachedSecret: Uint8Array | null = null

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret

  const secretKey = process.env.JWT_CANCEL_SECRET
  if (!secretKey) {
    console.warn(
      "[cancel-token] JWT_CANCEL_SECRET not set. Using default secret for development."
    )
    // 開発用のデフォルト値（本番では必ず設定）
    cachedSecret = new TextEncoder().encode("default-cancel-secret-do-not-use-in-production")
  } else {
    cachedSecret = new TextEncoder().encode(secretKey)
  }

  return cachedSecret
}

// キャンセルトークンのペイロード型
interface CancelTokenPayload {
  booking_id: number
  email: string
}

/**
 * キャンセルトークンを生成
 * @param bookingId 予約ID
 * @param guestEmail ゲストのメールアドレス
 * @returns JWTトークン
 */
export async function generateCancelToken(
  bookingId: number,
  guestEmail: string
): Promise<string> {
  const token = await new SignJWT({
    booking_id: bookingId,
    email: guestEmail.toLowerCase().trim(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret())

  return token
}

/**
 * キャンセルトークンを検証
 * @param token JWTトークン
 * @returns ペイロードまたはnull（無効な場合）
 */
export async function verifyCancelToken(
  token: string
): Promise<CancelTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())

    // ペイロードの型チェック
    if (
      typeof payload.booking_id !== "number" ||
      typeof payload.email !== "string"
    ) {
      console.warn("[cancel-token] Invalid payload structure")
      return null
    }

    return {
      booking_id: payload.booking_id,
      email: payload.email,
    }
  } catch (error) {
    // 署名エラー、期限切れ、など
    if (error instanceof Error) {
      console.warn("[cancel-token] Verification failed:", error.message)
    }
    return null
  }
}
