-- DRAFT: apply only after explicit production migration approval.
-- No source table, UUID, order, or user record is deleted by this migration.
CREATE TABLE IF NOT EXISTS _account_deletion_requests (
  legacy_user_id TEXT PRIMARY KEY NOT NULL,
  issuer TEXT NOT NULL CHECK (issuer='https://clerk.seekoffer.com.cn'),
  subject TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope='shared-seekoffer-account'),
  state TEXT NOT NULL CHECK (state IN ('review_required','d1_closed','provider_unknown','canceled','completed')),
  requested_at TEXT NOT NULL,
  impact_json TEXT NOT NULL CHECK (json_valid(impact_json)),
  FOREIGN KEY (legacy_user_id) REFERENCES main__auth_subjects(id) ON DELETE RESTRICT
) STRICT;

-- BEGIN TOMBSTONE GUARDS
-- Serialize in-flight owner writes against a completed D1 closure.
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__profiles_insert BEFORE INSERT ON main__profiles
WHEN NEW.id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__profiles_update BEFORE UPDATE ON main__profiles
WHEN NEW.id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__applications_insert BEFORE INSERT ON main__applications
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__applications_update BEFORE UPDATE ON main__applications
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__workbench_states_insert BEFORE INSERT ON main__workbench_states
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__workbench_states_update BEFORE UPDATE ON main__workbench_states
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__user_vaults_insert BEFORE INSERT ON main__user_vaults
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__user_vaults_update BEFORE UPDATE ON main__user_vaults
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__ai_positioning_reports_insert BEFORE INSERT ON main__ai_positioning_reports
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__ai_positioning_reports_update BEFORE UPDATE ON main__ai_positioning_reports
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__ai_waitlist_leads_insert BEFORE INSERT ON main__ai_waitlist_leads
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__ai_waitlist_leads_update BEFORE UPDATE ON main__ai_waitlist_leads
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__feedback_reports_insert BEFORE INSERT ON main__feedback_reports
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__feedback_reports_update BEFORE UPDATE ON main__feedback_reports
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__offer_posts_insert BEFORE INSERT ON main__offer_posts
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__offer_posts_update BEFORE UPDATE ON main__offer_posts
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__offer_comments_insert BEFORE INSERT ON main__offer_comments
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__offer_comments_update BEFORE UPDATE ON main__offer_comments
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__offer_post_follows_insert BEFORE INSERT ON main__offer_post_follows
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__offer_post_follows_update BEFORE UPDATE ON main__offer_post_follows
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__billing_fill_sessions_insert BEFORE INSERT ON main__billing_fill_sessions
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__billing_fill_sessions_update BEFORE UPDATE ON main__billing_fill_sessions
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__billing_orders_insert BEFORE INSERT ON main__billing_orders
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__billing_orders_update BEFORE UPDATE ON main__billing_orders
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__user_entitlements_insert BEFORE INSERT ON main__user_entitlements
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__user_entitlements_update BEFORE UPDATE ON main__user_entitlements
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__notices_insert BEFORE INSERT ON main__notices
WHEN NEW.created_by IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.created_by AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_main__notices_update BEFORE UPDATE ON main__notices
WHEN NEW.created_by IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.created_by AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__account_entitlements_insert BEFORE INSERT ON autofill__account_entitlements
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__account_entitlements_update BEFORE UPDATE ON autofill__account_entitlements
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__account_entitlement_devices_insert BEFORE INSERT ON autofill__account_entitlement_devices
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__account_entitlement_devices_update BEFORE UPDATE ON autofill__account_entitlement_devices
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__commercial_orders_insert BEFORE INSERT ON autofill__commercial_orders
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__commercial_orders_update BEFORE UPDATE ON autofill__commercial_orders
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__user_vaults_insert BEFORE INSERT ON autofill__user_vaults
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
CREATE TRIGGER IF NOT EXISTS deletion_guard_autofill__user_vaults_update BEFORE UPDATE ON autofill__user_vaults
WHEN NEW.user_id IS NOT NULL AND EXISTS(SELECT 1 FROM main__auth_subjects WHERE id=NEW.user_id AND deleted_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
