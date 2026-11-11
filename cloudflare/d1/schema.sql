-- ASKEP Premium billing and AI quota schema
-- Apply to a NEW Cloudflare D1 database. SDKI/SLKI/SIKI remain in R2.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  premium_status TEXT NOT NULL DEFAULT 'free'
    CHECK (premium_status IN ('free', 'premium')),
  premium_source TEXT,
  premium_started_at TEXT,
  premium_expires_at TEXT, -- NULL means lifetime
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  order_id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount = 9000),
  currency TEXT NOT NULL DEFAULT 'IDR',
  product_code TEXT NOT NULL DEFAULT 'ASKEP_PREMIUM_LIFETIME',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'failure', 'refund', 'partial_refund')),
  payment_type TEXT,
  transaction_id TEXT,
  fraud_status TEXT,
  status_code TEXT,
  gross_amount TEXT,
  paid_at TEXT,
  notification_payload TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_uid
  ON payment_transactions(uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
  ON payment_transactions(status, updated_at);

CREATE TABLE IF NOT EXISTS ai_daily_usage (
  uid TEXT NOT NULL,
  usage_date TEXT NOT NULL, -- UTC date YYYY-MM-DD
  question_count INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (uid, usage_date),
  FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_date
  ON ai_daily_usage(usage_date);
