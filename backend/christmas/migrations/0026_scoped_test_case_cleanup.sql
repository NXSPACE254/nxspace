-- One authorized test case, one transaction. Audit tables are never deleted.
CREATE TABLE TestCaseCleanups (
  wish_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  public_code TEXT NOT NULL CHECK(public_code='NX-001'),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  wish_version INTEGER NOT NULL,
  claim_version INTEGER NOT NULL,
  claim_id TEXT,
  contact_id TEXT,
  portal_id TEXT,
  batch_id TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TRIGGER test_case_cleanup_no_delete BEFORE DELETE ON TestCaseCleanups
BEGIN SELECT RAISE(ABORT,'TEST_CLEANUP_AUDIT_REQUIRED'); END;
CREATE TRIGGER retired_test_wish_id_guard BEFORE INSERT ON Wishes
WHEN EXISTS(SELECT 1 FROM TestCaseCleanups WHERE wish_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'TEST_WISH_ID_RETIRED'); END;
CREATE TRIGGER test_case_cleanup_update_guard BEFORE UPDATE ON TestCaseCleanups
WHEN NOT (OLD.completed=0 AND NEW.completed=1 AND NEW.wish_id=OLD.wish_id
  AND NEW.campaign_id=OLD.campaign_id AND NEW.public_code=OLD.public_code
  AND NEW.actor_id=OLD.actor_id AND NEW.wish_version=OLD.wish_version
  AND NEW.claim_version=OLD.claim_version AND NEW.created_at=OLD.created_at
  AND NEW.claim_id IS NULL AND NEW.contact_id IS NULL AND NEW.portal_id IS NULL AND NEW.batch_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM Wishes WHERE id=OLD.wish_id))
BEGIN SELECT RAISE(ABORT,'TEST_CLEANUP_AUDIT_REQUIRED'); END;

CREATE TRIGGER test_case_cleanup_validate BEFORE INSERT ON TestCaseCleanups BEGIN
  SELECT CASE WHEN NEW.completed<>0 OR NOT EXISTS(
    SELECT 1 FROM Wishes w JOIN Claims c ON c.wish_id=w.id AND c.campaign_id=w.campaign_id
    JOIN DonorContacts p ON p.id=c.donor_contact_id AND p.campaign_id=c.campaign_id
    JOIN HandoffBatchItems h ON h.claim_id=c.id AND h.campaign_id=c.campaign_id
    JOIN StaffIdentities s ON s.id=NEW.actor_id AND s.is_super=1
    JOIN OperatingAccounts a ON a.user_id=s.id AND a.campaign_id=w.campaign_id AND a.kind='admin' AND a.revoked_at IS NULL
    JOIN AdminUsers u ON u.id=s.id AND u.status='active'
    WHERE w.id=NEW.wish_id AND w.campaign_id=NEW.campaign_id AND w.public_code=NEW.public_code
      AND w.version=NEW.wish_version AND c.version=NEW.claim_version AND w.publication_status='draft'
      AND (w.is_demo=1 OR (w.campaign_id='christmas-2026' AND w.id='50fdaa53-8105-4da1-bdc1-7e7a2a66d8b7'))
      AND w.status='delivered' AND c.status='delivered' AND c.id=NEW.claim_id
      AND p.id=NEW.contact_id AND p.legal_hold=0 AND c.portal_id=NEW.portal_id AND h.batch_id=NEW.batch_id
  ) THEN RAISE(ABORT,'TEST_CLEANUP_CONFLICT') END;
  SELECT CASE WHEN (SELECT count(*) FROM Claims WHERE wish_id=NEW.wish_id)<>1
    OR EXISTS(SELECT 1 FROM WishPrivateProfiles WHERE wish_id=NEW.wish_id AND legal_hold<>0)
    OR EXISTS(SELECT 1 FROM Claims WHERE id<>NEW.claim_id AND (donor_contact_id=NEW.contact_id OR portal_id=NEW.portal_id))
    OR EXISTS(SELECT 1 FROM DonorContacts p JOIN OwnerAccess a ON a.id=p.owner_access_id
       WHERE a.portal_id=NEW.portal_id AND p.id<>NEW.contact_id)
    OR EXISTS(SELECT 1 FROM HandoffBatchItems WHERE batch_id=NEW.batch_id AND claim_id<>NEW.claim_id)
    OR EXISTS(SELECT 1 FROM HandoffItems WHERE handoff_id=NEW.batch_id AND claim_id<>NEW.claim_id)
    OR EXISTS(SELECT 1 FROM Attachments WHERE claim_id=NEW.claim_id AND (manual_record IS NULL OR object_key<>'manual-record:'||id))
    OR EXISTS(SELECT 1 FROM WishMedia WHERE wish_id=NEW.wish_id OR claim_id=NEW.claim_id)
    OR EXISTS(SELECT 1 FROM WishMedia m JOIN Attachments a ON m.evidence_id=a.id OR m.object_key=a.object_key WHERE a.claim_id=NEW.claim_id)
    THEN RAISE(ABORT,'TEST_CLEANUP_SHARED_OR_HELD') END;
END;

DROP TRIGGER paper_event_no_delete;
CREATE TRIGGER paper_event_no_delete BEFORE DELETE ON PaperDocumentEvents
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER case_operations_no_delete;
CREATE TRIGGER case_operations_no_delete BEFORE DELETE ON CaseOperations
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER support_no_delete;
CREATE TRIGGER support_no_delete BEFORE DELETE ON CaseSupportEvents
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.wish_id=t.wish_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER mailing_correction_no_delete;
CREATE TRIGGER mailing_correction_no_delete BEFORE DELETE ON MailingCorrections
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER case_document_erasure_no_delete;
CREATE TRIGGER case_document_erasure_no_delete BEFORE DELETE ON CaseDocumentErasures
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'RETENTION_HISTORY_REQUIRED'); END;
DROP TRIGGER unclaimed_retention_no_delete;
CREATE TRIGGER unclaimed_retention_no_delete BEFORE DELETE ON UnclaimedWishClosures
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.wish_id=t.wish_id))
BEGIN SELECT RAISE(ABORT,'RETENTION_HISTORY_REQUIRED'); END;
DROP TRIGGER dispatch_events_no_delete;
CREATE TRIGGER dispatch_events_no_delete BEFORE DELETE ON DocumentDispatchEvents
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER acceptance_no_delete;
CREATE TRIGGER acceptance_no_delete BEFORE DELETE ON ClaimPrivacyAcceptances
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER snapshot_no_delete;
CREATE TRIGGER snapshot_no_delete BEFORE DELETE ON ClaimPublicSnapshots
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER rotation_no_delete;
CREATE TRIGGER rotation_no_delete BEFORE DELETE ON CapabilityRotations
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'ROTATION_APPEND_ONLY'); END;
DROP TRIGGER claim_release_no_delete;
CREATE TRIGGER claim_release_no_delete BEFORE DELETE ON ClaimReleases
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER deadline_extension_no_delete;
CREATE TRIGGER deadline_extension_no_delete BEFORE DELETE ON ClaimDeadlineExtensions
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER receipt_correction_no_delete;
CREATE TRIGGER receipt_correction_no_delete BEFORE DELETE ON ReceiptLocationCorrections
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER delivery_no_delete;
CREATE TRIGGER delivery_no_delete BEFORE DELETE ON DeliveryConfirmations
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'DELIVERY_APPEND_ONLY'); END;
DROP TRIGGER handoff_items_no_delete;
CREATE TRIGGER handoff_items_no_delete BEFORE DELETE ON HandoffItems
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'HANDOFF_ITEMS_APPEND_ONLY'); END;
DROP TRIGGER handoff_no_delete;
CREATE TRIGGER handoff_no_delete BEFORE DELETE ON Handoffs
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.id=t.batch_id))
BEGIN SELECT RAISE(ABORT,'HANDOFF_APPEND_ONLY'); END;
DROP TRIGGER batch_items_no_delete;
CREATE TRIGGER batch_items_no_delete BEFORE DELETE ON HandoffBatchItems
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'BATCH_ITEMS_APPEND_ONLY'); END;
DROP TRIGGER batch_no_delete;
CREATE TRIGGER batch_no_delete BEFORE DELETE ON HandoffBatches
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.id=t.batch_id))
BEGIN SELECT RAISE(ABORT,'BATCH_HISTORY_REQUIRED'); END;
DROP TRIGGER receipt_no_delete;
CREATE TRIGGER receipt_no_delete BEFORE DELETE ON GiftReceipts
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'RECEIPT_APPEND_ONLY'); END;
DROP TRIGGER manual_evidence_no_delete;
CREATE TRIGGER manual_evidence_no_delete BEFORE DELETE ON Attachments
WHEN OLD.manual_record IS NOT NULL AND NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.claim_id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'MANUAL_EVIDENCE_APPEND_ONLY'); END;
DROP TRIGGER fulfillment_no_delete;
CREATE TRIGGER fulfillment_no_delete BEFORE DELETE ON FulfillmentOperations
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND OLD.campaign_id=t.campaign_id AND json_extract(OLD.result_json,'$.resourceId') IN (t.claim_id,t.batch_id))
BEGIN SELECT RAISE(ABORT,'OPERATIONS_APPEND_ONLY'); END;
DROP TRIGGER proposal_reviews_no_delete;
CREATE TRIGGER proposal_reviews_no_delete BEFORE DELETE ON ProposalReviews
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND OLD.proposal_id IN (SELECT id FROM PublicWishProposals WHERE wish_id=t.wish_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER wish_change_no_delete;
CREATE TRIGGER wish_change_no_delete BEFORE DELETE ON WishChanges
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.wish_id=t.wish_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER claim_no_delete;
CREATE TRIGGER claim_no_delete BEFORE DELETE ON Claims
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.id=t.claim_id))
BEGIN SELECT RAISE(ABORT,'CLAIM_HISTORY_REQUIRED'); END;
DROP TRIGGER pin_reset_no_delete;
CREATE TRIGGER pin_reset_no_delete BEFORE DELETE ON PinResetEvents
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.portal_id=t.portal_id))
BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
DROP TRIGGER donor_auth_no_delete;
CREATE TRIGGER donor_auth_no_delete BEFORE DELETE ON DonorAuthEvents
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.portal_id=t.portal_id))
BEGIN SELECT RAISE(ABORT,'AUTH_APPEND_ONLY'); END;
DROP TRIGGER wish_no_delete;
CREATE TRIGGER wish_no_delete BEFORE DELETE ON Wishes
WHEN NOT EXISTS (SELECT 1 FROM TestCaseCleanups t WHERE t.completed=0 AND (OLD.id=t.wish_id))
BEGIN SELECT RAISE(ABORT,'WISH_HISTORY_REQUIRED'); END;

CREATE TRIGGER test_case_cleanup_apply AFTER INSERT ON TestCaseCleanups BEGIN
  DELETE FROM WishMedia WHERE wish_id=NEW.wish_id OR claim_id=NEW.claim_id;
  DELETE FROM PaperDocumentEvents WHERE claim_id=NEW.claim_id;
  DELETE FROM CaseOperations WHERE claim_id=NEW.claim_id;
  DELETE FROM CaseSupportEvents WHERE wish_id=NEW.wish_id;
  DELETE FROM MailingCorrections WHERE claim_id=NEW.claim_id;
  DELETE FROM CaseDocumentErasures WHERE claim_id=NEW.claim_id;
  DELETE FROM UnclaimedWishClosures WHERE wish_id=NEW.wish_id;
  DELETE FROM DocumentDispatchEvents WHERE claim_id=NEW.claim_id;
  DELETE FROM DocumentRequests WHERE claim_id=NEW.claim_id;
  DELETE FROM CaseFiles WHERE claim_id=NEW.claim_id;
  DELETE FROM ClaimPublicMessages WHERE claim_id=NEW.claim_id;
  DELETE FROM ClaimPrivacyAcceptances WHERE claim_id=NEW.claim_id;
  DELETE FROM ClaimPublicSnapshots WHERE claim_id=NEW.claim_id;
  DELETE FROM CancellationRequests WHERE claim_id=NEW.claim_id;
  DELETE FROM CapabilityRotations WHERE claim_id=NEW.claim_id;
  DELETE FROM ClaimReleases WHERE claim_id=NEW.claim_id;
  DELETE FROM ClaimDeadlineExtensions WHERE claim_id=NEW.claim_id;
  DELETE FROM ReceiptLocationCorrections WHERE claim_id=NEW.claim_id;
  DELETE FROM DeliveryConfirmations WHERE claim_id=NEW.claim_id;
  DELETE FROM HandoffItems WHERE claim_id=NEW.claim_id;
  DELETE FROM Handoffs WHERE id=NEW.batch_id;
  DELETE FROM HandoffBatchItems WHERE claim_id=NEW.claim_id;
  DELETE FROM HandoffBatches WHERE id=NEW.batch_id;
  DELETE FROM GiftReceipts WHERE claim_id=NEW.claim_id;
  DELETE FROM Attachments WHERE claim_id=NEW.claim_id;
  DELETE FROM FulfillmentOperations WHERE campaign_id=NEW.campaign_id AND json_extract(result_json,'$.resourceId') IN (NEW.claim_id,NEW.batch_id);
  DELETE FROM ProposalReviews WHERE proposal_id IN (SELECT id FROM PublicWishProposals WHERE wish_id=NEW.wish_id);
  DELETE FROM PublicWishProposals WHERE wish_id=NEW.wish_id;
  DELETE FROM WishChanges WHERE wish_id=NEW.wish_id;
  DELETE FROM WishPrivateProfiles WHERE wish_id=NEW.wish_id;
  DELETE FROM WishNameAccess WHERE wish_id=NEW.wish_id;
  DELETE FROM Claims WHERE id=NEW.claim_id;
  DELETE FROM DonorContacts WHERE id=NEW.contact_id;
  DELETE FROM OwnerRecoveryLinks WHERE portal_id=NEW.portal_id;
  DELETE FROM OwnerAccess WHERE portal_id=NEW.portal_id;
  DELETE FROM PinResetEvents WHERE portal_id=NEW.portal_id;
  DELETE FROM DonorAuthEvents WHERE portal_id=NEW.portal_id;
  DELETE FROM DonorPins WHERE portal_id=NEW.portal_id;
  DELETE FROM DonorPasswords WHERE portal_id=NEW.portal_id;
  DELETE FROM DonorPortals WHERE id=NEW.portal_id;
  DELETE FROM Wishes WHERE id=NEW.wish_id;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'wish',NEW.wish_id,'test_case.archived','admin',NEW.actor_id,NEW.public_code);
  INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result,details)
    SELECT 'test-cleanup:'||NEW.wish_id,NEW.campaign_id,NEW.actor_id,'NXSPACE',a.organisation_id,
      'test_case.archived',NEW.wish_id,'success',json_object('oldPublicCode',NEW.public_code)
    FROM OperatingAccounts a WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id;
  UPDATE TestCaseCleanups SET completed=1,claim_id=NULL,contact_id=NULL,portal_id=NULL,batch_id=NULL WHERE wish_id=NEW.wish_id;
END;

