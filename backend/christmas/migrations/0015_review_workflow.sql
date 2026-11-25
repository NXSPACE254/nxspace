-- Keep the existing proposal/review pipeline and historical records.
ALTER TABLE ProposalReviews ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE CampaignOperatingRules ADD COLUMN expected_delivery_at INTEGER;
ALTER TABLE OperatingAccounts ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
CREATE TRIGGER proposal_return_reason BEFORE INSERT ON ProposalReviews WHEN NEW.decision='rejected' AND length(trim(NEW.reason))<2 BEGIN SELECT RAISE(ABORT,'RETURN_REASON_REQUIRED'); END;
-- Historical pending proposals are preserved; block only new duplicates.
CREATE TRIGGER proposal_pending_guard BEFORE INSERT ON PublicWishProposals WHEN EXISTS(SELECT 1 FROM PublicWishProposals WHERE wish_id=NEW.wish_id AND status='pending') BEGIN SELECT RAISE(ABORT,'REVIEW_ALREADY_PENDING'); END;
CREATE TRIGGER proposal_submission_guard BEFORE INSERT ON PublicWishProposals BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Wishes w JOIN OperatingAccounts a ON a.campaign_id=w.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE w.id=NEW.wish_id AND w.campaign_id=NEW.campaign_id AND w.version=NEW.base_version AND a.user_id=NEW.created_by AND a.revoked_at IS NULL AND u.status='active' AND (a.kind='admin' OR (a.kind='bookhouse' AND a.organisation_id=w.organisation_id))) THEN RAISE(ABORT,'SUBMISSION_FORBIDDEN_OR_CONFLICT') END;
END;

-- Accept verified items independently; untouched items stay at their collection site.
DROP TRIGGER fulfillment_accept_guard;
DROP TRIGGER fulfillment_accept_apply;
CREATE TRIGGER fulfillment_accept_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='accept' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM HandoffBatches b JOIN Organisations o ON o.id=b.organisation_id JOIN OrganisationMembers m ON m.organisation_id=b.organisation_id AND m.campaign_id=b.campaign_id
    WHERE b.id=json_extract(NEW.payload,'$.batchId') AND b.campaign_id=NEW.campaign_id AND (b.status='draft' OR json_type(NEW.payload,'$.checkedItems')='array') AND b.version=json_extract(NEW.payload,'$.expectedVersion')
      AND o.active=1 AND m.user_id=NEW.actor_id AND b.created_by<>NEW.actor_id AND b.created_at<=json_extract(NEW.payload,'$.handedAt'))
    OR (json_type(NEW.payload,'$.checkedItems') IS NOT NULL AND (json_type(NEW.payload,'$.checkedItems')<>'array' OR json_array_length(NEW.payload,'$.checkedItems')<1 OR json_array_length(NEW.payload,'$.checkedItems')>150))
    OR (json_type(NEW.payload,'$.checkedItems')='array' AND json_array_length(NEW.payload,'$.checkedItems')<>(SELECT count(*) FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId') AND claim_id IN (SELECT value FROM json_each(NEW.payload,'$.checkedItems'))))
    OR json_extract(NEW.payload,'$.handedAt')>unixepoch()
    OR json_extract(NEW.payload,'$.receivedQuantity')<>(SELECT sum(quantity) FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId') AND (json_type(NEW.payload,'$.checkedItems') IS NULL OR claim_id IN (SELECT value FROM json_each(NEW.payload,'$.checkedItems'))))
    OR EXISTS(SELECT 1 FROM HandoffBatchItems i JOIN Claims c ON c.id=i.claim_id JOIN Wishes w ON w.id=c.wish_id JOIN HandoffBatches b ON b.id=i.batch_id
      WHERE i.batch_id=json_extract(NEW.payload,'$.batchId') AND (json_type(NEW.payload,'$.checkedItems') IS NULL OR i.claim_id IN (SELECT value FROM json_each(NEW.payload,'$.checkedItems'))) AND (c.status<>'gift_received' OR w.organisation_id IS NOT b.organisation_id))
    THEN RAISE(ABORT,'ACCEPTANCE_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_accept_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='accept' BEGIN
  INSERT INTO Handoffs(id,campaign_id,handed_at,handed_by,partner_accepted_by,partner_accepted_at,location_code)
    SELECT id,campaign_id,json_extract(NEW.payload,'$.handedAt'),created_by,NEW.actor_id,unixepoch(),location_code FROM HandoffBatches WHERE id=json_extract(NEW.payload,'$.batchId') AND NOT EXISTS(SELECT 1 FROM Handoffs WHERE id=json_extract(NEW.payload,'$.batchId'));
  INSERT INTO HandoffItems(handoff_id,campaign_id,claim_id,receipt_id) SELECT batch_id,campaign_id,claim_id,receipt_id FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId') AND (json_type(NEW.payload,'$.checkedItems') IS NULL OR claim_id IN (SELECT value FROM json_each(NEW.payload,'$.checkedItems')));
  UPDATE Claims SET status='handed_over',version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason='institution_accepted',updated_at=unixepoch() WHERE id IN(SELECT claim_id FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId') AND (json_type(NEW.payload,'$.checkedItems') IS NULL OR claim_id IN (SELECT value FROM json_each(NEW.payload,'$.checkedItems'))));
  UPDATE HandoffBatches SET status='accepted',version=version+1,accepted_by=NEW.actor_id,accepted_at=unixepoch(),acceptance_reference=json_extract(NEW.payload,'$.acceptanceReference') WHERE id=json_extract(NEW.payload,'$.batchId');
END;
