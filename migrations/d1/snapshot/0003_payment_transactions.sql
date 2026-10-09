-- Local candidate only. Seed values are from the two encrypted PG snapshots.
-- Before final cutover, reconcile with the final source sequence states again.
CREATE TABLE _business_revisions (name TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL CHECK(version>=0)) STRICT;
INSERT INTO _business_revisions VALUES ('autofill_payment',0);
CREATE TABLE _business_transaction_guards (id TEXT PRIMARY KEY NOT NULL, valid INTEGER NOT NULL CHECK(valid=1)) STRICT;
CREATE TABLE _business_sequences (name TEXT PRIMARY KEY NOT NULL, next_value INTEGER NOT NULL CHECK(next_value>0)) STRICT;
INSERT INTO _business_sequences VALUES
 ('main__desktop_download_attempts',92),
 ('main__site_visit_events',106396),
 ('autofill__account_entitlement_events',37),
 ('autofill__commercial_payment_events',63),
 ('autofill__license_events',148);
