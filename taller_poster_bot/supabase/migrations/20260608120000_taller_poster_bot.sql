-- TALLER poster bot tables (Supabase / PostgreSQL)
-- Project: kapundznmkfpeingstyu

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS poster_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  username TEXT,
  title TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poster_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES poster_channels(id) ON DELETE SET NULL,
  publish_at TIMESTAMPTZ NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'published', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  last_error TEXT,
  telegram_message_id BIGINT
);

CREATE INDEX IF NOT EXISTS poster_posts_status_publish_at_idx
  ON poster_posts (status, publish_at);

CREATE INDEX IF NOT EXISTS poster_posts_created_at_idx
  ON poster_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS poster_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES poster_posts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_telegram_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poster_audit_logs_post_id_idx
  ON poster_audit_logs (post_id);

CREATE INDEX IF NOT EXISTS poster_audit_logs_created_at_idx
  ON poster_audit_logs (created_at DESC);

ALTER TABLE poster_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_audit_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE poster_posts IS 'TALLER poster bot — scheduled and published channel posts';
COMMENT ON TABLE poster_channels IS 'Registered Telegram channels for TALLER poster bot';
COMMENT ON TABLE poster_audit_logs IS 'Audit trail for poster bot actions';
