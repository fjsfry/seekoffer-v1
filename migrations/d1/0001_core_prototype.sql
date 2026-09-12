-- LOCAL PROTOTYPE. Live source schema and data have not been exported.
-- Business UUIDs retain their original value; project namespaces never merge.
CREATE TABLE business_users (
  legacy_project_ref TEXT NOT NULL,
  id TEXT NOT NULL,
  blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1)),
  PRIMARY KEY(legacy_project_ref,id)
);
CREATE TABLE identity_links (
  issuer TEXT NOT NULL, subject TEXT NOT NULL,
  legacy_project_ref TEXT NOT NULL, legacy_user_id TEXT NOT NULL,
  PRIMARY KEY(issuer,subject),
  UNIQUE(issuer,legacy_project_ref,legacy_user_id),
  FOREIGN KEY(legacy_project_ref,legacy_user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE profiles (
  legacy_project_ref TEXT NOT NULL, user_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(legacy_project_ref,user_id),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE notices (
  legacy_project_ref TEXT NOT NULL, id TEXT NOT NULL,
  school_name TEXT NOT NULL, department_name TEXT NOT NULL, project_name TEXT NOT NULL,
  project_type TEXT NOT NULL, discipline TEXT NOT NULL, region TEXT NOT NULL,
  school_range TEXT NOT NULL, notice_kind TEXT NOT NULL, year INTEGER NOT NULL,
  publish_date TEXT NOT NULL, deadline_raw TEXT, deadline_utc_ms INTEGER,
  search_text TEXT NOT NULL, summary_json TEXT NOT NULL CHECK(json_valid(summary_json)),
  detail_json TEXT NOT NULL CHECK(json_valid(detail_json)),
  is_private INTEGER NOT NULL CHECK(is_private IN (0,1)), owner_id TEXT,
  admin_status TEXT NOT NULL, deleted_at TEXT,
  PRIMARY KEY(legacy_project_ref,id)
);
CREATE INDEX notices_public_date ON notices(legacy_project_ref,year,publish_date DESC,id)
  WHERE is_private=0 AND admin_status='published' AND deleted_at IS NULL;
CREATE INDEX notices_public_deadline ON notices(legacy_project_ref,year,deadline_utc_ms,id)
  WHERE is_private=0 AND admin_status='published' AND deleted_at IS NULL;
CREATE TABLE applications (
  legacy_project_ref TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL, project_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(legacy_project_ref,id), UNIQUE(legacy_project_ref,user_id,project_id),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
  -- No cascading FK to notices: withdrawn notices cannot delete a user's notes.
);
CREATE INDEX applications_owner ON applications(legacy_project_ref,user_id,id);
CREATE TABLE workbench_states (
  legacy_project_ref TEXT NOT NULL,user_id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
  revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(legacy_project_ref,user_id),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE user_vaults (
  legacy_project_ref TEXT NOT NULL,user_id TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL CHECK(json_valid(encrypted_payload)),
  revision TEXT NOT NULL,schema_version INTEGER NOT NULL,
  PRIMARY KEY(legacy_project_ref,user_id),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE billing_orders (
  legacy_project_ref TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,
  out_trade_no TEXT NOT NULL,provider TEXT NOT NULL,provider_trade_no TEXT,
  amount_cents TEXT NOT NULL CHECK(length(amount_cents)>0 AND amount_cents NOT GLOB '*[^0-9]*'),
  currency TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(legacy_project_ref,id),UNIQUE(legacy_project_ref,out_trade_no),
  UNIQUE(legacy_project_ref,provider,provider_trade_no),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE user_entitlements (
  legacy_project_ref TEXT NOT NULL,user_id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(legacy_project_ref,user_id),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE billing_fill_sessions (
  legacy_project_ref TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT NOT NULL,request_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(legacy_project_ref,id),
  UNIQUE(legacy_project_ref,user_id,request_id),
  FOREIGN KEY(legacy_project_ref,user_id) REFERENCES business_users(legacy_project_ref,id)
);
CREATE TABLE transaction_outbox (
  id TEXT PRIMARY KEY,event_type TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_at TEXT NOT NULL,delivered_at TEXT
);
CREATE TABLE migration_batches (
  snapshot_id TEXT NOT NULL,table_name TEXT NOT NULL,batch_no INTEGER NOT NULL,
  sha256 TEXT NOT NULL,row_count INTEGER NOT NULL,PRIMARY KEY(snapshot_id,table_name,batch_no)
);
-- Typed, lossless staging is explicitly NOT a substitute for the business routes.
CREATE TABLE migration_source_records (
  legacy_project_ref TEXT NOT NULL,schema_name TEXT NOT NULL,table_name TEXT NOT NULL,
  source_pk TEXT NOT NULL,source_payload TEXT NOT NULL CHECK(json_valid(source_payload)),sha256 TEXT NOT NULL,
  PRIMARY KEY(legacy_project_ref,schema_name,table_name,source_pk)
);
