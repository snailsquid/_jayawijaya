CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'midtrans',
  product_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  entitlement_days INTEGER,
  status TEXT NOT NULL,
  provider_status TEXT,
  provider_transaction_id TEXT,
  payment_type TEXT,
  fraud_status TEXT,
  snap_token TEXT,
  redirect_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS payments_user_created_idx ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_user_product_status_idx ON payments(user_id, product_code, status);
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_order_idx ON payments(user_id, product_code)
  WHERE status IN ('created', 'pending');
