-- Terminal claim or closed delivery is the retention clock. A released claim
-- must never close the child profile of a wish that can be claimed again.
CREATE VIEW CaseRetentionDeadlines AS
SELECT c.id AS claim_id,c.campaign_id,c.wish_id,c.donor_contact_id,
  CASE
    WHEN c.status IN ('cancelled','expired') THEN (
      SELECT min(a.occurred_at) FROM AuditLogs a
      WHERE a.campaign_id=c.campaign_id AND a.resource_type='claim'
        AND a.resource_id=c.id AND a.action='claim.transition' AND a.to_status=c.status
    )
    WHEN c.status='delivered' THEN f.closed_at
  END AS ended_at
FROM Claims c LEFT JOIN CaseFiles f ON f.claim_id=c.id;

CREATE TABLE UnclaimedWishClosures (
  wish_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  ended_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(wish_id,campaign_id) REFERENCES Wishes(id,campaign_id)
);

CREATE TRIGGER unclaimed_retention_close AFTER INSERT ON UnclaimedWishClosures
BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM Claims WHERE wish_id=NEW.wish_id)
    THEN RAISE(ABORT,'CLAIM_EXISTS') END;
  UPDATE Wishes SET publication_status='draft',version=version+1,updated_at=unixepoch()
    WHERE id=NEW.wish_id AND campaign_id=NEW.campaign_id;
  UPDATE WishPrivateProfiles SET retention_until=NEW.ended_at+7776000
    WHERE wish_id=NEW.wish_id AND campaign_id=NEW.campaign_id AND erased_at IS NULL;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'wish',NEW.wish_id,'wish.retention_closed','admin',NEW.actor_id,'unclaimed_case_ended');
END;

CREATE TRIGGER unclaimed_retention_no_claim BEFORE INSERT ON Claims
WHEN EXISTS(SELECT 1 FROM UnclaimedWishClosures WHERE wish_id=NEW.wish_id)
BEGIN
  SELECT RAISE(ABORT,'WISH_CLOSED');
END;

CREATE TRIGGER unclaimed_retention_no_publish BEFORE UPDATE OF publication_status ON Wishes
WHEN NEW.publication_status='approved' AND EXISTS(SELECT 1 FROM UnclaimedWishClosures WHERE wish_id=NEW.id)
BEGIN
  SELECT RAISE(ABORT,'WISH_CLOSED');
END;

CREATE TRIGGER unclaimed_retention_no_update BEFORE UPDATE ON UnclaimedWishClosures
BEGIN
  SELECT RAISE(ABORT,'RETENTION_HISTORY_REQUIRED');
END;

CREATE TRIGGER unclaimed_retention_no_delete BEFORE DELETE ON UnclaimedWishClosures
BEGIN
  SELECT RAISE(ABORT,'RETENTION_HISTORY_REQUIRED');
END;

CREATE TABLE CaseDocumentErasures (
  claim_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  erased_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id)
);

CREATE TRIGGER case_document_erasure_no_update BEFORE UPDATE ON CaseDocumentErasures
BEGIN
  SELECT RAISE(ABORT,'RETENTION_HISTORY_REQUIRED');
END;

CREATE TRIGGER case_document_erasure_no_delete BEFORE DELETE ON CaseDocumentErasures
BEGIN
  SELECT RAISE(ABORT,'RETENTION_HISTORY_REQUIRED');
END;

DROP TRIGGER paper_event_no_update;
CREATE TRIGGER paper_event_no_update BEFORE UPDATE ON PaperDocumentEvents
WHEN NOT (
  NEW.id=OLD.id AND NEW.claim_id=OLD.claim_id AND NEW.document_type=OLD.document_type
  AND OLD.key_version<>'erased' AND NEW.key_version='erased' AND NEW.ciphertext='ERASED'
  AND EXISTS(SELECT 1 FROM CaseDocumentErasures WHERE claim_id=OLD.claim_id)
)
BEGIN
  SELECT RAISE(ABORT,'APPEND_ONLY');
END;

DROP TRIGGER manual_evidence_no_update;
CREATE TRIGGER manual_evidence_no_update BEFORE UPDATE ON Attachments
WHEN OLD.manual_record IS NOT NULL AND NOT (
  NEW.id=OLD.id AND NEW.campaign_id=OLD.campaign_id AND NEW.claim_id=OLD.claim_id
  AND NEW.object_key=OLD.object_key AND NEW.content_type=OLD.content_type AND NEW.verified_at=OLD.verified_at
  AND (
    (NEW.manual_record=OLD.manual_record AND NEW.sha256=OLD.sha256 AND NEW.byte_size=OLD.byte_size
      AND EXISTS(SELECT 1 FROM CaseRetentionDeadlines d
        WHERE d.claim_id=OLD.claim_id AND d.campaign_id=OLD.campaign_id
          AND d.ended_at IS NOT NULL AND NEW.retention_until=d.ended_at+7776000))
    OR (NEW.retention_until=OLD.retention_until AND NEW.manual_record='{"retentionErased":true}'
      AND NEW.sha256='53c94ec954a0b1fcde8c17daa130f202139c64e0163e7053114a2e5326f1f8db'
      AND NEW.byte_size=24 AND EXISTS(SELECT 1 FROM CaseDocumentErasures e
        WHERE e.claim_id=OLD.claim_id AND e.campaign_id=OLD.campaign_id))
  )
)
BEGIN
  SELECT RAISE(ABORT,'MANUAL_EVIDENCE_APPEND_ONLY');
END;

CREATE TRIGGER case_document_erasure_apply AFTER INSERT ON CaseDocumentErasures
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM CaseRetentionDeadlines d
    JOIN DonorContacts p ON p.id=d.donor_contact_id AND p.campaign_id=d.campaign_id
    WHERE d.claim_id=NEW.claim_id AND d.campaign_id=NEW.campaign_id
      AND d.ended_at+7776000<=unixepoch() AND p.legal_hold=0
      AND NOT EXISTS (SELECT 1 FROM WishPrivateProfiles w WHERE w.wish_id=d.wish_id AND w.legal_hold=1)
  ) THEN RAISE(ABORT,'RETENTION_NOT_DUE_OR_HELD') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM Attachments WHERE claim_id=NEW.claim_id AND campaign_id=NEW.campaign_id
      AND retention_until>unixepoch()
  ) THEN RAISE(ABORT,'RETENTION_NOT_DUE_OR_HELD') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM Attachments a WHERE a.claim_id=NEW.claim_id AND a.campaign_id=NEW.campaign_id
      AND (a.manual_record IS NULL OR a.object_key<>'manual-record:'||a.id
        OR EXISTS(SELECT 1 FROM WishMedia m WHERE m.evidence_id=a.id OR m.object_key=a.object_key))
  ) OR EXISTS (
    SELECT 1 FROM WishMedia m JOIN Claims c ON c.id=NEW.claim_id
    WHERE m.claim_id=NEW.claim_id OR (m.wish_id=c.wish_id AND m.claim_id IS NULL)
  ) THEN RAISE(ABORT,'ATTACHMENT_STORAGE_UNRESOLVED') END;
  UPDATE PaperDocumentEvents SET ciphertext='ERASED',key_version='erased'
    WHERE claim_id=NEW.claim_id AND key_version<>'erased';
  UPDATE Attachments SET manual_record='{"retentionErased":true}',
    sha256='53c94ec954a0b1fcde8c17daa130f202139c64e0163e7053114a2e5326f1f8db',byte_size=24
    WHERE claim_id=NEW.claim_id AND campaign_id=NEW.campaign_id;
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'claim',NEW.claim_id,'case.documents_erased','admin',NEW.actor_id,'case_retention_elapsed');
END;

CREATE TRIGGER case_retention_claim_ended
AFTER UPDATE OF status ON Claims
WHEN OLD.status<>NEW.status AND NEW.status IN ('cancelled','expired')
BEGIN
  UPDATE DonorContacts SET retention_until=unixepoch()+7776000
  WHERE id=NEW.donor_contact_id AND campaign_id=NEW.campaign_id AND erased_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM Claims c WHERE c.donor_contact_id=NEW.donor_contact_id
      AND c.campaign_id=NEW.campaign_id AND c.id<>NEW.id);
  UPDATE Attachments SET retention_until=unixepoch()+7776000
  WHERE claim_id=NEW.id AND campaign_id=NEW.campaign_id;
END;

CREATE TRIGGER case_retention_delivery_closed
AFTER UPDATE OF closed_at ON CaseFiles
WHEN OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL
  AND EXISTS(SELECT 1 FROM Claims c WHERE c.id=NEW.claim_id AND c.status='delivered')
BEGIN
  UPDATE DonorContacts SET retention_until=NEW.closed_at+7776000
  WHERE erased_at IS NULL AND id=(SELECT donor_contact_id FROM Claims WHERE id=NEW.claim_id)
    AND NOT EXISTS(SELECT 1 FROM Claims c WHERE c.donor_contact_id=DonorContacts.id AND c.id<>NEW.claim_id);
  UPDATE WishPrivateProfiles SET retention_until=NEW.closed_at+7776000
  WHERE erased_at IS NULL AND (wish_id,campaign_id)=(SELECT wish_id,campaign_id FROM Claims WHERE id=NEW.claim_id);
  UPDATE Attachments SET retention_until=NEW.closed_at+7776000
  WHERE claim_id=NEW.claim_id AND campaign_id=(SELECT campaign_id FROM Claims WHERE id=NEW.claim_id);
END;
