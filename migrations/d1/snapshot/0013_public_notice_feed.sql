CREATE INDEX IF NOT EXISTS main__notices_public_feed_v3_idx
ON main__notices(year, publish_date DESC, json_extract(catalog_projection, '$.sourceRank'))
WHERE is_private=0 AND admin_status='published' AND admin_deleted_at IS NULL AND catalog_projection IS NOT NULL;

CREATE TABLE IF NOT EXISTS _public_notice_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,
  data_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0,
  result_json TEXT CHECK(result_json IS NULL OR (json_valid(result_json) AND length(CAST(result_json AS BLOB))<=1800000))
) STRICT;
CREATE INDEX IF NOT EXISTS public_notice_cache_expiry_idx ON _public_notice_cache(expires_at);
