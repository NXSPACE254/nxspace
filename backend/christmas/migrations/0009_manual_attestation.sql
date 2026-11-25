-- Widen existing evidence metadata to explicitly typed, immutable manual records.
-- No object upload, fake PDF, scanner claim, R2 object or new adoption database.
PRAGMA defer_foreign_keys=ON;
DROP TRIGGER fulfillment_receipt_guard;
DROP TRIGGER fulfillment_delivery_guard;
CREATE TABLE Attachments_next (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  claim_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','application/pdf','application/vnd.nxspace.manual-attestation+json')),
  byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
  verified_at INTEGER NOT NULL,
  retention_until INTEGER NOT NULL,
  manual_record TEXT CHECK(manual_record IS NULL OR json_valid(manual_record)),
  CHECK((content_type='application/vnd.nxspace.manual-attestation+json' AND manual_record IS NOT NULL) OR (content_type<>'application/vnd.nxspace.manual-attestation+json' AND manual_record IS NULL)),
  FOREIGN KEY(claim_id,campaign_id) REFERENCES Claims(id,campaign_id),
  UNIQUE(id,claim_id,campaign_id)
);
INSERT INTO Attachments_next(id,campaign_id,claim_id,object_key,sha256,content_type,byte_size,verified_at,retention_until) SELECT id,campaign_id,claim_id,object_key,sha256,content_type,byte_size,verified_at,retention_until FROM Attachments;
DROP TABLE Attachments;
ALTER TABLE Attachments_next RENAME TO Attachments;
CREATE TRIGGER fulfillment_receipt_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='receipt' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN Organisations o ON o.id=w.organisation_id
    WHERE c.id=json_extract(NEW.payload,'$.claimId') AND c.campaign_id=NEW.campaign_id AND c.status='claimed'
      AND c.version=json_extract(NEW.payload,'$.expectedVersion') AND w.public_code=json_extract(NEW.payload,'$.wishCode') AND o.campaign_id=NEW.campaign_id AND o.active=1)
    OR NOT EXISTS(SELECT 1 FROM Attachments a WHERE a.id=json_extract(NEW.payload,'$.evidenceId') AND a.claim_id=json_extract(NEW.payload,'$.claimId') AND a.campaign_id=NEW.campaign_id AND a.verified_at<=unixepoch() AND a.retention_until>unixepoch() AND (a.manual_record IS NULL OR (json_extract(a.manual_record,'$.kind')=NEW.kind AND json_extract(a.manual_record,'$.actorId')=NEW.actor_id AND json_extract(a.manual_record,'$.unitId')=NEW.unit_id)))
    THEN RAISE(ABORT,'RECEIPT_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_delivery_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='delivery' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN HandoffItems i ON i.claim_id=c.id JOIN HandoffBatches b ON b.id=i.handoff_id JOIN OrganisationMembers m ON m.organisation_id=b.organisation_id AND m.campaign_id=b.campaign_id JOIN Organisations o ON o.id=b.organisation_id
    WHERE c.id=json_extract(NEW.payload,'$.claimId') AND c.campaign_id=NEW.campaign_id AND c.status='handed_over' AND c.version=json_extract(NEW.payload,'$.expectedVersion')
      AND w.organisation_id=b.organisation_id AND b.status='accepted' AND b.id=json_extract(NEW.payload,'$.handoffId') AND m.user_id=NEW.actor_id AND o.active=1)
    OR NOT EXISTS(SELECT 1 FROM Attachments a WHERE a.id=json_extract(NEW.payload,'$.evidenceId') AND a.claim_id=json_extract(NEW.payload,'$.claimId') AND a.campaign_id=NEW.campaign_id AND a.verified_at<=unixepoch() AND a.retention_until>unixepoch() AND (a.manual_record IS NULL OR (json_extract(a.manual_record,'$.kind')=NEW.kind AND json_extract(a.manual_record,'$.actorId')=NEW.actor_id AND json_extract(a.manual_record,'$.unitId')=NEW.unit_id)))
    THEN RAISE(ABORT,'DELIVERY_CONFLICT') END;
END;
CREATE TRIGGER manual_evidence_no_update BEFORE UPDATE ON Attachments WHEN OLD.manual_record IS NOT NULL BEGIN SELECT RAISE(ABORT,'MANUAL_EVIDENCE_APPEND_ONLY'); END;
CREATE TRIGGER manual_evidence_no_delete BEFORE DELETE ON Attachments WHEN OLD.manual_record IS NOT NULL BEGIN SELECT RAISE(ABORT,'MANUAL_EVIDENCE_APPEND_ONLY'); END;
PRAGMA defer_foreign_keys=OFF;
