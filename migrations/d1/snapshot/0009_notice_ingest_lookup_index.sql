-- The crawler only needs to find the schools present in its small batch.
-- This keeps that lookup bounded on the D1 free tier.
CREATE INDEX IF NOT EXISTS main_notices_school_name_idx
  ON main__notices(school_name, admin_status, is_private, admin_deleted_at);
