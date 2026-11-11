-- ASKEP Premium migration for the EXISTING askep-premium-db database.
-- The existing payment_transactions and premium_users tables are preserved.
-- Do not run the fresh-database schema.sql on this database.

CREATE TABLE IF NOT EXISTS ai_daily_usage (
  uid TEXT NOT NULL,
  usage_date TEXT NOT NULL, -- UTC date: YYYY-MM-DD
  question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (uid, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_date
  ON ai_daily_usage(usage_date);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_uid_created
  ON payment_transactions(uid, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_updated
  ON payment_transactions(status, updated_at);
