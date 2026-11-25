-- Additive local-preview authentication. No production service is enabled.
CREATE TABLE DonorPasswords (
 portal_id TEXT PRIMARY KEY REFERENCES DonorPortals(id),
 salt TEXT NOT NULL CHECK(length(salt)=32), password_hash TEXT NOT NULL CHECK(length(password_hash)=64),
 iterations INTEGER NOT NULL CHECK(iterations=600000), updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE DonorLoginAttempts (campaign_id TEXT NOT NULL, email_hash TEXT NOT NULL, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL, PRIMARY KEY(campaign_id,email_hash));
CREATE TABLE DonorAuthEvents (id TEXT PRIMARY KEY,portal_id TEXT NOT NULL REFERENCES DonorPortals(id),action TEXT NOT NULL CHECK(action IN ('password_set','password_login')),created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TRIGGER donor_auth_no_update BEFORE UPDATE ON DonorAuthEvents BEGIN SELECT RAISE(ABORT,'AUTH_APPEND_ONLY'); END;
CREATE TRIGGER donor_auth_no_delete BEFORE DELETE ON DonorAuthEvents BEGIN SELECT RAISE(ABORT,'AUTH_APPEND_ONLY'); END;
