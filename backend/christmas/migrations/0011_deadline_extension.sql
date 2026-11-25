-- An authorized, append-only request is required to extend an unreceived claim.
CREATE TABLE ClaimDeadlineExtensions (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
 claim_id TEXT NOT NULL REFERENCES Claims(id),
 actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
 expected_version INTEGER NOT NULL,
 old_due_at INTEGER NOT NULL,
 new_due_at INTEGER NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 2 AND 500),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER deadline_extension_guard BEFORE INSERT ON ClaimDeadlineExtensions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN Campaigns p ON p.id=c.campaign_id JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id JOIN Organisations o ON o.id=a.organisation_id WHERE c.id=NEW.claim_id AND c.campaign_id=NEW.campaign_id AND c.version=NEW.expected_version AND c.status='claimed' AND c.gift_due_at=NEW.old_due_at AND NEW.new_due_at>c.gift_due_at AND NEW.new_due_at>unixepoch() AND NEW.new_due_at<=p.gift_due_at AND a.user_id=NEW.actor_id AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active' AND o.active=1 AND (a.kind='admin' OR w.organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=c.campaign_id)) AND NOT EXISTS(SELECT 1 FROM GiftReceipts WHERE claim_id=c.id)) THEN RAISE(ABORT,'DEADLINE_FORBIDDEN_OR_CONFLICT') END;
END;
DROP TRIGGER claim_identity_immutable;
CREATE TRIGGER claim_identity_immutable BEFORE UPDATE ON Claims
WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id OR NEW.wish_id<>OLD.wish_id
 OR NEW.donor_contact_id<>OLD.donor_contact_id OR NEW.idempotency_hash<>OLD.idempotency_hash
 OR NEW.request_hash<>OLD.request_hash OR NEW.claimed_at<>OLD.claimed_at
 OR NEW.expires_at<>OLD.expires_at OR NEW.source<>OLD.source
 OR (NEW.gift_due_at<>OLD.gift_due_at AND NOT EXISTS(SELECT 1 FROM ClaimDeadlineExtensions e WHERE e.claim_id=OLD.id AND e.expected_version=OLD.version AND e.old_due_at=OLD.gift_due_at AND e.new_due_at=NEW.gift_due_at AND e.actor_id=NEW.actor_ref AND NEW.status=OLD.status AND NEW.last_reason='deadline_extended'))
BEGIN SELECT RAISE(ABORT,'CLAIM_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER deadline_extension_apply AFTER INSERT ON ClaimDeadlineExtensions BEGIN
 UPDATE Claims SET gift_due_at=NEW.new_due_at,version=version+1,actor_type='admin',actor_ref=NEW.actor_id,last_reason='deadline_extended',updated_at=unixepoch() WHERE id=NEW.claim_id;
 INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) SELECT NEW.id,NEW.campaign_id,a.organisation_id,NEW.actor_id,o.label,'claim.deadline_extended',NEW.claim_id,NEW.reason FROM OperatingAccounts a JOIN Organisations o ON o.id=a.organisation_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id;
END;
CREATE TRIGGER deadline_extension_no_update BEFORE UPDATE ON ClaimDeadlineExtensions BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER deadline_extension_no_delete BEFORE DELETE ON ClaimDeadlineExtensions BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
