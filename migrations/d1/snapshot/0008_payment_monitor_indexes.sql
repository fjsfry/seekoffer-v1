-- Keep the operator monitor bounded on the free D1 tier.
CREATE INDEX IF NOT EXISTS commerce_orders_created_idx
  ON commerce__orders(created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_payments_created_idx
  ON commerce__payments(created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_payment_events_created_idx
  ON commerce__payment_events(created_at DESC);
