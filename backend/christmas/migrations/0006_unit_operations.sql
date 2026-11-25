-- Unit accounts extend the existing identity/organisation model, not a new IAM.
ALTER TABLE Organisations ADD COLUMN unit_kind TEXT NOT NULL DEFAULT 'beneficiary' CHECK(unit_kind IN ('beneficiary','admin','bookhouse','collection'));
CREATE TABLE OperatingAccounts (
  user_id TEXT NOT NULL REFERENCES AdminUsers(id),
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  organisation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('admin','bookhouse','collection')),
  revoked_at INTEGER,
  PRIMARY KEY(user_id,campaign_id),
  UNIQUE(campaign_id,organisation_id),
  FOREIGN KEY(organisation_id,campaign_id) REFERENCES Organisations(id,campaign_id)
);
CREATE TABLE CampaignOperatingRules (
  campaign_id TEXT PRIMARY KEY REFERENCES Campaigns(id),
  bookhouse_id TEXT NOT NULL REFERENCES Organisations(id),
  automatic_release INTEGER NOT NULL DEFAULT 0 CHECK(automatic_release=0),
  reminder_days INTEGER NOT NULL DEFAULT 3 CHECK(reminder_days BETWEEN 1 AND 30)
);
ALTER TABLE Wishes ADD COLUMN delivery_days INTEGER CHECK(delivery_days BETWEEN 1 AND 90);
ALTER TABLE WishChanges ADD COLUMN unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE WishChanges ADD COLUMN handler TEXT;
CREATE TRIGGER operational_wish_handler BEFORE INSERT ON WishChanges WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  SELECT CASE WHEN length(trim(COALESCE(NEW.handler,''))) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id AND a.organisation_id=NEW.unit_id AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'UNIT_HANDLER_REQUIRED') END;
END;
CREATE TRIGGER operational_wish_default_org AFTER INSERT ON Wishes WHEN NEW.organisation_id IS NULL AND EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  UPDATE Wishes SET organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) WHERE id=NEW.id;
END;
CREATE TABLE UnitActions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  unit_id TEXT NOT NULL REFERENCES Organisations(id),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  handler TEXT NOT NULL CHECK(length(trim(handler)) BETWEEN 2 AND 80),
  action TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TRIGGER unit_action_no_update BEFORE UPDATE ON UnitActions BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER unit_action_no_delete BEFORE DELETE ON UnitActions BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER unit_action_actor BEFORE INSERT ON UnitActions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id JOIN Organisations o ON o.id=a.organisation_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id AND a.organisation_id=NEW.unit_id AND a.revoked_at IS NULL AND u.status='active' AND o.active=1) THEN RAISE(ABORT,'UNIT_REVOKED_OR_FORBIDDEN') END;
END;
CREATE TABLE PublicWishProposals (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  wish_id TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  created_by TEXT NOT NULL REFERENCES AdminUsers(id),
  handler TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_by TEXT REFERENCES AdminUsers(id),
  reviewed_at INTEGER,
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id)
);
CREATE TABLE ProposalReviews (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES PublicWishProposals(id),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  handler TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TRIGGER proposal_review_guard BEFORE INSERT ON ProposalReviews BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM PublicWishProposals p JOIN OperatingAccounts a ON a.campaign_id=p.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE p.id=NEW.proposal_id AND p.status='pending' AND a.user_id=NEW.actor_id AND a.kind='admin' AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'PROPOSAL_REVIEW_FORBIDDEN') END;
END;
CREATE TRIGGER proposal_review_apply AFTER INSERT ON ProposalReviews BEGIN
  INSERT INTO WishChanges(id,campaign_id,wish_id,actor_id,expected_version,idempotency_hash,request_hash,payload,unit_id,handler)
    SELECT NEW.id,p.campaign_id,p.wish_id,NEW.actor_id,p.base_version,NEW.id,NEW.id,p.payload,a.organisation_id,NEW.handler FROM PublicWishProposals p JOIN OperatingAccounts a ON a.user_id=NEW.actor_id AND a.campaign_id=p.campaign_id WHERE p.id=NEW.proposal_id AND NEW.decision='approved';
  UPDATE PublicWishProposals SET status=NEW.decision,reviewed_by=NEW.actor_id,reviewed_at=unixepoch() WHERE id=NEW.proposal_id;
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id)
    SELECT NEW.id,p.campaign_id,a.organisation_id,NEW.actor_id,NEW.handler,'wish.proposal_reviewed',p.wish_id FROM PublicWishProposals p JOIN OperatingAccounts a ON a.user_id=NEW.actor_id AND a.campaign_id=p.campaign_id WHERE p.id=NEW.proposal_id;
END;
CREATE TRIGGER proposal_reviews_no_update BEFORE UPDATE ON ProposalReviews BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER proposal_reviews_no_delete BEFORE DELETE ON ProposalReviews BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER operational_publication_guard BEFORE INSERT ON WishChanges WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id AND a.revoked_at IS NULL AND u.status='active' AND (a.kind='admin' OR (a.kind='bookhouse' AND json_extract(NEW.payload,'$.publicationStatus')='draft' AND NOT EXISTS(SELECT 1 FROM Wishes w WHERE w.id=NEW.wish_id AND w.publication_status='approved')))) THEN RAISE(ABORT,'ADMIN_PUBLICATION_REQUIRED') END;
END;
CREATE TRIGGER operational_wish_audit AFTER INSERT ON WishChanges WHEN NEW.unit_id IS NOT NULL BEGIN
  UPDATE Wishes SET delivery_days=json_extract(NEW.payload,'$.deliveryDays') WHERE id=NEW.wish_id AND json_type(NEW.payload,'$.deliveryDays') IS NOT NULL;
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) VALUES(NEW.id||'-wish',NEW.campaign_id,NEW.unit_id,NEW.actor_id,NEW.handler,'wish.saved',NEW.wish_id);
END;
CREATE TRIGGER operational_delivery_days_guard BEFORE UPDATE OF delivery_days ON Wishes WHEN NEW.delivery_days IS NOT OLD.delivery_days AND EXISTS(SELECT 1 FROM Claims WHERE wish_id=OLD.id AND status NOT IN ('cancelled','expired')) BEGIN SELECT RAISE(ABORT,'CLAIMED_CONTENT_IMMUTABLE'); END;
CREATE TABLE DonorPortals (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  email_hash TEXT NOT NULL,
  key_version TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(campaign_id,email_hash)
);
CREATE TABLE OwnerAccess (
  id TEXT PRIMARY KEY,
  portal_id TEXT NOT NULL REFERENCES DonorPortals(id),
  capability_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
ALTER TABLE Claims ADD COLUMN portal_id TEXT REFERENCES DonorPortals(id);
ALTER TABLE Claims ADD COLUMN assisted_unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE Claims ADD COLUMN assisted_verifier_hash TEXT;
ALTER TABLE Claims ADD COLUMN planned_site_id TEXT REFERENCES Organisations(id);
CREATE TRIGGER operational_claim_owner_immutable BEFORE UPDATE ON Claims WHEN NEW.portal_id IS NOT OLD.portal_id OR NEW.assisted_unit_id IS NOT OLD.assisted_unit_id OR NEW.assisted_verifier_hash IS NOT OLD.assisted_verifier_hash BEGIN SELECT RAISE(ABORT,'CLAIM_OWNER_IMMUTABLE'); END;
ALTER TABLE FulfillmentOperations ADD COLUMN unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE FulfillmentOperations ADD COLUMN handler TEXT;
ALTER TABLE HandoffBatches ADD COLUMN collection_unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE WishMedia ADD COLUMN unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE WishMedia ADD COLUMN handler TEXT;
ALTER TABLE WishMedia ADD COLUMN review_unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE WishMedia ADD COLUMN review_handler TEXT;
CREATE TRIGGER operational_media_upload AFTER INSERT ON WishMedia WHEN NEW.unit_id IS NOT NULL BEGIN
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) VALUES(NEW.id||'-upload',NEW.campaign_id,NEW.unit_id,NEW.uploaded_by,NEW.handler,'media.uploaded',NEW.id);
END;
DROP TRIGGER media_review_guard;
CREATE TRIGGER media_review_guard BEFORE UPDATE ON WishMedia BEGIN
  SELECT CASE WHEN NEW.id<>OLD.id OR NEW.wish_id<>OLD.wish_id OR NEW.campaign_id<>OLD.campaign_id OR NEW.object_key<>OLD.object_key OR NEW.claim_id IS NOT OLD.claim_id OR NEW.evidence_id IS NOT OLD.evidence_id OR NEW.kind<>OLD.kind OR NEW.version<>OLD.version+1 OR NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id JOIN Wishes w ON w.id=NEW.wish_id WHERE a.user_id=NEW.reviewed_by AND a.campaign_id=NEW.campaign_id AND a.organisation_id=NEW.review_unit_id AND a.revoked_at IS NULL AND u.status='active' AND (a.kind='admin' OR (a.kind='bookhouse' AND NEW.visibility IN ('staff','donor') AND w.organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id)))) OR length(trim(COALESCE(NEW.review_handler,''))) NOT BETWEEN 2 AND 80 THEN RAISE(ABORT,'MEDIA_REVIEW_FORBIDDEN') END;
END;
CREATE TRIGGER operational_media_review AFTER UPDATE ON WishMedia BEGIN
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) VALUES(NEW.id||'-review-'||NEW.version,NEW.campaign_id,NEW.review_unit_id,NEW.reviewed_by,NEW.review_handler,'media.reviewed',NEW.id);
END;
CREATE TRIGGER operational_fulfillment_guard BEFORE INSERT ON FulfillmentOperations WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  SELECT CASE WHEN NEW.unit_id IS NULL OR length(trim(COALESCE(NEW.handler,''))) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id AND a.organisation_id=NEW.unit_id AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'UNIT_HANDLER_REQUIRED') END;
  SELECT CASE WHEN NEW.kind='receipt' AND (NOT EXISTS(SELECT 1 FROM Organisations WHERE id=json_extract(NEW.payload,'$.locationCode') AND campaign_id=NEW.campaign_id AND unit_kind='collection' AND active=1) OR (json_extract(NEW.payload,'$.locationCode')<>NEW.unit_id AND NOT EXISTS(SELECT 1 FROM OperatingAccounts WHERE user_id=NEW.actor_id AND campaign_id=NEW.campaign_id AND kind='admin'))) THEN RAISE(ABORT,'COLLECTION_SCOPE') END;
  SELECT CASE WHEN NEW.kind='batch' AND EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.items') j JOIN GiftReceipts g ON g.claim_id=json_extract(j.value,'$.claimId') WHERE g.location_code<>json_extract(NEW.payload,'$.locationCode')) THEN RAISE(ABORT,'COLLECTION_SCOPE') END;
END;
CREATE TRIGGER operational_fulfillment_audit AFTER INSERT ON FulfillmentOperations WHEN NEW.unit_id IS NOT NULL BEGIN
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) VALUES(NEW.id,NEW.campaign_id,NEW.unit_id,NEW.actor_id,NEW.handler,'gift.'||NEW.kind,json_extract(NEW.result_json,'$.resourceId'));
END;
-- Attach origin to the row creation itself; AFTER trigger ordering is undefined.
CREATE TRIGGER operational_batch_origin AFTER INSERT ON HandoffBatches WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  UPDATE HandoffBatches SET collection_unit_id=NEW.location_code WHERE id=NEW.id;
END;
ALTER TABLE CancellationRequests ADD COLUMN review_handler TEXT;
ALTER TABLE DocumentRequests ADD COLUMN cancelled_at INTEGER;
CREATE TRIGGER cancellation_review_guard BEFORE UPDATE OF status ON CancellationRequests BEGIN
  SELECT CASE WHEN OLD.status<>'pending' OR NEW.status NOT IN ('approved','rejected') OR length(trim(COALESCE(NEW.review_handler,''))) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM Claims c JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE c.id=OLD.claim_id AND c.status='claimed' AND a.user_id=NEW.reviewed_by AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'CANCELLATION_CONFLICT') END;
END;
CREATE TRIGGER cancellation_review_apply AFTER UPDATE OF status ON CancellationRequests BEGIN
  UPDATE Claims SET status='cancelled',version=version+1,actor_type='admin',actor_ref=NEW.reviewed_by,last_reason='approved_cancellation',updated_at=unixepoch() WHERE id=NEW.claim_id AND NEW.status='approved';
  UPDATE CaseFiles SET thank_status='not_required',closed_at=unixepoch(),version=version+1,updated_at=unixepoch() WHERE claim_id=NEW.claim_id AND NEW.status='approved';
  UPDATE DocumentRequests SET dispatch_status='not_enabled',cancelled_at=unixepoch() WHERE claim_id=NEW.claim_id AND NEW.status='approved';
  INSERT INTO DocumentDispatchEvents(id,claim_id,actor_id,status,reason_code) SELECT NEW.id||'-cancelled',NEW.claim_id,NEW.reviewed_by,'cancelled','claim_cancelled' WHERE NEW.status='approved';
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id)
    SELECT NEW.id,c.campaign_id,a.organisation_id,NEW.reviewed_by,NEW.review_handler,'claim.cancellation_review',c.id FROM Claims c JOIN OperatingAccounts a ON a.user_id=NEW.reviewed_by AND a.campaign_id=c.campaign_id WHERE c.id=NEW.claim_id;
END;
ALTER TABLE DonorContacts ADD COLUMN profile_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE DonorContacts ADD COLUMN owner_access_id TEXT REFERENCES OwnerAccess(id);
ALTER TABLE DonorContacts ADD COLUMN preference_patch TEXT;
ALTER TABLE DonorContacts ADD COLUMN edit_unit_id TEXT REFERENCES Organisations(id);
ALTER TABLE DonorContacts ADD COLUMN edit_handler TEXT;
ALTER TABLE DonorContacts ADD COLUMN edit_reference TEXT;
CREATE TABLE CaseFiles (
  claim_id TEXT PRIMARY KEY REFERENCES Claims(id),
  thank_status TEXT NOT NULL DEFAULT 'not_required' CHECK(thank_status IN ('not_required','preparing','ready_to_send','sent')),
  version INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO CaseFiles(claim_id) SELECT id FROM Claims;
UPDATE CaseFiles SET thank_status='preparing' WHERE EXISTS(SELECT 1 FROM DocumentRequests d WHERE d.claim_id=CaseFiles.claim_id AND d.material_proof+d.paper_thank_you+d.electronic_thank_you+d.electronic_proof>0);
UPDATE CaseFiles SET thank_status='sent' WHERE EXISTS(SELECT 1 FROM DocumentRequests d WHERE d.claim_id=CaseFiles.claim_id AND d.dispatch_status='sent');
CREATE TRIGGER case_created AFTER INSERT ON Claims BEGIN INSERT INTO CaseFiles(claim_id) VALUES(NEW.id); END;
CREATE TRIGGER case_preferences AFTER INSERT ON DocumentRequests BEGIN
  UPDATE CaseFiles SET thank_status=CASE WHEN NEW.material_proof+NEW.paper_thank_you+NEW.electronic_thank_you+NEW.electronic_proof>0 THEN 'preparing' ELSE 'not_required' END WHERE claim_id=NEW.claim_id;
END;
CREATE TRIGGER contact_unit_audit AFTER UPDATE OF ciphertext ON DonorContacts WHEN NEW.edit_unit_id IS NOT NULL AND NEW.profile_version<>OLD.profile_version BEGIN
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) VALUES(NEW.id||'-profile-'||NEW.profile_version,NEW.campaign_id,NEW.edit_unit_id,NEW.protection_actor,NEW.edit_handler,'contact.business_updated',NEW.id,NEW.edit_reference);
END;
ALTER TABLE Wishes ADD COLUMN reopen_handler TEXT;
CREATE TRIGGER operational_reopen_handler BEFORE UPDATE OF status ON Wishes WHEN NEW.status='available' AND OLD.status<>'available' AND EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  SELECT CASE WHEN length(trim(COALESCE(NEW.reopen_handler,''))) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id WHERE a.user_id=NEW.reopened_by AND a.campaign_id=NEW.campaign_id AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'REOPEN_FORBIDDEN') END;
END;
CREATE TRIGGER operational_reopen_audit AFTER UPDATE OF status ON Wishes WHEN NEW.status='available' AND OLD.status<>'available' AND EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) SELECT lower(hex(randomblob(16))),NEW.campaign_id,a.organisation_id,NEW.reopened_by,NEW.reopen_handler,'wish.reopened',NEW.id FROM OperatingAccounts a WHERE a.user_id=NEW.reopened_by AND a.campaign_id=NEW.campaign_id;
END;
CREATE TABLE CaseOperations (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES Claims(id),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  handler TEXT NOT NULL,
  expected_version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('thanks','close')),
  next_status TEXT,
  reference TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TRIGGER case_operation_guard BEFORE INSERT ON CaseOperations BEGIN
  SELECT CASE WHEN length(trim(NEW.handler)) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM CaseFiles f JOIN Claims c ON c.id=f.claim_id JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE f.claim_id=NEW.claim_id AND f.version=NEW.expected_version AND f.closed_at IS NULL AND a.user_id=NEW.actor_id AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'CASE_FORBIDDEN_OR_CONFLICT') END;
  SELECT CASE WHEN NEW.kind='close' AND NOT EXISTS(SELECT 1 FROM CaseFiles f JOIN Claims c ON c.id=f.claim_id WHERE f.claim_id=NEW.claim_id AND c.status='delivered' AND f.thank_status IN ('not_required','sent')) THEN RAISE(ABORT,'CASE_NOT_COMPLETE') END;
  SELECT CASE WHEN NEW.kind='thanks' AND NOT EXISTS(SELECT 1 FROM CaseFiles f JOIN Claims c ON c.id=f.claim_id WHERE f.claim_id=NEW.claim_id AND c.status='delivered' AND ((f.thank_status='preparing' AND NEW.next_status='ready_to_send') OR (f.thank_status='ready_to_send' AND NEW.next_status='sent' AND length(NEW.reference)>=8))) THEN RAISE(ABORT,'THANKS_TRANSITION_INVALID') END;
END;
CREATE TRIGGER case_operation_apply AFTER INSERT ON CaseOperations BEGIN
  UPDATE CaseFiles SET thank_status=CASE WHEN NEW.kind='thanks' THEN NEW.next_status ELSE thank_status END,closed_at=CASE WHEN NEW.kind='close' THEN unixepoch() ELSE NULL END,version=version+1,updated_at=unixepoch() WHERE claim_id=NEW.claim_id;
  UPDATE DocumentRequests SET dispatch_status=CASE WHEN NEW.next_status='sent' THEN 'sent' ELSE 'pending' END WHERE claim_id=NEW.claim_id AND NEW.kind='thanks';
  INSERT INTO DocumentDispatchEvents(id,claim_id,actor_id,status,reason_code) SELECT NEW.id,NEW.claim_id,NEW.actor_id,CASE WHEN NEW.next_status='sent' THEN 'sent' ELSE 'pending' END,'manual_record' WHERE NEW.kind='thanks';
  INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) SELECT NEW.id,c.campaign_id,a.organisation_id,NEW.actor_id,NEW.handler,'case.'||NEW.kind,c.id,NEW.reference FROM Claims c JOIN OperatingAccounts a ON a.user_id=NEW.actor_id AND a.campaign_id=c.campaign_id WHERE c.id=NEW.claim_id;
END;
CREATE TRIGGER case_operations_no_update BEFORE UPDATE ON CaseOperations BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER case_operations_no_delete BEFORE DELETE ON CaseOperations BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER contact_protection_guard;
CREATE TRIGGER contact_protection_guard BEFORE UPDATE OF ciphertext,key_version,erased_at ON DonorContacts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM AdminUsers u JOIN UserRoles r ON r.user_id=u.id WHERE u.id=NEW.protection_actor AND u.status='active' AND r.campaign_id=OLD.campaign_id AND r.role_id='nx_admin') AND NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id WHERE a.user_id=NEW.protection_actor AND a.campaign_id=OLD.campaign_id AND a.kind='bookhouse' AND a.revoked_at IS NULL AND u.status='active' AND NEW.erased_at IS NULL) AND NOT EXISTS(SELECT 1 FROM OwnerAccess s JOIN Claims c ON c.portal_id=s.portal_id WHERE s.id=NEW.owner_access_id AND s.revoked_at IS NULL AND s.expires_at>unixepoch() AND c.donor_contact_id=OLD.id AND NEW.protection_actor IS NULL AND NEW.erased_at IS NULL) THEN RAISE(ABORT,'CONTACT_PROTECTION_FORBIDDEN') END;
  SELECT CASE WHEN NEW.erased_at IS NOT NULL AND (OLD.retention_until>unixepoch() OR OLD.legal_hold=1 OR NEW.ciphertext<>'ERASED' OR NEW.key_version<>'erased' OR EXISTS(SELECT 1 FROM Claims WHERE donor_contact_id=OLD.id AND status NOT IN ('cancelled','expired','delivered'))) THEN RAISE(ABORT,'ERASURE_NOT_ALLOWED') END;
END;
DROP TRIGGER contact_protection_audit;
CREATE TRIGGER contact_protection_audit AFTER UPDATE OF ciphertext,key_version,erased_at ON DonorContacts BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(NEW.campaign_id,'contact',NEW.id,'contact.profile_updated',CASE WHEN NEW.protection_actor IS NULL THEN 'donor' ELSE 'admin' END,COALESCE(NEW.protection_actor,NEW.owner_access_id),COALESCE(NEW.protection_reason,'owner_profile'));
  UPDATE DocumentRequests SET material_proof=json_extract(NEW.preference_patch,'$.materialProof'),paper_thank_you=json_extract(NEW.preference_patch,'$.paperThankYou'),electronic_thank_you=json_extract(NEW.preference_patch,'$.electronicThankYou'),electronic_proof=json_extract(NEW.preference_patch,'$.electronicProof') WHERE claim_id IN (SELECT id FROM Claims WHERE donor_contact_id=NEW.id) AND NEW.preference_patch IS NOT NULL;
  UPDATE CaseFiles SET thank_status=CASE WHEN json_extract(NEW.preference_patch,'$.materialProof')+json_extract(NEW.preference_patch,'$.paperThankYou')+json_extract(NEW.preference_patch,'$.electronicThankYou')+json_extract(NEW.preference_patch,'$.electronicProof')>0 THEN 'preparing' ELSE 'not_required' END,version=version+1 WHERE claim_id IN (SELECT id FROM Claims WHERE donor_contact_id=NEW.id) AND closed_at IS NULL AND thank_status<>'sent' AND NEW.preference_patch IS NOT NULL;
END;
