-- Draft for D1. No deployment or real data. All timestamps are UTC Unix seconds.
PRAGMA foreign_keys = ON;

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
  claim_deadline_at INTEGER NOT NULL,
  gift_due_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(opens_at < closes_at AND closes_at <= claim_deadline_at AND claim_deadline_at <= gift_due_at),
  CHECK(status <> 'open' OR collaboration_confirmed = 1)
);

CREATE TABLE AdminUsers (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(issuer, subject)
);
CREATE TABLE Roles (
  id TEXT PRIMARY KEY CHECK(id IN ('nx_admin','nx_staff','partner_staff'))
);
INSERT INTO Roles(id) VALUES ('nx_admin'),('nx_staff'),('partner_staff');
CREATE TABLE UserRoles (
  user_id TEXT NOT NULL REFERENCES AdminUsers(id),
  role_id TEXT NOT NULL REFERENCES Roles(id),
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  PRIMARY KEY(user_id,role_id,campaign_id)
);

CREATE TABLE Wishes (
  id TEXT PRIMARY KEY,
  public_code TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  child_alias TEXT NOT NULL,
  age_band TEXT NOT NULL CHECK(age_band IN ('0-5','6-9','10-12','13-15','16-18')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  category TEXT NOT NULL,
  reference_amount INTEGER NOT NULL CHECK(reference_amount >= 0),
  specifications TEXT NOT NULL DEFAULT '',
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK(publication_status IN ('draft','approved')),
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','claimed','gift_received','handed_over','delivered','cancelled','expired','exception')),
  version INTEGER NOT NULL DEFAULT 0,
  reopened_by TEXT REFERENCES AdminUsers(id),
  reopen_reason TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(id,campaign_id)
);
CREATE INDEX wishes_public ON Wishes(campaign_id,publication_status,status,category,reference_amount);
CREATE TRIGGER wish_identity_immutable BEFORE UPDATE ON Wishes
WHEN NEW.id<>OLD.id OR NEW.public_code<>OLD.public_code OR NEW.campaign_id<>OLD.campaign_id
BEGIN SELECT RAISE(ABORT,'WISH_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER wish_no_delete BEFORE DELETE ON Wishes BEGIN SELECT RAISE(ABORT,'WISH_HISTORY_REQUIRED'); END;

CREATE TABLE DonorContacts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  ciphertext TEXT NOT NULL,
  key_version TEXT NOT NULL,
  verified_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL,
  retention_until INTEGER NOT NULL,
  erased_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(id,campaign_id)
);

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
  gift_due_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  version INTEGER NOT NULL DEFAULT 0,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('donor','admin','system')),
  actor_ref TEXT NOT NULL,
  last_reason TEXT NOT NULL CHECK(length(trim(last_reason))>0),
  completed_notified_at INTEGER,
  capability_revoked_at INTEGER,
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id),
  FOREIGN KEY(donor_contact_id,campaign_id) REFERENCES DonorContacts(id,campaign_id),
  UNIQUE(campaign_id,idempotency_hash),
  UNIQUE(id,campaign_id),
  CHECK(expires_at > claimed_at AND gift_due_at >= expires_at),
  CHECK((status='exception' AND exception_from_status IS NOT NULL) OR (status<>'exception' AND exception_from_status IS NULL))
);
-- Delivered still owns the wish; exception blocks new claims too.
CREATE UNIQUE INDEX one_effective_claim_per_wish ON Claims(wish_id)
  WHERE status NOT IN ('cancelled','expired');
CREATE TRIGGER claim_no_delete BEFORE DELETE ON Claims BEGIN SELECT RAISE(ABORT,'CLAIM_HISTORY_REQUIRED'); END;

CREATE TABLE Attachments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  claim_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','application/pdf')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
  verified_at INTEGER NOT NULL,
  retention_until INTEGER NOT NULL,
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id),
  UNIQUE(id,claim_id,campaign_id)
);
CREATE TABLE GiftReceipts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  claim_id TEXT NOT NULL UNIQUE,
  received_at INTEGER NOT NULL,
  received_by TEXT NOT NULL REFERENCES AdminUsers(id),
  location_code TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id),
  FOREIGN KEY(evidence_id,claim_id,campaign_id) REFERENCES Attachments(id,claim_id,campaign_id),
  UNIQUE(id,claim_id,campaign_id)
);
CREATE TABLE Handoffs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  handed_at INTEGER NOT NULL,
  handed_by TEXT NOT NULL REFERENCES AdminUsers(id),
  partner_accepted_by TEXT NOT NULL REFERENCES AdminUsers(id),
  partner_accepted_at INTEGER NOT NULL,
  location_code TEXT NOT NULL,
  CHECK(partner_accepted_at >= handed_at),
  CHECK(handed_by <> partner_accepted_by),
  UNIQUE(id,campaign_id)
);
CREATE TABLE HandoffItems (
  handoff_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  claim_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL,
  PRIMARY KEY(handoff_id,claim_id),
  FOREIGN KEY(handoff_id,campaign_id) REFERENCES Handoffs(id,campaign_id),
  FOREIGN KEY(receipt_id,claim_id,campaign_id) REFERENCES GiftReceipts(id,claim_id,campaign_id)
);
CREATE TABLE DeliveryConfirmations (
  claim_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  delivered_at INTEGER NOT NULL,
  confirmed_by TEXT NOT NULL REFERENCES AdminUsers(id),
  evidence_id TEXT NOT NULL,
  FOREIGN KEY(handoff_id,claim_id) REFERENCES HandoffItems(handoff_id,claim_id),
  FOREIGN KEY(evidence_id,claim_id,campaign_id) REFERENCES Attachments(id,claim_id,campaign_id)
);
CREATE TABLE CancellationRequests (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES Claims(id),
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES AdminUsers(id)
);
CREATE UNIQUE INDEX one_pending_cancellation ON CancellationRequests(claim_id) WHERE status='pending';

CREATE TRIGGER receipt_actor_guard BEFORE INSERT ON GiftReceipts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM UserRoles r JOIN AdminUsers u ON u.id=r.user_id
    WHERE r.user_id=NEW.received_by AND r.campaign_id=NEW.campaign_id AND r.role_id IN ('nx_admin','nx_staff') AND u.status='active')
    THEN RAISE(ABORT,'RECEIPT_ACTOR_FORBIDDEN') END;
END;
CREATE TRIGGER handoff_actor_guard BEFORE INSERT ON Handoffs BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM UserRoles r JOIN AdminUsers u ON u.id=r.user_id
    WHERE r.user_id=NEW.handed_by AND r.campaign_id=NEW.campaign_id AND r.role_id IN ('nx_admin','nx_staff') AND u.status='active')
    OR NOT EXISTS(SELECT 1 FROM UserRoles r JOIN AdminUsers u ON u.id=r.user_id
    WHERE r.user_id=NEW.partner_accepted_by AND r.campaign_id=NEW.campaign_id AND r.role_id='partner_staff' AND u.status='active')
    THEN RAISE(ABORT,'HANDOFF_ACTOR_FORBIDDEN') END;
END;
CREATE TRIGGER delivery_actor_guard BEFORE INSERT ON DeliveryConfirmations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM UserRoles r JOIN AdminUsers u ON u.id=r.user_id
    WHERE r.user_id=NEW.confirmed_by AND r.campaign_id=NEW.campaign_id AND r.role_id='partner_staff' AND u.status='active')
    THEN RAISE(ABORT,'DELIVERY_ACTOR_FORBIDDEN') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Handoffs h
    WHERE h.id=NEW.handoff_id AND h.campaign_id=NEW.campaign_id AND h.partner_accepted_at<=NEW.delivered_at)
    OR NEW.delivered_at>unixepoch() THEN RAISE(ABORT,'DELIVERY_TIME_INVALID') END;
END;

CREATE TABLE AuditLogs (
  id INTEGER PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL,
  actor_ref TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX audit_campaign_time ON AuditLogs(campaign_id,occurred_at,id);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON AuditLogs BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON AuditLogs BEGIN SELECT RAISE(ABORT,'AUDIT_APPEND_ONLY'); END;

CREATE TRIGGER claim_insert_guard BEFORE INSERT ON Claims BEGIN
  SELECT CASE WHEN NEW.status<>'claimed' THEN RAISE(ABORT,'INITIAL_STATUS_INVALID') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM Wishes w JOIN Campaigns c ON c.id=w.campaign_id
    WHERE w.id=NEW.wish_id AND w.campaign_id=NEW.campaign_id
      AND w.status='available' AND w.publication_status='approved'
      AND c.status='open' AND c.collaboration_confirmed=1
      AND c.opens_at<=unixepoch() AND c.closes_at>unixepoch()
      AND NEW.claimed_at=unixepoch() AND NEW.expires_at<=c.claim_deadline_at AND NEW.gift_due_at=c.gift_due_at
  ) THEN RAISE(ABORT,'WISH_NOT_AVAILABLE') END;
END;
CREATE TRIGGER claim_insert_sync AFTER INSERT ON Claims BEGIN
  UPDATE Wishes SET status='claimed',version=version+1,updated_at=unixepoch() WHERE id=NEW.wish_id;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,to_status,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'claim',NEW.id,'claim.created','claimed',NEW.actor_type,NEW.actor_ref,NEW.last_reason);
END;

CREATE TRIGGER claim_identity_immutable BEFORE UPDATE ON Claims
WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id OR NEW.wish_id<>OLD.wish_id
 OR NEW.donor_contact_id<>OLD.donor_contact_id OR NEW.idempotency_hash<>OLD.idempotency_hash
 OR NEW.request_hash<>OLD.request_hash OR NEW.claimed_at<>OLD.claimed_at
 OR NEW.capability_hash<>OLD.capability_hash OR NEW.expires_at<>OLD.expires_at
 OR NEW.gift_due_at<>OLD.gift_due_at OR NEW.source<>OLD.source
BEGIN SELECT RAISE(ABORT,'CLAIM_IDENTITY_IMMUTABLE'); END;

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

CREATE TRIGGER wish_state_guard BEFORE UPDATE OF status ON Wishes WHEN NEW.status<>OLD.status BEGIN
  SELECT CASE WHEN NOT (
    (NEW.status='available' AND OLD.status IN ('cancelled','expired')
      AND NEW.reopened_by IS NOT NULL AND length(trim(NEW.reopen_reason))>0
      AND NOT EXISTS(SELECT 1 FROM Claims WHERE wish_id=OLD.id AND status NOT IN ('cancelled','expired'))) OR
    (EXISTS(SELECT 1 FROM Claims WHERE wish_id=OLD.id AND status=NEW.status)
      AND NOT EXISTS(SELECT 1 FROM Claims WHERE wish_id=OLD.id AND status NOT IN ('cancelled','expired') AND status<>NEW.status))
  ) THEN RAISE(ABORT,'WISH_STATE_MUST_FOLLOW_CLAIM') END;
END;
CREATE TRIGGER wish_reopen_audit AFTER UPDATE OF status ON Wishes WHEN NEW.status='available' AND OLD.status<>NEW.status BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,from_status,to_status,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'wish',NEW.id,'wish.reopened',OLD.status,'available','admin',NEW.reopened_by,NEW.reopen_reason);
END;
