-- No plaintext credentials; append-only rotation history, same atomic trigger/audit.
CREATE TABLE CapabilityRotations (
  claim_id TEXT NOT NULL REFERENCES Claims(id),
  rotation_hash TEXT NOT NULL CHECK(length(rotation_hash)=64),
  old_hash TEXT NOT NULL CHECK(length(old_hash)=64),
  new_hash TEXT NOT NULL CHECK(length(new_hash)=64 AND new_hash<>old_hash),
  expected_version INTEGER NOT NULL CHECK(expected_version>=0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY(claim_id,rotation_hash)
);
CREATE TRIGGER rotation_no_update BEFORE UPDATE ON CapabilityRotations BEGIN SELECT RAISE(ABORT,'ROTATION_APPEND_ONLY'); END;
CREATE TRIGGER rotation_no_delete BEFORE DELETE ON CapabilityRotations BEGIN SELECT RAISE(ABORT,'ROTATION_APPEND_ONLY'); END;
DROP TRIGGER claim_identity_immutable;
CREATE TRIGGER claim_identity_immutable BEFORE UPDATE ON Claims
WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id OR NEW.wish_id<>OLD.wish_id
 OR NEW.donor_contact_id<>OLD.donor_contact_id OR NEW.idempotency_hash<>OLD.idempotency_hash
 OR NEW.request_hash<>OLD.request_hash OR NEW.claimed_at<>OLD.claimed_at
 OR NEW.expires_at<>OLD.expires_at OR NEW.gift_due_at<>OLD.gift_due_at OR NEW.source<>OLD.source
BEGIN SELECT RAISE(ABORT,'CLAIM_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER capability_change_guard BEFORE UPDATE OF capability_hash ON Claims WHEN NEW.capability_hash<>OLD.capability_hash BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM CapabilityRotations WHERE claim_id=OLD.id AND old_hash=OLD.capability_hash AND new_hash=NEW.capability_hash AND expected_version=OLD.version)
    THEN RAISE(ABORT,'ROTATION_REQUIRED') END;
END;
CREATE TRIGGER rotation_guard BEFORE INSERT ON CapabilityRotations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims WHERE id=NEW.claim_id AND capability_hash=NEW.old_hash AND capability_revoked_at IS NULL AND version=NEW.expected_version)
    THEN RAISE(ABORT,'CREDENTIAL_OR_VERSION_CONFLICT') END;
END;
CREATE TRIGGER rotation_apply AFTER INSERT ON CapabilityRotations BEGIN
  UPDATE Claims SET capability_hash=NEW.new_hash,version=version+1,actor_type='donor',actor_ref=id,last_reason='capability_rotated',updated_at=unixepoch() WHERE id=NEW.claim_id;
END;
