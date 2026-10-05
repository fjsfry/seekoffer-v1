-- Resource commerce domain.
--
-- This schema deliberately stays separate from the historical autofill
-- commerce tables. The payment provider is shared in code, while catalog,
-- digital delivery, and customer entitlements have their own lifecycle.

INSERT INTO _business_revisions(name,version)
VALUES ('commerce',0)
ON CONFLICT(name) DO NOTHING;

CREATE TABLE IF NOT EXISTS commerce__products (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  CHECK (length(slug) BETWEEN 2 AND 80),
  CHECK (length(title) BETWEEN 2 AND 120),
  CHECK (length(summary) <= 500),
  CHECK (length(description) <= 20000),
  CHECK (amount_cents BETWEEN 100 AND 1000000),
  CHECK (currency = 'CNY'),
  CHECK (status IN ('draft','published','archived')),
  CHECK (version >= 1),
  CHECK (json_valid(metadata)),
  UNIQUE (slug)
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__product_files (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  object_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  byte_size INTEGER,
  sha256 TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  CHECK (length(object_key) BETWEEN 1 AND 512),
  CHECK (length(filename) BETWEEN 1 AND 180),
  CHECK (length(content_type) BETWEEN 3 AND 160),
  CHECK (byte_size IS NULL OR (byte_size >= 0 AND byte_size <= 1073741824)),
  CHECK (sha256 IS NULL OR (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*')),
  CHECK (sort_order >= 0),
  CHECK (status IN ('active','hidden')),
  CHECK (json_valid(metadata)),
  CONSTRAINT commerce_product_files_product_fkey FOREIGN KEY (product_id)
    REFERENCES commerce__products(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__orders (
  id TEXT PRIMARY KEY NOT NULL,
  order_no TEXT NOT NULL,
  request_id_hash TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_version INTEGER NOT NULL,
  title_snapshot TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  contact_type TEXT NOT NULL,
  contact_value TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT NOT NULL DEFAULT 'jianpay',
  payment_reference TEXT,
  consent_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  fulfilled_at TEXT,
  refunded_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  CHECK (length(order_no) = 18 AND substr(order_no,1,2) = 'SO'),
  CHECK (length(request_id_hash) = 64 AND request_id_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (length(access_token_hash) = 64 AND access_token_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (product_version >= 1),
  CHECK (length(title_snapshot) BETWEEN 2 AND 120),
  CHECK (amount_cents BETWEEN 100 AND 1000000),
  CHECK (currency = 'CNY'),
  CHECK (contact_type IN ('email','wechat','qq')),
  CHECK (length(contact_value) BETWEEN 3 AND 254),
  CHECK (status IN ('pending','paid','fulfilled','canceled','expired','refunded')),
  CHECK (payment_provider IN ('manual','jianpay')),
  CHECK (json_valid(metadata)),
  UNIQUE (order_no),
  UNIQUE (request_id_hash),
  UNIQUE (payment_reference),
  CONSTRAINT commerce_orders_product_fkey FOREIGN KEY (product_id)
    REFERENCES commerce__products(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  unit_amount_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  CHECK (unit_amount_cents BETWEEN 100 AND 1000000),
  CHECK (quantity = 1),
  CHECK (json_valid(metadata)),
  UNIQUE (order_id, product_id),
  CONSTRAINT commerce_order_items_order_fkey FOREIGN KEY (order_id)
    REFERENCES commerce__orders(id) ON DELETE CASCADE,
  CONSTRAINT commerce_order_items_product_fkey FOREIGN KEY (product_id)
    REFERENCES commerce__products(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__payments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'jianpay',
  merchant_order_no TEXT NOT NULL,
  provider_order_id TEXT,
  pay_method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'creating',
  provider_status INTEGER,
  pay_url TEXT,
  failure_code TEXT,
  request_hash TEXT NOT NULL,
  payload_hash TEXT,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  last_queried_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  CHECK (provider = 'jianpay'),
  CHECK (length(merchant_order_no) = 23 AND substr(merchant_order_no,1,3) = 'RCP'),
  CHECK (provider_order_id IS NULL OR length(provider_order_id) BETWEEN 6 AND 200),
  CHECK (pay_method IN ('wx','alipay')),
  CHECK (amount_cents BETWEEN 100 AND 1000000),
  CHECK (currency = 'CNY'),
  CHECK (status IN ('creating','create_unknown','pending','succeeded','failed','closed','needs_review','duplicate_succeeded','refunding','refunded')),
  CHECK (provider_status IS NULL OR provider_status BETWEEN 0 AND 4),
  CHECK (length(request_hash) = 64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (payload_hash IS NULL OR (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*')),
  CHECK (pay_url IS NULL OR length(pay_url) <= 2048),
  CHECK (failure_code IS NULL OR length(failure_code) <= 100),
  CONSTRAINT commerce_payments_order_fkey FOREIGN KEY (order_id)
    REFERENCES commerce__orders(id) ON DELETE CASCADE,
  UNIQUE (merchant_order_no)
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_status INTEGER,
  payload_hash TEXT NOT NULL,
  event_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  CHECK (source IN ('create','callback','query','local','operator')),
  CHECK (provider_status IS NULL OR provider_status BETWEEN 0 AND 4),
  CHECK (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (json_valid(event_data)),
  CONSTRAINT commerce_payment_events_payment_fkey FOREIGN KEY (payment_id)
    REFERENCES commerce__payments(id) ON DELETE CASCADE,
  CONSTRAINT commerce_payment_events_order_fkey FOREIGN KEY (order_id)
    REFERENCES commerce__orders(id) ON DELETE CASCADE,
  UNIQUE (payment_id, event_type, payload_hash)
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  CHECK (status IN ('active','revoked')),
  CHECK (json_valid(metadata)),
  CONSTRAINT commerce_entitlements_order_fkey FOREIGN KEY (order_id)
    REFERENCES commerce__orders(id) ON DELETE CASCADE,
  CONSTRAINT commerce_entitlements_product_fkey FOREIGN KEY (product_id)
    REFERENCES commerce__products(id) ON DELETE RESTRICT,
  UNIQUE (order_id, product_id)
) STRICT;

CREATE TABLE IF NOT EXISTS commerce__download_events (
  id TEXT PRIMARY KEY NOT NULL,
  entitlement_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  user_id TEXT,
  access_mode TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f000Z','now')),
  CHECK (access_mode IN ('account','guest_token','local_demo')),
  CONSTRAINT commerce_download_events_entitlement_fkey FOREIGN KEY (entitlement_id)
    REFERENCES commerce__entitlements(id) ON DELETE CASCADE,
  CONSTRAINT commerce_download_events_file_fkey FOREIGN KEY (file_id)
    REFERENCES commerce__product_files(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX IF NOT EXISTS commerce_products_status_idx
  ON commerce__products(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS commerce_product_files_product_idx
  ON commerce__product_files(product_id, sort_order, id);
CREATE INDEX IF NOT EXISTS commerce_orders_user_idx
  ON commerce__orders(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commerce_orders_status_idx
  ON commerce__orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_payments_order_idx
  ON commerce__payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_entitlements_user_idx
  ON commerce__entitlements(user_id, granted_at DESC) WHERE user_id IS NOT NULL;

INSERT OR IGNORE INTO commerce__products
  (id,slug,title,summary,description,amount_cents,status,version,metadata)
VALUES
  ('resource_complete_application_kit_v1','complete-application-kit','寻鹿保研资料包','把推免申请中需要反复准备的核心资料集中整理，购买后在站内统一交付。','围绕简历、个人陈述、推荐信等申请材料，提供结构化模板、表达提示和提交前检查清单。',299,'published',1,'{"features":["简历模板","个人陈述模板","推荐信模板"],"delivery":"digital","priceStatus":"pending","purchaseEnabled":false}');

INSERT OR IGNORE INTO commerce__product_files
  (id,product_id,object_key,filename,content_type,sort_order,metadata)
VALUES
  ('resource_complete_application_kit_readme_v1','resource_complete_application_kit_v1','commerce/demo/complete-application-kit/使用说明.txt','使用说明.txt','text/plain; charset=utf-8',0,'{"localDemo":true}');
