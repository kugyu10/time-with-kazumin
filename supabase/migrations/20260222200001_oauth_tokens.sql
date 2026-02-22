-- OAuth Tokens Migration
-- Phase 4: Google Calendar OAuth統合
-- Purpose: OAuthトークンを暗号化して保存するテーブルとRPC関数

-- pgcrypto拡張を有効化（AES暗号化に必要）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- OAuth Tokens Table
-- provider: 'google', 'zoom_a', 'zoom_b' などのサービス識別子
-- access_token/refresh_tokenはpgp_sym_encryptで暗号化して保存
CREATE TABLE oauth_tokens (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT oauth_tokens_provider_unique UNIQUE (provider)
);

-- RLSポリシー（service_roleのみアクセス可能）
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- service_roleはRLSをバイパスするため、明示的なポリシーは不要
-- anon/authenticated userはアクセス不可（デフォルトDENY）

-- 暗号化関数
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
  SELECT pgp_sym_encrypt(token, encryption_key);
$$ LANGUAGE SQL IMMUTABLE;

-- 復号化関数
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(encrypted_token, encryption_key);
$$ LANGUAGE SQL IMMUTABLE;

-- トークンUPSERT関数（providerごとに1レコード）
CREATE OR REPLACE FUNCTION upsert_oauth_token(
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT DEFAULT NULL,
  p_expiry_date TIMESTAMPTZ DEFAULT NULL,
  p_encryption_key TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO oauth_tokens (
    provider,
    access_token_encrypted,
    refresh_token_encrypted,
    expiry_date,
    updated_at
  ) VALUES (
    p_provider,
    encrypt_token(p_access_token, p_encryption_key),
    CASE WHEN p_refresh_token IS NOT NULL THEN encrypt_token(p_refresh_token, p_encryption_key) ELSE NULL END,
    p_expiry_date,
    NOW()
  )
  ON CONFLICT (provider) DO UPDATE SET
    access_token_encrypted = encrypt_token(p_access_token, p_encryption_key),
    refresh_token_encrypted = CASE
      WHEN p_refresh_token IS NOT NULL THEN encrypt_token(p_refresh_token, p_encryption_key)
      ELSE oauth_tokens.refresh_token_encrypted -- 既存のrefresh_tokenを保持
    END,
    expiry_date = COALESCE(p_expiry_date, oauth_tokens.expiry_date),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トークン取得関数（復号化して返却）
CREATE OR REPLACE FUNCTION get_oauth_token(
  p_provider TEXT,
  p_encryption_key TEXT
)
RETURNS TABLE (
  access_token TEXT,
  refresh_token TEXT,
  expiry_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    decrypt_token(ot.access_token_encrypted, p_encryption_key),
    CASE WHEN ot.refresh_token_encrypted IS NOT NULL
      THEN decrypt_token(ot.refresh_token_encrypted, p_encryption_key)
      ELSE NULL
    END,
    ot.expiry_date
  FROM oauth_tokens ot
  WHERE ot.provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トークン削除関数
CREATE OR REPLACE FUNCTION delete_oauth_token(p_provider TEXT)
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_tokens WHERE provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_tokens_updated_at_trigger
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_tokens_updated_at();
