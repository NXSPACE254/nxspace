-- Additive migration. Legacy rows remain intact and unassigned, never guessed.
CREATE TABLE Organisations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(id,campaign_id)
);
CREATE TABLE OrganisationMembers (
  user_id TEXT NOT NULL REFERENCES AdminUsers(id),
  organisation_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  PRIMARY KEY(user_id,organisation_id,campaign_id),
  FOREIGN KEY(organisation_id,campaign_id) REFERENCES Organisations(id,campaign_id)
);
ALTER TABLE Wishes ADD COLUMN organisation_id TEXT REFERENCES Organisations(id);
CREATE TRIGGER wish_org_guard BEFORE UPDATE OF organisation_id ON Wishes BEGIN
  SELECT CASE WHEN OLD.organisation_id IS NOT NULL AND NEW.organisation_id IS NOT OLD.organisation_id
    THEN RAISE(ABORT,'ORGANISATION_IMMUTABLE') END;
  SELECT CASE WHEN NEW.organisation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM Organisations WHERE id=NEW.organisation_id AND campaign_id=NEW.campaign_id AND active=1)
    THEN RAISE(ABORT,'ORGANISATION_SCOPE') END;
END;
CREATE TRIGGER wish_org_insert_guard BEFORE INSERT ON Wishes WHEN NEW.organisation_id IS NOT NULL BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Organisations WHERE id=NEW.organisation_id AND campaign_id=NEW.campaign_id AND active=1)
    THEN RAISE(ABORT,'ORGANISATION_SCOPE') END;
END;
ALTER TABLE GiftReceipts ADD COLUMN check_result TEXT NOT NULL DEFAULT 'matched' CHECK(check_result='matched');
ALTER TABLE GiftReceipts ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 100);
ALTER TABLE GiftReceipts ADD COLUMN note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=1000);
CREATE TABLE HandoffBatches (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  organisation_id TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES AdminUsers(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  planned_at INTEGER NOT NULL,
  location_code TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','accepted')),
  version INTEGER NOT NULL DEFAULT 0,
  accepted_by TEXT REFERENCES AdminUsers(id),
  accepted_at INTEGER,
  acceptance_reference TEXT,
  FOREIGN KEY(organisation_id,campaign_id) REFERENCES Organisations(id,campaign_id),
  UNIQUE(id,campaign_id),
  CHECK((status='draft' AND accepted_by IS NULL AND accepted_at IS NULL) OR (status='accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL AND acceptance_reference IS NOT NULL AND length(acceptance_reference)>0))
);
CREATE TABLE HandoffBatchItems (
  batch_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  claim_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
  PRIMARY KEY(batch_id,claim_id),
  FOREIGN KEY(batch_id,campaign_id) REFERENCES HandoffBatches(id,campaign_id),
  FOREIGN KEY(receipt_id,claim_id,campaign_id) REFERENCES GiftReceipts(id,claim_id,campaign_id)
);
CREATE TABLE FulfillmentOperations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  kind TEXT NOT NULL CHECK(kind IN ('receipt','batch','accept','delivery','exception','resolve')),
  idempotency_hash TEXT NOT NULL CHECK(length(idempotency_hash)=64),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  result_json TEXT NOT NULL CHECK(json_valid(result_json)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(campaign_id,actor_id,idempotency_hash)
);
CREATE TRIGGER fulfillment_no_update BEFORE UPDATE ON FulfillmentOperations BEGIN SELECT RAISE(ABORT,'OPERATIONS_APPEND_ONLY'); END;
CREATE TRIGGER fulfillment_no_delete BEFORE DELETE ON FulfillmentOperations BEGIN SELECT RAISE(ABORT,'OPERATIONS_APPEND_ONLY'); END;
CREATE TRIGGER receipt_no_update BEFORE UPDATE ON GiftReceipts BEGIN SELECT RAISE(ABORT,'RECEIPT_APPEND_ONLY'); END;
CREATE TRIGGER receipt_no_delete BEFORE DELETE ON GiftReceipts BEGIN SELECT RAISE(ABORT,'RECEIPT_APPEND_ONLY'); END;
CREATE TRIGGER batch_items_no_update BEFORE UPDATE ON HandoffBatchItems BEGIN SELECT RAISE(ABORT,'BATCH_ITEMS_APPEND_ONLY'); END;
CREATE TRIGGER batch_items_no_delete BEFORE DELETE ON HandoffBatchItems BEGIN SELECT RAISE(ABORT,'BATCH_ITEMS_APPEND_ONLY'); END;
CREATE TRIGGER batch_no_delete BEFORE DELETE ON HandoffBatches BEGIN SELECT RAISE(ABORT,'BATCH_HISTORY_REQUIRED'); END;
CREATE TRIGGER handoff_no_update BEFORE UPDATE ON Handoffs BEGIN SELECT RAISE(ABORT,'HANDOFF_APPEND_ONLY'); END;
CREATE TRIGGER handoff_no_delete BEFORE DELETE ON Handoffs BEGIN SELECT RAISE(ABORT,'HANDOFF_APPEND_ONLY'); END;
CREATE TRIGGER handoff_items_no_update BEFORE UPDATE ON HandoffItems BEGIN SELECT RAISE(ABORT,'HANDOFF_ITEMS_APPEND_ONLY'); END;
CREATE TRIGGER handoff_items_no_delete BEFORE DELETE ON HandoffItems BEGIN SELECT RAISE(ABORT,'HANDOFF_ITEMS_APPEND_ONLY'); END;
CREATE TRIGGER delivery_no_update BEFORE UPDATE ON DeliveryConfirmations BEGIN SELECT RAISE(ABORT,'DELIVERY_APPEND_ONLY'); END;
CREATE TRIGGER delivery_no_delete BEFORE DELETE ON DeliveryConfirmations BEGIN SELECT RAISE(ABORT,'DELIVERY_APPEND_ONLY'); END;

CREATE TRIGGER fulfillment_actor_guard BEFORE INSERT ON FulfillmentOperations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM AdminUsers u JOIN UserRoles r ON r.user_id=u.id
    WHERE u.id=NEW.actor_id AND u.status='active' AND r.campaign_id=NEW.campaign_id
      AND ((NEW.kind IN ('receipt','batch') AND r.role_id IN ('nx_admin','nx_staff'))
        OR (NEW.kind IN ('accept','delivery') AND r.role_id='partner_staff')
        OR (NEW.kind IN ('exception','resolve') AND r.role_id IN ('nx_admin','nx_staff','partner_staff'))))
    THEN RAISE(ABORT,'FULFILLMENT_FORBIDDEN') END;
END;
CREATE TRIGGER fulfillment_receipt_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='receipt' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN Organisations o ON o.id=w.organisation_id
    WHERE c.id=json_extract(NEW.payload,'$.claimId') AND c.campaign_id=NEW.campaign_id AND c.status='claimed'
      AND c.version=json_extract(NEW.payload,'$.expectedVersion') AND w.public_code=json_extract(NEW.payload,'$.wishCode') AND o.campaign_id=NEW.campaign_id AND o.active=1)
    OR NOT EXISTS(SELECT 1 FROM Attachments a WHERE a.id=json_extract(NEW.payload,'$.evidenceId') AND a.claim_id=json_extract(NEW.payload,'$.claimId') AND a.campaign_id=NEW.campaign_id AND a.verified_at<=unixepoch() AND a.retention_until>unixepoch())
    THEN RAISE(ABORT,'RECEIPT_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_receipt_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='receipt' BEGIN
  INSERT INTO GiftReceipts(id,campaign_id,claim_id,received_at,received_by,location_code,evidence_id,quantity,note)
    VALUES(NEW.id,NEW.campaign_id,json_extract(NEW.payload,'$.claimId'),unixepoch(),NEW.actor_id,json_extract(NEW.payload,'$.locationCode'),json_extract(NEW.payload,'$.evidenceId'),json_extract(NEW.payload,'$.quantity'),json_extract(NEW.payload,'$.note'));
  UPDATE Claims SET status='gift_received',version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason='gift_checked',updated_at=unixepoch() WHERE id=json_extract(NEW.payload,'$.claimId');
END;
CREATE TRIGGER fulfillment_batch_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='batch' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Organisations WHERE id=json_extract(NEW.payload,'$.organisationId') AND campaign_id=NEW.campaign_id AND active=1)
    OR json_array_length(NEW.payload,'$.items') NOT BETWEEN 1 AND 150
    OR (SELECT count(DISTINCT json_extract(value,'$.claimId')) FROM json_each(NEW.payload,'$.items'))<>json_array_length(NEW.payload,'$.items')
    OR (SELECT count(*) FROM json_each(NEW.payload,'$.items') j JOIN Claims c ON c.id=json_extract(j.value,'$.claimId') JOIN Wishes w ON w.id=c.wish_id JOIN GiftReceipts g ON g.claim_id=c.id
      WHERE c.campaign_id=NEW.campaign_id AND c.status='gift_received' AND c.version=json_extract(j.value,'$.expectedVersion') AND w.organisation_id=json_extract(NEW.payload,'$.organisationId'))<>json_array_length(NEW.payload,'$.items')
    THEN RAISE(ABORT,'BATCH_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_batch_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='batch' BEGIN
  INSERT INTO HandoffBatches(id,campaign_id,organisation_id,created_by,planned_at,location_code,note)
    VALUES(NEW.id,NEW.campaign_id,json_extract(NEW.payload,'$.organisationId'),NEW.actor_id,json_extract(NEW.payload,'$.plannedAt'),json_extract(NEW.payload,'$.locationCode'),json_extract(NEW.payload,'$.note'));
  INSERT INTO HandoffBatchItems(batch_id,campaign_id,claim_id,receipt_id,quantity)
    SELECT NEW.id,NEW.campaign_id,c.id,g.id,g.quantity FROM json_each(NEW.payload,'$.items') j JOIN Claims c ON c.id=json_extract(j.value,'$.claimId') JOIN GiftReceipts g ON g.claim_id=c.id;
END;
CREATE TRIGGER fulfillment_accept_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='accept' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM HandoffBatches b JOIN Organisations o ON o.id=b.organisation_id JOIN OrganisationMembers m ON m.organisation_id=b.organisation_id AND m.campaign_id=b.campaign_id
    WHERE b.id=json_extract(NEW.payload,'$.batchId') AND b.campaign_id=NEW.campaign_id AND b.status='draft' AND b.version=json_extract(NEW.payload,'$.expectedVersion')
      AND o.active=1 AND m.user_id=NEW.actor_id AND b.created_by<>NEW.actor_id AND b.created_at<=json_extract(NEW.payload,'$.handedAt'))
    OR json_extract(NEW.payload,'$.handedAt')>unixepoch()
    OR json_extract(NEW.payload,'$.receivedQuantity')<>(SELECT sum(quantity) FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId'))
    OR EXISTS(SELECT 1 FROM HandoffBatchItems i JOIN Claims c ON c.id=i.claim_id JOIN Wishes w ON w.id=c.wish_id JOIN HandoffBatches b ON b.id=i.batch_id
      WHERE i.batch_id=json_extract(NEW.payload,'$.batchId') AND (c.status<>'gift_received' OR w.organisation_id IS NOT b.organisation_id))
    THEN RAISE(ABORT,'ACCEPTANCE_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_accept_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='accept' BEGIN
  INSERT INTO Handoffs(id,campaign_id,handed_at,handed_by,partner_accepted_by,partner_accepted_at,location_code)
    SELECT id,campaign_id,json_extract(NEW.payload,'$.handedAt'),created_by,NEW.actor_id,unixepoch(),location_code FROM HandoffBatches WHERE id=json_extract(NEW.payload,'$.batchId');
  INSERT INTO HandoffItems(handoff_id,campaign_id,claim_id,receipt_id) SELECT batch_id,campaign_id,claim_id,receipt_id FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId');
  UPDATE Claims SET status='handed_over',version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason='institution_accepted',updated_at=unixepoch() WHERE id IN(SELECT claim_id FROM HandoffBatchItems WHERE batch_id=json_extract(NEW.payload,'$.batchId'));
  UPDATE HandoffBatches SET status='accepted',version=version+1,accepted_by=NEW.actor_id,accepted_at=unixepoch(),acceptance_reference=json_extract(NEW.payload,'$.acceptanceReference') WHERE id=json_extract(NEW.payload,'$.batchId');
END;
CREATE TRIGGER fulfillment_delivery_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind='delivery' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN HandoffItems i ON i.claim_id=c.id JOIN HandoffBatches b ON b.id=i.handoff_id JOIN OrganisationMembers m ON m.organisation_id=b.organisation_id AND m.campaign_id=b.campaign_id JOIN Organisations o ON o.id=b.organisation_id
    WHERE c.id=json_extract(NEW.payload,'$.claimId') AND c.campaign_id=NEW.campaign_id AND c.status='handed_over' AND c.version=json_extract(NEW.payload,'$.expectedVersion')
      AND w.organisation_id=b.organisation_id AND b.status='accepted' AND b.id=json_extract(NEW.payload,'$.handoffId') AND m.user_id=NEW.actor_id AND o.active=1)
    OR NOT EXISTS(SELECT 1 FROM Attachments a WHERE a.id=json_extract(NEW.payload,'$.evidenceId') AND a.claim_id=json_extract(NEW.payload,'$.claimId') AND a.campaign_id=NEW.campaign_id AND a.verified_at<=unixepoch() AND a.retention_until>unixepoch())
    THEN RAISE(ABORT,'DELIVERY_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_delivery_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='delivery' BEGIN
  INSERT INTO DeliveryConfirmations(claim_id,campaign_id,handoff_id,delivered_at,confirmed_by,evidence_id)
    VALUES(json_extract(NEW.payload,'$.claimId'),NEW.campaign_id,json_extract(NEW.payload,'$.handoffId'),json_extract(NEW.payload,'$.deliveredAt'),NEW.actor_id,json_extract(NEW.payload,'$.evidenceId'));
  UPDATE Claims SET status='delivered',version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason='institution_delivered',updated_at=unixepoch() WHERE id=json_extract(NEW.payload,'$.claimId');
END;
CREATE TRIGGER fulfillment_exception_guard BEFORE INSERT ON FulfillmentOperations WHEN NEW.kind IN ('exception','resolve') BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN Organisations o ON o.id=w.organisation_id
    WHERE c.id=json_extract(NEW.payload,'$.claimId') AND c.campaign_id=NEW.campaign_id AND c.version=json_extract(NEW.payload,'$.expectedVersion') AND o.active=1 AND o.campaign_id=c.campaign_id
      AND ((NEW.kind='exception' AND c.status IN ('claimed','gift_received','handed_over')) OR (NEW.kind='resolve' AND c.status='exception' AND c.exception_from_status IN ('claimed','gift_received','handed_over')))
      AND (EXISTS(SELECT 1 FROM UserRoles WHERE user_id=NEW.actor_id AND campaign_id=c.campaign_id AND role_id IN ('nx_admin','nx_staff'))
        OR (COALESCE(c.exception_from_status,c.status)='handed_over' AND EXISTS(SELECT 1 FROM OrganisationMembers WHERE user_id=NEW.actor_id AND organisation_id=w.organisation_id AND campaign_id=c.campaign_id))))
    THEN RAISE(ABORT,'EXCEPTION_CONFLICT') END;
END;
CREATE TRIGGER fulfillment_exception_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='exception' BEGIN
  UPDATE Claims SET exception_from_status=status,status='exception',version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason=json_extract(NEW.payload,'$.reasonCode'),updated_at=unixepoch() WHERE id=json_extract(NEW.payload,'$.claimId');
END;
CREATE TRIGGER fulfillment_resolve_apply AFTER INSERT ON FulfillmentOperations WHEN NEW.kind='resolve' BEGIN
  UPDATE Claims SET status=exception_from_status,exception_from_status=NULL,version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason=json_extract(NEW.payload,'$.reasonCode'),updated_at=unixepoch() WHERE id=json_extract(NEW.payload,'$.claimId');
END;
CREATE TRIGGER fulfillment_audit AFTER INSERT ON FulfillmentOperations BEGIN
  INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code)
    VALUES(NEW.campaign_id,'fulfillment',NEW.id,'fulfillment.'||NEW.kind,'admin',NEW.actor_id,COALESCE(json_extract(NEW.payload,'$.reasonCode'),'verified_operation'));
END;
