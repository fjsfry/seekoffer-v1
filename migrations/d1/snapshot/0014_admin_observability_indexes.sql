-- Indexes used by the bounded operator views. They keep admin polling on
-- indexed ranges and make order event timelines cheap to read.
CREATE INDEX IF NOT EXISTS commerce_payment_events_order_created_idx
  ON commerce__payment_events(order_id,created_at DESC);
CREATE INDEX IF NOT EXISTS main_desktop_download_attempts_created_id_idx
  ON main__desktop_download_attempts(created_at DESC,id DESC);
