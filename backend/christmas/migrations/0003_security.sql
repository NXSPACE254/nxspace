ALTER TABLE Claims ADD COLUMN request_key_version TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE Claims ADD COLUMN capability_expires_at INTEGER;
-- Upgrade existing local claims with an audited metadata update. No credential
-- plaintext is needed; expiry follows the existing contact retention deadline.
UPDATE Claims SET capability_expires_at=(SELECT retention_until FROM DonorContacts WHERE id=Claims.donor_contact_id),
  version=version+1,last_reason='security_expiry_backfill',actor_type='system',actor_ref='security_migration';
ALTER TABLE DonorContacts ADD COLUMN protection_actor TEXT REFERENCES AdminUsers(id);
ALTER TABLE DonorContacts ADD COLUMN protection_reason TEXT;
ALTER TABLE DonorContacts ADD COLUMN legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1));
CREATE TABLE SecurityRateLimits (
  scope_hash TEXT NOT NULL CHECK(length(scope_hash)=64),
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL CHECK(hits>0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY(scope_hash,window_start)
);
CREATE TRIGGER contact_erasure_final BEFORE UPDATE ON DonorContacts WHEN OLD.erased_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'CONTACT_ALREADY_ERASED'); END;
CREATE TRIGGER claim_request_key_immutable BEFORE UPDATE OF request_key_version ON Claims
WHEN NEW.request_key_version<>OLD.request_key_version
BEGIN SELECT RAISE(ABORT,'REQUEST_KEY_IMMUTABLE'); END;
CREATE TRIGGER capability_revocation_final BEFORE UPDATE OF capability_revoked_at ON Claims
WHEN OLD.capability_revoked_at IS NOT NULL AND NEW.capability_revoked_at IS NOT OLD.capability_revoked_at
BEGIN SELECT RAISE(ABORT,'CAPABILITY_REVOCATION_FINAL'); END;
CREATE TRIGGER capability_expiry_required BEFORE INSERT ON Claims WHEN NEW.capability_expires_at IS NULL OR NEW.capability_expires_at<=unixepoch()
BEGIN SELECT RAISE(ABORT,'CAPABILITY_EXPIRY_REQUIRED'); END;
CREATE TRIGGER contact_protection_guard BEFORE UPDATE OF ciphertext,key_version,erased_at ON DonorContacts BEGIN
  SELECT CASE WHEN NEW.protection_actor IS NULL OR length(trim(COALESCE(NEW.protection_reason,'')))=0 OR NOT EXISTS(
    SELECT 1 FROM AdminUsers a JOIN UserRoles r ON r.user_id=a.id WHERE a.id=NEW.protection_actor AND a.status='active' AND r.role_id='nx_admin' AND r.campaign_id=OLD.campaign_id
  ) THEN RAISE(ABORT,'CONTACT_PROTECTION_FORBIDDEN') END;
  SELECT CASE WHEN NEW.erased_at IS NOT NULL AND (OLD.retention_until>unixepoch() OR OLD.legal_hold=1 OR NEW.ciphertext<>'ERASED' OR NEW.key_version<>'erased'
    OR EXISTS(SELECT 1 FROM Claims WHERE donor_contact_id=OLD.id AND status NOT IN ('cancelled','expired','delivered'))) THEN RAISE(ABORT,'ERASURE_NOT_ALLOWED') END;
END;
CREATE TRIGGER contact_protection_audit AFTER UPDATE OF ciphertext,key_version,erased_at ON DonorContacts BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'contact',NEW.id,CASE WHEN NEW.erased_at IS NULL THEN 'contact.reencrypted' ELSE 'contact.erased' END,'admin',NEW.protection_actor,NEW.protection_reason);
END;
