-- Additive operating policy; original Claims, receipts and state machine remain.
ALTER TABLE CampaignOperatingRules ADD COLUMN delivery_days INTEGER NOT NULL DEFAULT 5 CHECK(delivery_days BETWEEN 1 AND 90);
UPDATE Organisations SET label='NX SPACE' WHERE unit_kind='admin';
UPDATE Campaigns SET partner_label=replace(partner_label,'馜享空間','NX SPACE');
-- Enforce the same Taipei calendar policy inside the atomic claim INSERT.
-- Campaigns without operating rules retain the original fixed-date contract.
DROP TRIGGER claim_insert_guard;
CREATE TRIGGER claim_insert_guard BEFORE INSERT ON Claims BEGIN
 SELECT CASE WHEN NEW.status<>'claimed' THEN RAISE(ABORT,'INITIAL_STATUS_INVALID') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Wishes w JOIN Campaigns c ON c.id=w.campaign_id WHERE w.id=NEW.wish_id AND w.campaign_id=NEW.campaign_id AND w.status='available' AND w.publication_status='approved' AND c.status='open' AND c.collaboration_confirmed=1 AND c.opens_at<=unixepoch() AND c.closes_at>unixepoch() AND NEW.claimed_at=unixepoch() AND NEW.expires_at<=c.claim_deadline_at AND NEW.gift_due_at=CASE WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules r WHERE r.campaign_id=c.id) THEN min((CAST((NEW.claimed_at+28800)/86400 AS INTEGER)+(SELECT delivery_days FROM CampaignOperatingRules r WHERE r.campaign_id=c.id)+1)*86400-28801,c.gift_due_at) ELSE c.gift_due_at END) THEN RAISE(ABORT,'WISH_NOT_AVAILABLE') END;
END;
CREATE TABLE OwnerRecoveryLinks (
 token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
 portal_id TEXT NOT NULL REFERENCES DonorPortals(id),
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
CREATE TABLE ClaimReleases (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
 claim_id TEXT NOT NULL REFERENCES Claims(id),
 expected_version INTEGER NOT NULL,
 wish_version INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
 reason TEXT NOT NULL CHECK(reason IN ('donor_cancel','overdue_confirmed')),
 request_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TRIGGER claim_release_guard BEFORE INSERT ON ClaimReleases BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE c.id=NEW.claim_id AND c.campaign_id=NEW.campaign_id AND c.status='claimed' AND c.version=NEW.expected_version AND w.version=NEW.wish_version AND a.user_id=NEW.actor_id AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active' AND (a.kind='admin' OR w.organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=c.campaign_id)) AND (NEW.reason='donor_cancel' OR c.gift_due_at<unixepoch()) AND NOT EXISTS(SELECT 1 FROM GiftReceipts WHERE claim_id=c.id) AND NOT EXISTS(SELECT 1 FROM HandoffBatchItems WHERE claim_id=c.id)) THEN RAISE(ABORT,'RELEASE_FORBIDDEN_OR_CONFLICT') END;
END;
CREATE TRIGGER claim_release_apply AFTER INSERT ON ClaimReleases BEGIN
 INSERT INTO CancellationRequests(id,claim_id,reason_code) SELECT NEW.id,NEW.claim_id,NEW.reason WHERE NOT EXISTS(SELECT 1 FROM CancellationRequests WHERE claim_id=NEW.claim_id AND status='pending');
 UPDATE CancellationRequests SET status='approved',reviewed_by=NEW.actor_id,review_handler=(SELECT o.label FROM OperatingAccounts a JOIN Organisations o ON o.id=a.organisation_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id),reviewed_at=unixepoch() WHERE id=(SELECT id FROM CancellationRequests WHERE claim_id=NEW.claim_id AND status='pending' ORDER BY created_at,id LIMIT 1);
 UPDATE Wishes SET status='available',version=version+1,reopened_by=NEW.actor_id,reopen_reason='reviewed_reopen',reopen_handler=(SELECT o.label FROM OperatingAccounts a JOIN Organisations o ON o.id=a.organisation_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id),updated_at=unixepoch() WHERE id=(SELECT wish_id FROM Claims WHERE id=NEW.claim_id);
 INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) SELECT NEW.id||'-release',NEW.campaign_id,a.organisation_id,NEW.actor_id,o.label,'claim.cancelled_and_reopened',NEW.claim_id,NEW.reason FROM OperatingAccounts a JOIN Organisations o ON o.id=a.organisation_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id;
END;
CREATE TRIGGER claim_release_no_update BEFORE UPDATE ON ClaimReleases BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER claim_release_no_delete BEFORE DELETE ON ClaimReleases BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE ReceiptLocationCorrections (
 id TEXT PRIMARY KEY,
 claim_id TEXT NOT NULL REFERENCES Claims(id),
 old_location TEXT NOT NULL,
 new_location TEXT NOT NULL REFERENCES Organisations(id),
 actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
 note TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE VIEW ReceiptLocations AS SELECT g.*,COALESCE((SELECT x.new_location FROM ReceiptLocationCorrections x WHERE x.claim_id=g.claim_id ORDER BY x.rowid DESC LIMIT 1),g.location_code) AS effective_location FROM GiftReceipts g;
CREATE TRIGGER receipt_correction_guard BEFORE INSERT ON ReceiptLocationCorrections BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN ReceiptLocations g ON g.claim_id=c.id JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id JOIN Organisations s ON s.id=NEW.new_location WHERE c.id=NEW.claim_id AND c.status='gift_received' AND g.effective_location=NEW.old_location AND a.user_id=NEW.actor_id AND a.kind='admin' AND a.revoked_at IS NULL AND u.status='active' AND s.campaign_id=c.campaign_id AND s.unit_kind='collection' AND s.active=1 AND NOT EXISTS(SELECT 1 FROM HandoffBatchItems WHERE claim_id=c.id)) THEN RAISE(ABORT,'CORRECTION_FORBIDDEN_OR_CONFLICT') END;
END;
CREATE TRIGGER receipt_correction_audit AFTER INSERT ON ReceiptLocationCorrections BEGIN
 INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) SELECT NEW.id,c.campaign_id,a.organisation_id,NEW.actor_id,o.label,'receipt.location_corrected',c.id,NEW.old_location||'>'||NEW.new_location FROM Claims c JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN Organisations o ON o.id=a.organisation_id WHERE c.id=NEW.claim_id AND a.user_id=NEW.actor_id;
END;
CREATE TRIGGER receipt_correction_no_update BEFORE UPDATE ON ReceiptLocationCorrections BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER receipt_correction_no_delete BEFORE DELETE ON ReceiptLocationCorrections BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER operational_fulfillment_guard;
CREATE TRIGGER operational_fulfillment_guard BEFORE INSERT ON FulfillmentOperations WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id) BEGIN
 SELECT CASE WHEN NEW.unit_id IS NULL OR length(trim(COALESCE(NEW.handler,''))) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id AND a.organisation_id=NEW.unit_id AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'UNIT_HANDLER_REQUIRED') END;
 SELECT CASE WHEN NEW.kind='receipt' AND (NOT EXISTS(SELECT 1 FROM Organisations WHERE id=json_extract(NEW.payload,'$.locationCode') AND campaign_id=NEW.campaign_id AND unit_kind='collection' AND active=1) OR (json_extract(NEW.payload,'$.locationCode')<>NEW.unit_id AND NOT EXISTS(SELECT 1 FROM OperatingAccounts WHERE user_id=NEW.actor_id AND campaign_id=NEW.campaign_id AND kind='admin'))) THEN RAISE(ABORT,'COLLECTION_SCOPE') END;
 SELECT CASE WHEN NEW.kind='batch' AND EXISTS(SELECT 1 FROM json_each(NEW.payload,'$.items') j JOIN ReceiptLocations g ON g.claim_id=json_extract(j.value,'$.claimId') WHERE g.effective_location<>json_extract(NEW.payload,'$.locationCode')) THEN RAISE(ABORT,'COLLECTION_SCOPE') END;
END;
ALTER TABLE CaseFiles ADD COLUMN proof_status TEXT NOT NULL DEFAULT 'not_required' CHECK(proof_status IN ('not_required','preparing','ready_to_send','sent'));
ALTER TABLE CaseOperations ADD COLUMN document_type TEXT NOT NULL DEFAULT 'thanks' CHECK(document_type IN ('thanks','proof'));
UPDATE CaseFiles SET proof_status=CASE WHEN EXISTS(SELECT 1 FROM DocumentRequests d WHERE d.claim_id=CaseFiles.claim_id AND d.material_proof+d.electronic_proof>0) THEN CASE WHEN thank_status='sent' THEN 'sent' ELSE 'preparing' END ELSE 'not_required' END;
UPDATE CaseFiles SET thank_status='not_required' WHERE NOT EXISTS(SELECT 1 FROM DocumentRequests d WHERE d.claim_id=CaseFiles.claim_id AND d.paper_thank_you+d.electronic_thank_you>0);
UPDATE CaseFiles SET proof_status='not_required' WHERE claim_id IN (SELECT id FROM Claims WHERE status='cancelled');
DROP TRIGGER case_preferences;
CREATE TRIGGER case_preferences AFTER INSERT ON DocumentRequests BEGIN
 UPDATE CaseFiles SET thank_status=CASE WHEN NEW.paper_thank_you+NEW.electronic_thank_you>0 THEN 'preparing' ELSE 'not_required' END,proof_status=CASE WHEN NEW.material_proof+NEW.electronic_proof>0 THEN 'preparing' ELSE 'not_required' END WHERE claim_id=NEW.claim_id;
END;
DROP TRIGGER contact_protection_audit;
CREATE TRIGGER contact_protection_audit AFTER UPDATE OF ciphertext,key_version,erased_at ON DonorContacts BEGIN
 INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(NEW.campaign_id,'contact',NEW.id,'contact.profile_updated',CASE WHEN NEW.protection_actor IS NULL THEN 'donor' ELSE 'admin' END,COALESCE(NEW.protection_actor,NEW.owner_access_id),COALESCE(NEW.protection_reason,'owner_profile'));
 UPDATE DocumentRequests SET material_proof=json_extract(NEW.preference_patch,'$.materialProof'),paper_thank_you=json_extract(NEW.preference_patch,'$.paperThankYou'),electronic_thank_you=json_extract(NEW.preference_patch,'$.electronicThankYou'),electronic_proof=json_extract(NEW.preference_patch,'$.electronicProof') WHERE claim_id IN (SELECT id FROM Claims WHERE donor_contact_id=NEW.id) AND NEW.preference_patch IS NOT NULL;
 UPDATE CaseFiles SET thank_status=CASE WHEN json_extract(NEW.preference_patch,'$.paperThankYou')+json_extract(NEW.preference_patch,'$.electronicThankYou')>0 THEN CASE WHEN thank_status='sent' THEN 'sent' ELSE 'preparing' END ELSE 'not_required' END,proof_status=CASE WHEN json_extract(NEW.preference_patch,'$.materialProof')+json_extract(NEW.preference_patch,'$.electronicProof')>0 THEN CASE WHEN proof_status='sent' THEN 'sent' ELSE 'preparing' END ELSE 'not_required' END,version=version+1 WHERE claim_id IN (SELECT id FROM Claims WHERE donor_contact_id=NEW.id) AND closed_at IS NULL AND NEW.preference_patch IS NOT NULL;
END;
CREATE TRIGGER cancelled_proof AFTER UPDATE OF status ON Claims WHEN NEW.status='cancelled' BEGIN UPDATE CaseFiles SET proof_status='not_required' WHERE claim_id=NEW.id; END;
DROP TRIGGER case_operation_guard;
CREATE TRIGGER case_operation_guard BEFORE INSERT ON CaseOperations BEGIN
 SELECT CASE WHEN length(trim(NEW.handler)) NOT BETWEEN 2 AND 80 OR NOT EXISTS(SELECT 1 FROM CaseFiles f JOIN Claims c ON c.id=f.claim_id JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE f.claim_id=NEW.claim_id AND f.version=NEW.expected_version AND f.closed_at IS NULL AND a.user_id=NEW.actor_id AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'CASE_FORBIDDEN_OR_CONFLICT') END;
 SELECT CASE WHEN NEW.kind='close' AND NOT EXISTS(SELECT 1 FROM CaseFiles f JOIN Claims c ON c.id=f.claim_id WHERE f.claim_id=NEW.claim_id AND c.status='delivered' AND f.thank_status IN ('not_required','sent') AND f.proof_status IN ('not_required','sent')) THEN RAISE(ABORT,'CASE_NOT_COMPLETE') END;
 SELECT CASE WHEN NEW.kind='thanks' AND NOT EXISTS(SELECT 1 FROM CaseFiles f JOIN Claims c ON c.id=f.claim_id WHERE f.claim_id=NEW.claim_id AND c.status='delivered' AND ((CASE NEW.document_type WHEN 'proof' THEN f.proof_status ELSE f.thank_status END='preparing' AND NEW.next_status='ready_to_send') OR (CASE NEW.document_type WHEN 'proof' THEN f.proof_status ELSE f.thank_status END='ready_to_send' AND NEW.next_status='sent' AND length(NEW.reference)>=8))) THEN RAISE(ABORT,'DOCUMENT_TRANSITION_INVALID') END;
END;
DROP TRIGGER case_operation_apply;
CREATE TRIGGER case_operation_apply AFTER INSERT ON CaseOperations BEGIN
 UPDATE CaseFiles SET thank_status=CASE WHEN NEW.kind='thanks' AND NEW.document_type='thanks' THEN NEW.next_status ELSE thank_status END,proof_status=CASE WHEN NEW.kind='thanks' AND NEW.document_type='proof' THEN NEW.next_status ELSE proof_status END,closed_at=CASE WHEN NEW.kind='close' THEN unixepoch() ELSE NULL END,version=version+1,updated_at=unixepoch() WHERE claim_id=NEW.claim_id;
 UPDATE DocumentRequests SET dispatch_status=CASE WHEN EXISTS(SELECT 1 FROM CaseFiles f WHERE f.claim_id=NEW.claim_id AND f.thank_status IN ('not_required','sent') AND f.proof_status IN ('not_required','sent')) THEN 'sent' ELSE 'pending' END WHERE claim_id=NEW.claim_id AND NEW.kind='thanks';
 INSERT INTO DocumentDispatchEvents(id,claim_id,actor_id,status,reason_code) SELECT NEW.id,NEW.claim_id,NEW.actor_id,CASE WHEN NEW.next_status='sent' THEN 'sent' ELSE 'pending' END,NEW.document_type WHERE NEW.kind='thanks';
 INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) SELECT NEW.id,c.campaign_id,a.organisation_id,NEW.actor_id,NEW.handler,'case.'||NEW.kind||'.'||NEW.document_type,c.id,NEW.reference FROM Claims c JOIN OperatingAccounts a ON a.user_id=NEW.actor_id AND a.campaign_id=c.campaign_id WHERE c.id=NEW.claim_id;
END;
