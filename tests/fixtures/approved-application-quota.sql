CREATE TRIGGER main_application_quota BEFORE INSERT ON main__applications
WHEN NOT EXISTS (SELECT 1 FROM _runtime_state WHERE key='website_recovery_application_quota' AND value='unlimited')
 AND NOT EXISTS (SELECT 1 FROM main__applications a WHERE a.user_id=NEW.user_id AND a.project_id=NEW.project_id)
 AND NOT EXISTS (SELECT 1 FROM main__user_entitlements e WHERE e.user_id=NEW.user_id AND e.status='active' AND (e.expires_at IS NULL OR e.expires_at>strftime('%Y-%m-%dT%H:%M:%f000Z','now')))
 AND (SELECT count(*) FROM main__applications a WHERE a.user_id=NEW.user_id)>=5
BEGIN SELECT RAISE(ABORT,'FREE_APPLICATION_LIMIT'); END;
