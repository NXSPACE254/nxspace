-- Additive extension of the existing wishes, claims and contact model.
ALTER TABLE Wishes ADD COLUMN public_nickname TEXT NOT NULL DEFAULT '';
ALTER TABLE Wishes ADD COLUMN claim_due_at INTEGER;
ALTER TABLE Wishes ADD COLUMN gift_due_at INTEGER;
ALTER TABLE Wishes ADD COLUMN created_at INTEGER;
ALTER TABLE DonorContacts ADD COLUMN phone_lookup_hash TEXT;
ALTER TABLE DonorContacts ADD COLUMN phone_lookup_version TEXT;
CREATE INDEX contact_phone_lookup ON DonorContacts(campaign_id,phone_lookup_hash);
CREATE TABLE WishPrivateProfiles (
  wish_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  key_version TEXT NOT NULL,
  retention_until INTEGER NOT NULL,
  legal_hold INTEGER NOT NULL DEFAULT 0 CHECK(legal_hold IN (0,1)),
  erased_at INTEGER,
  updated_by TEXT NOT NULL REFERENCES AdminUsers(id),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id)
);
CREATE TABLE WishNameAccess (
  wish_id TEXT NOT NULL REFERENCES Wishes(id),
  user_id TEXT NOT NULL REFERENCES AdminUsers(id),
  expires_at INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  PRIMARY KEY(wish_id,user_id)
);
CREATE TABLE WishChanges (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  wish_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  expected_version INTEGER NOT NULL,
  idempotency_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id),
  UNIQUE(campaign_id,actor_id,idempotency_hash)
);
CREATE TRIGGER wish_change_guard BEFORE INSERT ON WishChanges BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM AdminUsers a JOIN UserRoles r ON r.user_id=a.id WHERE a.id=NEW.actor_id AND a.status='active' AND r.campaign_id=NEW.campaign_id AND r.role_id IN ('nx_admin','nx_staff'))
    OR NOT EXISTS(SELECT 1 FROM Wishes WHERE id=NEW.wish_id AND campaign_id=NEW.campaign_id AND version=NEW.expected_version)
    THEN RAISE(ABORT,'WISH_EDIT_CONFLICT') END;
  SELECT CASE WHEN json_extract(NEW.payload,'$.publicationStatus')='approved' AND NOT EXISTS(SELECT 1 FROM UserRoles WHERE user_id=NEW.actor_id AND campaign_id=NEW.campaign_id AND role_id='nx_admin') THEN RAISE(ABORT,'PUBLICATION_FORBIDDEN') END;
END;
CREATE TRIGGER wish_change_apply AFTER INSERT ON WishChanges BEGIN
  UPDATE Wishes SET public_nickname=json_extract(NEW.payload,'$.publicNickname'),title=json_extract(NEW.payload,'$.title'),description=json_extract(NEW.payload,'$.description'),gift_name=json_extract(NEW.payload,'$.giftName'),specifications=json_extract(NEW.payload,'$.specifications'),organisation_id=json_extract(NEW.payload,'$.organisationId'),claim_due_at=json_extract(NEW.payload,'$.claimDueAt'),gift_due_at=json_extract(NEW.payload,'$.giftDueAt'),publication_status=json_extract(NEW.payload,'$.publicationStatus'),version=version+1,updated_at=unixepoch() WHERE id=NEW.wish_id;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(NEW.campaign_id,'wish',NEW.wish_id,'wish.edited','admin',NEW.actor_id,'reviewed_content');
END;
CREATE TRIGGER wish_change_immutable BEFORE UPDATE ON WishChanges BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER wish_change_no_delete BEFORE DELETE ON WishChanges BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER wish_deadlines_guard BEFORE UPDATE OF claim_due_at,gift_due_at ON Wishes BEGIN
  SELECT CASE WHEN NEW.claim_due_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM Campaigns WHERE id=NEW.campaign_id AND NEW.claim_due_at>opens_at AND NEW.claim_due_at<=claim_deadline_at AND NEW.gift_due_at>=NEW.claim_due_at AND NEW.gift_due_at<=gift_due_at) THEN RAISE(ABORT,'INVALID_WISH_DEADLINES') END;
END;
CREATE TRIGGER wish_claimed_content_guard BEFORE UPDATE ON Wishes WHEN EXISTS(SELECT 1 FROM Claims WHERE wish_id=OLD.id) AND (NEW.title IS NOT OLD.title OR NEW.description IS NOT OLD.description OR NEW.gift_name IS NOT OLD.gift_name OR NEW.specifications IS NOT OLD.specifications OR NEW.claim_due_at IS NOT OLD.claim_due_at OR NEW.gift_due_at IS NOT OLD.gift_due_at) BEGIN SELECT RAISE(ABORT,'CLAIMED_CONTENT_IMMUTABLE'); END;
CREATE TRIGGER wish_claim_deadline_guard BEFORE INSERT ON Claims WHEN EXISTS(SELECT 1 FROM Wishes WHERE id=NEW.wish_id AND claim_due_at IS NOT NULL AND claim_due_at<=unixepoch()) BEGIN SELECT RAISE(ABORT,'WISH_NOT_AVAILABLE'); END;
CREATE TRIGGER wish_private_audit AFTER INSERT ON WishPrivateProfiles BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(NEW.campaign_id,'wish',NEW.wish_id,'wish.private_saved','admin',NEW.updated_by,'private_identity');
END;
CREATE TRIGGER wish_private_update_guard BEFORE UPDATE ON WishPrivateProfiles BEGIN
  SELECT CASE WHEN OLD.erased_at IS NOT NULL OR NEW.wish_id<>OLD.wish_id OR NEW.campaign_id<>OLD.campaign_id THEN RAISE(ABORT,'PRIVATE_PROFILE_IMMUTABLE') END;
  SELECT CASE WHEN NEW.erased_at IS NOT NULL AND (OLD.retention_until>unixepoch() OR OLD.legal_hold=1 OR NEW.ciphertext<>'ERASED') THEN RAISE(ABORT,'RETENTION_NOT_DUE') END;
END;
CREATE TRIGGER wish_private_update_audit AFTER UPDATE ON WishPrivateProfiles BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(NEW.campaign_id,'wish',NEW.wish_id,CASE WHEN NEW.erased_at IS NULL THEN 'wish.private_saved' ELSE 'wish.private_erased' END,'admin',NEW.updated_by,'private_identity');
END;
-- Existing Attachments require a claim. WishMedia covers pre-claim wish cards
-- and campaign media without rebuilding that evidence table or its foreign keys.
CREATE TABLE WishMedia (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  wish_id TEXT NOT NULL,
  claim_id TEXT,
  evidence_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('wish_card','wish_image','thank_you','receipt_record','delivery_proof','activity_photo','institution_tax_receipt')),
  visibility TEXT NOT NULL DEFAULT 'staff' CHECK(visibility IN ('public','donor','staff')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN ('image/png','image/jpeg','application/pdf')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 65536),
  sha256 TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES AdminUsers(id),
  reviewed_by TEXT REFERENCES AdminUsers(id),
  review_reason TEXT,
  issuing_organisation TEXT NOT NULL DEFAULT '',
  retention_until INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id),
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id),
  FOREIGN KEY(evidence_id,claim_id,campaign_id) REFERENCES Attachments(id,claim_id,campaign_id),
  CHECK(evidence_id IS NULL OR claim_id IS NOT NULL),
  CHECK(visibility<>'donor' OR claim_id IS NOT NULL),
  CHECK(kind<>'institution_tax_receipt' OR length(issuing_organisation)>0)
);
CREATE TRIGGER media_review_guard BEFORE UPDATE ON WishMedia BEGIN
  SELECT CASE WHEN NEW.id<>OLD.id OR NEW.wish_id<>OLD.wish_id OR NEW.campaign_id<>OLD.campaign_id OR NEW.object_key<>OLD.object_key OR NEW.claim_id IS NOT OLD.claim_id OR NEW.kind<>OLD.kind OR NEW.version<>OLD.version+1 OR NEW.reviewed_by IS NULL OR NOT EXISTS(SELECT 1 FROM AdminUsers a JOIN UserRoles r ON r.user_id=a.id WHERE a.id=NEW.reviewed_by AND a.status='active' AND r.campaign_id=NEW.campaign_id AND r.role_id='nx_admin') THEN RAISE(ABORT,'MEDIA_REVIEW_FORBIDDEN') END;
END;
CREATE TRIGGER media_review_audit AFTER UPDATE ON WishMedia BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(NEW.campaign_id,'media',NEW.id,'media.reviewed','admin',NEW.reviewed_by,'privacy_review');
END;
CREATE TABLE ClaimPublicMessages (
  claim_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  reviewed_by TEXT NOT NULL REFERENCES AdminUsers(id),
  reviewed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id)
);
-- Fulfilment preferences only: contact/recipient/address remain encrypted in
-- DonorContacts. There is deliberately no dispatch API or enabled mail adapter.
CREATE TABLE DocumentRequests (
  claim_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  material_proof INTEGER NOT NULL DEFAULT 0 CHECK(material_proof IN (0,1)),
  paper_thank_you INTEGER NOT NULL DEFAULT 0 CHECK(paper_thank_you IN (0,1)),
  electronic_thank_you INTEGER NOT NULL DEFAULT 0 CHECK(electronic_thank_you IN (0,1)),
  electronic_proof INTEGER NOT NULL DEFAULT 0 CHECK(electronic_proof IN (0,1)),
  dispatch_status TEXT NOT NULL DEFAULT 'not_enabled' CHECK(dispatch_status IN ('not_enabled','pending','sent')),
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id)
);
CREATE TABLE DocumentDispatchEvents (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES DocumentRequests(claim_id),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  status TEXT NOT NULL CHECK(status IN ('pending','sent','cancelled')),
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reason_code TEXT NOT NULL
);
CREATE TRIGGER dispatch_events_immutable BEFORE UPDATE ON DocumentDispatchEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER dispatch_events_no_delete BEFORE DELETE ON DocumentDispatchEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
