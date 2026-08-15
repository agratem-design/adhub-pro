-- sql/create_municipalities.sql
-- Creates municipalities table to store municipalities and their codes

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name),
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_municipalities_name ON municipalities (name);
CREATE INDEX IF NOT EXISTS idx_municipalities_code ON municipalities (code);
