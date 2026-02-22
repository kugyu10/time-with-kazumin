/**
 * OAuth Token Management
 * Phase 4: トークン暗号化・復号化・DB保存
 *
 * service_roleクライアントを使用してRLSをバイパスし、
 * oauth_tokensテーブルに暗号化トークンを保存/取得する
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"

// 遅延初期化用のservice_roleクライアント
let serviceRoleClient: SupabaseClient | null = null

function getServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) return serviceRoleClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase service role environment variables")
  }

  serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey)
  return serviceRoleClient
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }
  // ENCRYPTION_KEYは32バイト以上を推奨
  if (key.length < 32) {
    console.warn("[OAuthTokens] ENCRYPTION_KEY should be at least 32 bytes")
  }
  return key
}

export interface OAuthTokens {
  access_token: string
  refresh_token?: string | null
  expiry_date?: number | null // Unix timestamp in milliseconds
}

/**
 * トークンを暗号化してDBに保存
 * providerごとにUPSERT（存在すれば更新、なければ挿入）
 */
export async function saveEncryptedTokens(
  provider: string,
  tokens: OAuthTokens
): Promise<void> {
  const supabase = getServiceRoleClient()
  const encryptionKey = getEncryptionKey()

  // expiry_dateをISO形式に変換（nullの場合はundefined）
  const expiryDateISO = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : null

  const { error } = await supabase.rpc("upsert_oauth_token", {
    p_provider: provider,
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token ?? null,
    p_expiry_date: expiryDateISO,
    p_encryption_key: encryptionKey,
  })

  if (error) {
    console.error("[OAuthTokens] Failed to save tokens:", error)
    throw new Error(`Failed to save OAuth tokens: ${error.message}`)
  }

  console.log(`[OAuthTokens] Tokens saved for provider: ${provider}`)
}

/**
 * DBからトークンを復号化して取得
 */
export async function getDecryptedTokens(
  provider: string
): Promise<OAuthTokens | null> {
  const supabase = getServiceRoleClient()
  const encryptionKey = getEncryptionKey()

  const { data, error } = await supabase.rpc("get_oauth_token", {
    p_provider: provider,
    p_encryption_key: encryptionKey,
  })

  if (error) {
    console.error("[OAuthTokens] Failed to get tokens:", error)
    throw new Error(`Failed to get OAuth tokens: ${error.message}`)
  }

  // データが存在しない場合
  if (!data || data.length === 0) {
    console.log(`[OAuthTokens] No tokens found for provider: ${provider}`)
    return null
  }

  const row = data[0]

  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? null,
    expiry_date: row.expiry_date
      ? new Date(row.expiry_date).getTime()
      : null,
  }
}

/**
 * トークンが存在するかチェック
 */
export async function hasTokens(provider: string): Promise<boolean> {
  try {
    const tokens = await getDecryptedTokens(provider)
    return tokens !== null && !!tokens.access_token
  } catch {
    return false
  }
}

/**
 * トークンを削除
 */
export async function deleteTokens(provider: string): Promise<void> {
  const supabase = getServiceRoleClient()

  const { error } = await supabase.rpc("delete_oauth_token", {
    p_provider: provider,
  })

  if (error) {
    console.error("[OAuthTokens] Failed to delete tokens:", error)
    throw new Error(`Failed to delete OAuth tokens: ${error.message}`)
  }

  console.log(`[OAuthTokens] Tokens deleted for provider: ${provider}`)
}
