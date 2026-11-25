CREATE TABLE StaffIdentities (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  auth_email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  provider_user_id TEXT UNIQUE,
  credential_change_pending INTEGER NOT NULL DEFAULT 0 CHECK(credential_change_pending IN (0,1)),
  version INTEGER NOT NULL DEFAULT 0,
  must_change INTEGER NOT NULL DEFAULT 1 CHECK(must_change IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  is_super INTEGER NOT NULL DEFAULT 0 CHECK(is_super IN (0,1)),
  mfa_counter INTEGER NOT NULL DEFAULT -1,
  CHECK((is_super = 1) = (username = 'talgo292')),
  CHECK(provider_user_id IS NOT NULL OR (credential_change_pending=1 AND enabled=0))
);
CREATE UNIQUE INDEX staff_single_super ON StaffIdentities(is_super) WHERE is_super=1;
CREATE TABLE StaffSessions (
  token_hash TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES StaffIdentities(id),
  credential_version INTEGER NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at=issued_at+86400),
  elevated_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX staff_sessions_identity ON StaffSessions(identity_id, expires_at);
CREATE INDEX staff_sessions_expiry ON StaffSessions(expires_at);
CREATE TABLE StaffIdentityAudit (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  target_id TEXT,
  action TEXT NOT NULL,
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
);
