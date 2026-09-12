CREATE TABLE _identity_links (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  legacy_project_ref TEXT NOT NULL CHECK(legacy_project_ref IN ('mnotoltpythkayguhnrk','bqzchxacykhdmoczysfe')),
  legacy_user_id TEXT NOT NULL,
  PRIMARY KEY(issuer,subject,legacy_project_ref),
  UNIQUE(issuer,legacy_project_ref,legacy_user_id)
) STRICT;
CREATE TABLE _runtime_state (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL) STRICT;
CREATE TABLE _notice_query_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  data_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0,
  result_json TEXT CHECK(result_json IS NULL OR (json_valid(result_json) AND length(CAST(result_json AS BLOB))<=131072))
) STRICT;
ALTER TABLE main__notices ADD COLUMN catalog_projection TEXT CHECK(catalog_projection IS NULL OR json_valid(catalog_projection));
ALTER TABLE main__profiles ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE main__applications ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE main__workbench_states ADD COLUMN sync_revision INTEGER NOT NULL DEFAULT 1;

-- The source quota trigger is installed only after the existing application snapshot has loaded.
-- A single SQLite write transaction makes the check and insert atomic, including concurrent requests.
CREATE TRIGGER main_application_quota BEFORE INSERT ON main__applications
WHEN NOT EXISTS (SELECT 1 FROM main__applications a WHERE a.user_id=NEW.user_id AND a.project_id=NEW.project_id)
 AND NOT EXISTS (SELECT 1 FROM main__user_entitlements e WHERE e.user_id=NEW.user_id AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>strftime('%Y-%m-%dT%H:%M:%f000Z','now')))
 AND (SELECT count(*) FROM main__applications a WHERE a.user_id=NEW.user_id)>=5
BEGIN SELECT RAISE(ABORT,'FREE_APPLICATION_LIMIT'); END;
