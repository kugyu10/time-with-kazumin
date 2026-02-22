-- Migration: idempotency_keys table for preventing duplicate requests
-- Created: 2026-02-22
-- Purpose: Store idempotency keys to ensure booking requests are processed exactly once

-- Create idempotency_keys table
CREATE TABLE idempotency_keys (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    request_hash TEXT NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for fast key lookup
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);

-- Index for cleanup of expired keys
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- Comment for documentation
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys to prevent duplicate booking requests';
COMMENT ON COLUMN idempotency_keys.key IS 'Unique idempotency key provided by client or auto-generated';
COMMENT ON COLUMN idempotency_keys.request_hash IS 'SHA-256 hash of the request body for conflict detection';
COMMENT ON COLUMN idempotency_keys.response IS 'Cached response for the request';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'When this key expires (24 hours by default)';

-- Note: RLS is not enabled because this table is only accessed via service_role
-- Service role bypasses RLS automatically
