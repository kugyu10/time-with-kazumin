/**
 * Google OAuth Client
 * Phase 4: Google Calendar API認証
 *
 * 遅延初期化パターンでビルド時エラーを回避
 * 'tokens'イベントで自動リフレッシュ時のトークン更新を検出しDB保存
 */

import { google, Auth } from "googleapis"
import {
  saveEncryptedTokens,
  getDecryptedTokens,
  OAuthTokens,
} from "./tokens"

const GOOGLE_PROVIDER = "google"

// NOTE: OAuth2クライアントはリクエストごとに生成する。
// グローバルキャッシュすると、再認証後もウォームなサーバーレスインスタンスが
// 古い認証情報を持ち続ける（redirect_uri_mismatch デバッグ時の教訓）

/**
 * Google OAuth認証に必要なスコープ
 */
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
]

/**
 * 環境変数から認証情報を取得
 */
function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    console.warn("[GoogleOAuth] Missing Google OAuth credentials")
    return null
  }

  return { clientId, clientSecret, redirectUri }
}

/**
 * OAuth2クライアントを生成（毎回新規作成）
 */
function initOAuth2Client(): Auth.OAuth2Client | null {
  const credentials = getGoogleCredentials()
  if (!credentials) return null

  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  )
}

/**
 * トークン更新リスナーを設定
 * クライアントは毎回新規生成されるため、クライアントごとに1回だけ設定される
 */
function attachTokenListener(client: Auth.OAuth2Client) {
  client.on("tokens", async (tokens) => {
    console.log("[GoogleOAuth] Token refresh detected")

    try {
      const tokensToSave: OAuthTokens = {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
      }
      await saveEncryptedTokens(GOOGLE_PROVIDER, tokensToSave)
      console.log("[GoogleOAuth] Refreshed tokens saved to DB")
    } catch (error) {
      console.error("[GoogleOAuth] Failed to save refreshed tokens:", error)
    }
  })
}

/**
 * Google OAuth認証URLを生成
 * 管理者が認証を行う際に使用
 */
export function getAuthUrl(): string | null {
  const client = initOAuth2Client()
  if (!client) {
    console.error("[GoogleOAuth] Cannot generate auth URL: missing credentials")
    return null
  }

  return client.generateAuthUrl({
    access_type: "offline", // refresh token取得に必須
    prompt: "consent", // 毎回consent画面を表示（refresh_token再取得時に必要）
    scope: GOOGLE_SCOPES,
  })
}

/**
 * 認証コードからトークンを取得してDBに保存
 * OAuth callbackで使用
 */
export async function getTokensFromCode(code: string): Promise<OAuthTokens> {
  const client = initOAuth2Client()
  if (!client) {
    throw new Error("Google OAuth credentials not configured")
  }

  const { tokens } = await client.getToken(code)

  if (!tokens.access_token) {
    throw new Error("Failed to get access token from Google")
  }

  const oauthTokens: OAuthTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  }

  // トークンをDBに保存
  await saveEncryptedTokens(GOOGLE_PROVIDER, oauthTokens)
  console.log("[GoogleOAuth] Initial tokens saved to DB")

  // クライアントにも設定
  client.setCredentials(tokens)
  attachTokenListener(client)

  return oauthTokens
}

/**
 * 認証済みOAuth2クライアントを取得
 * DBからトークンを読み込み、自動リフレッシュを設定
 */
export async function getOAuthClient(): Promise<Auth.OAuth2Client | null> {
  const client = initOAuth2Client()
  if (!client) {
    console.warn("[GoogleOAuth] OAuth client not available: missing credentials")
    return null
  }

  // DBからトークンを取得
  const tokens = await getDecryptedTokens(GOOGLE_PROVIDER)
  if (!tokens) {
    console.warn("[GoogleOAuth] No tokens found in DB")
    return null
  }

  // クライアントにトークンを設定
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  })

  // リフレッシュ時の自動保存を設定
  attachTokenListener(client)

  return client
}

/**
 * OAuth認証状態をチェック
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const client = await getOAuthClient()
    return client !== null
  } catch {
    return false
  }
}

/**
 * Google OAuth認証情報が設定されているかチェック
 */
export function isConfigured(): boolean {
  return getGoogleCredentials() !== null
}
