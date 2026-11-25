-- Replace only the three tables whose column constraints change.

-- D1 applies a migration as one transaction; defer references while copying.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE _deadline0022_Campaigns AS SELECT rowid AS old_rowid,id,slug,title,partner_label,status,collaboration_confirmed,privacy_version,opens_at,closes_at,claim_deadline_at,gift_due_at,created_at FROM Campaigns;

DROP TABLE Campaigns;

CREATE TABLE Campaigns (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  partner_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','archived')),
  collaboration_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(collaboration_confirmed IN (0,1)),
  privacy_version TEXT NOT NULL,
  opens_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  claim_deadline_at INTEGER,
  gift_due_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(opens_at < closes_at AND opens_at < COALESCE(claim_deadline_at,closes_at)
    AND (gift_due_at IS NULL OR min(closes_at,COALESCE(claim_deadline_at,closes_at)) <= gift_due_at)),
  CHECK(status <> 'open' OR collaboration_confirmed = 1)
);

INSERT INTO Campaigns(rowid,id,slug,title,partner_label,status,collaboration_confirmed,privacy_version,opens_at,closes_at,claim_deadline_at,gift_due_at,created_at) SELECT old_rowid,id,slug,title,partner_label,status,collaboration_confirmed,privacy_version,opens_at,closes_at,claim_deadline_at,gift_due_at,created_at FROM _deadline0022_Campaigns;

DROP TABLE _deadline0022_Campaigns;

CREATE TABLE _deadline0022_CampaignOperatingRules AS SELECT rowid AS old_rowid,campaign_id,bookhouse_id,automatic_release,reminder_days,delivery_days,expected_delivery_at,direct_claims FROM CampaignOperatingRules;

DROP TABLE CampaignOperatingRules;

CREATE TABLE CampaignOperatingRules (
  campaign_id TEXT PRIMARY KEY REFERENCES Campaigns(id),
  bookhouse_id TEXT NOT NULL REFERENCES Organisations(id),
  automatic_release INTEGER NOT NULL DEFAULT 0 CHECK(automatic_release=0),
  reminder_days INTEGER CHECK(reminder_days BETWEEN 1 AND 30)
, delivery_days INTEGER CHECK(delivery_days BETWEEN 1 AND 90), expected_delivery_at INTEGER, direct_claims INTEGER NOT NULL DEFAULT 0 CHECK(direct_claims IN (0,1)));

INSERT INTO CampaignOperatingRules(rowid,campaign_id,bookhouse_id,automatic_release,reminder_days,delivery_days,expected_delivery_at,direct_claims) SELECT old_rowid,campaign_id,bookhouse_id,automatic_release,reminder_days,delivery_days,expected_delivery_at,direct_claims FROM _deadline0022_CampaignOperatingRules;

DROP TABLE _deadline0022_CampaignOperatingRules;

CREATE TABLE _deadline0022_Claims AS SELECT rowid AS old_rowid,id,campaign_id,wish_id,donor_contact_id,status,exception_from_status,source,idempotency_hash,request_hash,capability_hash,claimed_at,expires_at,gift_due_at,updated_at,version,actor_type,actor_ref,last_reason,completed_notified_at,capability_revoked_at,request_key_version,capability_expires_at,portal_id,assisted_unit_id,assisted_verifier_hash,planned_site_id FROM Claims;

DROP TABLE Claims;

CREATE TABLE Claims (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  wish_id TEXT NOT NULL,
  donor_contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK(status IN ('claimed','gift_received','handed_over','delivered','cancelled','expired','exception')),
  exception_from_status TEXT CHECK(exception_from_status IN ('claimed','gift_received','handed_over','delivered')),
  source TEXT NOT NULL CHECK(source IN ('online','paper','assisted')),
  idempotency_hash TEXT NOT NULL CHECK(length(idempotency_hash)=64),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  capability_hash TEXT NOT NULL UNIQUE CHECK(length(capability_hash)=64),
  claimed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  gift_due_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  version INTEGER NOT NULL DEFAULT 0,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('donor','admin','system')),
  actor_ref TEXT NOT NULL,
  last_reason TEXT NOT NULL CHECK(length(trim(last_reason))>0),
  completed_notified_at INTEGER,
  capability_revoked_at INTEGER, request_key_version TEXT NOT NULL DEFAULT 'legacy', capability_expires_at INTEGER, portal_id TEXT REFERENCES DonorPortals(id), assisted_unit_id TEXT REFERENCES Organisations(id), assisted_verifier_hash TEXT, planned_site_id TEXT REFERENCES Organisations(id),
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id),
  FOREIGN KEY(donor_contact_id,campaign_id) REFERENCES DonorContacts(id,campaign_id),
  UNIQUE(campaign_id,idempotency_hash),
  UNIQUE(id,campaign_id),
  CHECK(expires_at > claimed_at AND gift_due_at >= expires_at),
  CHECK((status='exception' AND exception_from_status IS NOT NULL) OR (status<>'exception' AND exception_from_status IS NULL))
);

INSERT INTO Claims(rowid,id,campaign_id,wish_id,donor_contact_id,status,exception_from_status,source,idempotency_hash,request_hash,capability_hash,claimed_at,expires_at,gift_due_at,updated_at,version,actor_type,actor_ref,last_reason,completed_notified_at,capability_revoked_at,request_key_version,capability_expires_at,portal_id,assisted_unit_id,assisted_verifier_hash,planned_site_id) SELECT old_rowid,id,campaign_id,wish_id,donor_contact_id,status,exception_from_status,source,idempotency_hash,request_hash,capability_hash,claimed_at,expires_at,gift_due_at,updated_at,version,actor_type,actor_ref,last_reason,completed_notified_at,capability_revoked_at,request_key_version,capability_expires_at,portal_id,assisted_unit_id,assisted_verifier_hash,planned_site_id FROM _deadline0022_Claims;

DROP TABLE _deadline0022_Claims;

CREATE UNIQUE INDEX one_effective_claim_per_wish ON Claims(wish_id)
  WHERE status NOT IN ('cancelled','expired');

CREATE TRIGGER claim_no_delete BEFORE DELETE ON Claims BEGIN SELECT RAISE(ABORT,'CLAIM_HISTORY_REQUIRED'); END;

CREATE TRIGGER claim_insert_sync AFTER INSERT ON Claims BEGIN
  UPDATE Wishes SET status='claimed',version=version+1,updated_at=unixepoch() WHERE id=NEW.wish_id;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,to_status,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'claim',NEW.id,'claim.created','claimed',NEW.actor_type,NEW.actor_ref,NEW.last_reason);
END;

CREATE TRIGGER claim_update_guard BEFORE UPDATE ON Claims BEGIN
  SELECT CASE WHEN NEW.version<>OLD.version+1 OR length(trim(NEW.last_reason))=0 THEN RAISE(ABORT,'REASON_OR_VERSION_REQUIRED') END;
  SELECT CASE WHEN NEW.status=OLD.status AND NEW.exception_from_status IS NOT OLD.exception_from_status THEN RAISE(ABORT,'EXCEPTION_ORIGIN_IMMUTABLE') END;
END;

CREATE TRIGGER claim_metadata_audit AFTER UPDATE ON Claims WHEN NEW.status=OLD.status BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,from_status,to_status,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'claim',NEW.id,'claim.metadata_updated',OLD.status,NEW.status,NEW.actor_type,NEW.actor_ref,NEW.last_reason);
END;

CREATE TRIGGER claim_transition_guard BEFORE UPDATE OF status ON Claims WHEN NEW.status<>OLD.status BEGIN
  SELECT CASE WHEN NOT (
    (OLD.status='claimed' AND NEW.status IN ('gift_received','cancelled','expired','exception')) OR
    (OLD.status='gift_received' AND NEW.status IN ('handed_over','exception')) OR
    (OLD.status='handed_over' AND NEW.status IN ('delivered','exception')) OR
    (OLD.status='delivered' AND NEW.status='exception') OR
    (OLD.status='exception' AND NEW.status=OLD.exception_from_status)
  ) THEN RAISE(ABORT,'INVALID_TRANSITION') END;
  SELECT CASE WHEN length(trim(NEW.last_reason))=0 OR NEW.version<>OLD.version+1 THEN RAISE(ABORT,'REASON_OR_VERSION_REQUIRED') END;
  SELECT CASE WHEN NEW.status='exception' AND NEW.exception_from_status<>OLD.status THEN RAISE(ABORT,'EXCEPTION_ORIGIN_INVALID') END;
  SELECT CASE WHEN NEW.status='expired' AND OLD.expires_at>unixepoch() THEN RAISE(ABORT,'NOT_EXPIRED') END;
  SELECT CASE WHEN NEW.status='gift_received' AND NOT EXISTS(SELECT 1 FROM GiftReceipts WHERE claim_id=NEW.id) THEN RAISE(ABORT,'RECEIPT_REQUIRED') END;
  SELECT CASE WHEN NEW.status='handed_over' AND NOT EXISTS(SELECT 1 FROM HandoffItems WHERE claim_id=NEW.id) THEN RAISE(ABORT,'HANDOFF_REQUIRED') END;
  SELECT CASE WHEN NEW.status='delivered' AND NOT EXISTS(SELECT 1 FROM DeliveryConfirmations WHERE claim_id=NEW.id) THEN RAISE(ABORT,'DELIVERY_REQUIRED') END;
END;

CREATE TRIGGER claim_update_sync AFTER UPDATE OF status ON Claims WHEN NEW.status<>OLD.status BEGIN
  UPDATE Wishes SET status=NEW.status,version=version+1,updated_at=unixepoch() WHERE id=NEW.wish_id;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,from_status,to_status,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'claim',NEW.id,'claim.transition',OLD.status,NEW.status,NEW.actor_type,NEW.actor_ref,NEW.last_reason);
END;

CREATE TRIGGER capability_change_guard BEFORE UPDATE OF capability_hash ON Claims WHEN NEW.capability_hash<>OLD.capability_hash BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM CapabilityRotations WHERE claim_id=OLD.id AND old_hash=OLD.capability_hash AND new_hash=NEW.capability_hash AND expected_version=OLD.version)
    THEN RAISE(ABORT,'ROTATION_REQUIRED') END;
END;

CREATE TRIGGER claim_request_key_immutable BEFORE UPDATE OF request_key_version ON Claims
WHEN NEW.request_key_version<>OLD.request_key_version
BEGIN SELECT RAISE(ABORT,'REQUEST_KEY_IMMUTABLE'); END;

CREATE TRIGGER capability_revocation_final BEFORE UPDATE OF capability_revoked_at ON Claims
WHEN OLD.capability_revoked_at IS NOT NULL AND NEW.capability_revoked_at IS NOT OLD.capability_revoked_at
BEGIN SELECT RAISE(ABORT,'CAPABILITY_REVOCATION_FINAL'); END;

CREATE TRIGGER capability_expiry_required BEFORE INSERT ON Claims WHEN NEW.capability_expires_at IS NULL OR NEW.capability_expires_at<=unixepoch()
BEGIN SELECT RAISE(ABORT,'CAPABILITY_EXPIRY_REQUIRED'); END;

CREATE TRIGGER wish_claim_deadline_guard BEFORE INSERT ON Claims WHEN EXISTS(SELECT 1 FROM Wishes WHERE id=NEW.wish_id AND claim_due_at IS NOT NULL AND claim_due_at<=unixepoch()) BEGIN SELECT RAISE(ABORT,'WISH_NOT_AVAILABLE'); END;

CREATE TRIGGER operational_claim_owner_immutable BEFORE UPDATE ON Claims WHEN NEW.portal_id IS NOT OLD.portal_id OR NEW.assisted_unit_id IS NOT OLD.assisted_unit_id OR NEW.assisted_verifier_hash IS NOT OLD.assisted_verifier_hash BEGIN SELECT RAISE(ABORT,'CLAIM_OWNER_IMMUTABLE'); END;

CREATE TRIGGER case_created AFTER INSERT ON Claims BEGIN INSERT INTO CaseFiles(claim_id) VALUES(NEW.id); END;

CREATE TRIGGER claim_insert_guard BEFORE INSERT ON Claims BEGIN
 SELECT CASE WHEN NEW.status<>'claimed' THEN RAISE(ABORT,'INITIAL_STATUS_INVALID') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Wishes w JOIN Campaigns c ON c.id=w.campaign_id WHERE w.id=NEW.wish_id AND w.campaign_id=NEW.campaign_id AND w.status='available' AND w.publication_status='approved' AND c.status='open' AND c.collaboration_confirmed=1 AND c.opens_at<=unixepoch() AND c.closes_at>unixepoch() AND NEW.claimed_at=unixepoch() AND NEW.expires_at<=COALESCE(c.claim_deadline_at,c.closes_at) AND NEW.gift_due_at IS min(COALESCE((CAST((NEW.claimed_at+28800)/86400 AS INTEGER)+(SELECT delivery_days FROM CampaignOperatingRules r WHERE r.campaign_id=c.id)+1)*86400-28801,c.gift_due_at),COALESCE(c.gift_due_at,(CAST((NEW.claimed_at+28800)/86400 AS INTEGER)+(SELECT delivery_days FROM CampaignOperatingRules r WHERE r.campaign_id=c.id)+1)*86400-28801))) THEN RAISE(ABORT,'WISH_NOT_AVAILABLE') END;
END;

CREATE TRIGGER cancelled_proof AFTER UPDATE OF status ON Claims WHEN NEW.status='cancelled' BEGIN UPDATE CaseFiles SET proof_status='not_required' WHERE claim_id=NEW.id; END;

CREATE TRIGGER claim_identity_immutable BEFORE UPDATE ON Claims
WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id OR NEW.wish_id<>OLD.wish_id
 OR NEW.donor_contact_id<>OLD.donor_contact_id OR NEW.idempotency_hash<>OLD.idempotency_hash
 OR NEW.request_hash<>OLD.request_hash OR NEW.claimed_at<>OLD.claimed_at
 OR NEW.expires_at<>OLD.expires_at OR NEW.source<>OLD.source
 OR (NEW.gift_due_at IS NOT OLD.gift_due_at AND NOT EXISTS(SELECT 1 FROM ClaimDeadlineExtensions e WHERE e.claim_id=OLD.id AND e.expected_version=OLD.version AND e.old_due_at=OLD.gift_due_at AND e.new_due_at=NEW.gift_due_at AND e.actor_id=NEW.actor_ref AND NEW.status=OLD.status AND NEW.last_reason='deadline_extended'))
BEGIN SELECT RAISE(ABORT,'CLAIM_IDENTITY_IMMUTABLE'); END;

CREATE TRIGGER claim_public_snapshot AFTER INSERT ON Claims BEGIN
 INSERT INTO ClaimPublicSnapshots(claim_id,payload) SELECT NEW.id,json_object('publicCode',w.public_code,'publicNickname',w.public_nickname,'giftName',w.gift_name,'description',w.description,'specifications',w.specifications,'claimedAt',NEW.claimed_at,'giftDueAt',NEW.gift_due_at) FROM Wishes w WHERE w.id=NEW.wish_id;
END;

CREATE TRIGGER privacy_accept_guard BEFORE INSERT ON Claims WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id AND direct_claims=1) BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM DonorContacts d JOIN PrivacyStatements p ON p.campaign_id=d.campaign_id AND p.version=d.consent_version JOIN DonorPins n ON n.portal_id=NEW.portal_id WHERE d.id=NEW.donor_contact_id AND d.verification_method='self_reported') THEN RAISE(ABORT,'DIRECT_CONSENT_REQUIRED') END;
END;

CREATE TRIGGER privacy_accept AFTER INSERT ON Claims WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id AND direct_claims=1) BEGIN
 INSERT INTO ClaimPrivacyAcceptances(claim_id,campaign_id,privacy_version) SELECT NEW.id,NEW.campaign_id,consent_version FROM DonorContacts WHERE id=NEW.donor_contact_id;
END;

DROP TRIGGER wish_deadlines_guard;

CREATE TRIGGER wish_deadlines_guard BEFORE UPDATE OF claim_due_at,gift_due_at ON Wishes BEGIN
  SELECT CASE WHEN NEW.claim_due_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM Campaigns WHERE id=NEW.campaign_id AND NEW.claim_due_at>opens_at AND NEW.claim_due_at<=COALESCE(claim_deadline_at,closes_at) AND (NEW.gift_due_at IS NULL OR (NEW.gift_due_at>=NEW.claim_due_at AND (gift_due_at IS NULL OR NEW.gift_due_at<=gift_due_at)))) THEN RAISE(ABORT,'INVALID_WISH_DEADLINES') END;
END;
