-- Additive only: historic quota records remain intact. Unbound legacy grants
-- cannot be consumed by the new Worker; never backfill guessed bindings.
ALTER TABLE main__billing_fill_sessions ADD COLUMN bound_grant TEXT
  CHECK (bound_grant IS NULL OR (json_valid(bound_grant) AND json_type(bound_grant) = 'object'));

CREATE UNIQUE INDEX main_fill_grant_id_unique
  ON main__billing_fill_sessions(json_extract(bound_grant, '$.grantId')) WHERE bound_grant IS NOT NULL;
CREATE UNIQUE INDEX main_fill_grant_nonce_unique
  ON main__billing_fill_sessions(json_extract(bound_grant, '$.nonce')) WHERE bound_grant IS NOT NULL;

-- Request identity, token and grant cannot be rotated or rebound after prepare.
CREATE TRIGGER main_fill_binding_immutable
BEFORE UPDATE OF user_id, request_id, token_hash, field_count, expires_at, bound_grant ON main__billing_fill_sessions
WHEN NEW.user_id IS NOT OLD.user_id OR NEW.request_id IS NOT OLD.request_id
  OR NEW.token_hash IS NOT OLD.token_hash OR NEW.field_count IS NOT OLD.field_count
  OR NEW.expires_at IS NOT OLD.expires_at OR NEW.bound_grant IS NOT OLD.bound_grant
BEGIN
  SELECT RAISE(ABORT, 'FILL_SESSION_BINDING_IMMUTABLE');
END;

CREATE TRIGGER main_fill_terminal_state
BEFORE UPDATE OF status ON main__billing_fill_sessions
WHEN (OLD.status <> 'prepared' AND NEW.status IS NOT OLD.status)
  -- Reject an old in-flight Worker consuming a legacy unbound token after cutover.
  -- Already consumed historical rows remain untouched and continue to count.
  OR (OLD.status = 'prepared' AND NEW.status = 'consumed' AND OLD.bound_grant IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'FILL_SESSION_TERMINAL');
END;
