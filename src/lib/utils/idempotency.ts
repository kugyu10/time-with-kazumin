import { SupabaseClient } from "@supabase/supabase-js"
import { nanoid } from "nanoid"
import type { Database } from "@/types/database"

/**
 * Idempotency key management utilities
 * Ensures booking requests are processed exactly once
 */

export interface IdempotencyResponse {
  booking: {
    id: number
    status: string
    zoom_join_url?: string | null
  }
}

export interface IdempotencyCheckResult {
  exists: boolean
  response?: IdempotencyResponse
  conflict?: boolean
}

/**
 * Generate a new idempotency key
 */
export function generateIdempotencyKey(): string {
  return nanoid(21)
}

/**
 * Hash request body using SHA-256
 */
export async function hashRequest(body: Record<string, unknown>): Promise<string> {
  const text = JSON.stringify(body)
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Check if idempotency key exists
 * - Returns cached response if key exists with matching hash
 * - Throws ConflictError if key exists with different hash
 * - Returns null if key doesn't exist
 */
export async function checkIdempotencyKey(
  supabase: SupabaseClient<Database>,
  key: string,
  requestHash: string
): Promise<IdempotencyCheckResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("idempotency_keys")
    .select("request_hash, response")
    .eq("key", key)
    .gt("expires_at", new Date().toISOString())
    .single() as { data: { request_hash: string; response: unknown } | null; error: { code: string } | null }

  if (error && error.code === "PGRST116") {
    // No rows returned - key doesn't exist
    return { exists: false }
  }

  if (error) {
    throw error
  }

  if (!data) {
    return { exists: false }
  }

  // Key exists - check hash
  if (data.request_hash === requestHash) {
    // Same request - return cached response
    return {
      exists: true,
      response: data.response as IdempotencyResponse
    }
  }

  // Different request with same key - conflict
  return {
    exists: true,
    conflict: true
  }
}

/**
 * Save idempotency key with response
 */
export async function saveIdempotencyKey(
  supabase: SupabaseClient<Database>,
  key: string,
  requestHash: string,
  response: IdempotencyResponse
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("idempotency_keys")
    .insert({
      key,
      request_hash: requestHash,
      response
    }) as { error: { code: string } | null }

  if (error) {
    // Ignore duplicate key errors (race condition on same key)
    if (error.code === "23505") {
      return
    }
    throw error
  }
}

/**
 * Error class for idempotency conflicts
 */
export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key already used with different request body")
    this.name = "IdempotencyConflictError"
  }
}
