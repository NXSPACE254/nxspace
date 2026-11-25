-- Additive records; existing claims and their promised dates are unchanged.
ALTER TABLE Wishes ADD COLUMN created_unit_id TEXT REFERENCES Organisations(id);
CREATE TABLE CampaignSettingChanges (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
 version INTEGER NOT NULL CHECK(version>0),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(campaign_id,version)
);
CREATE TRIGGER campaign_setting_no_update BEFORE UPDATE ON CampaignSettingChanges BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER campaign_setting_no_delete BEFORE DELETE ON CampaignSettingChanges BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER campaign_setting_guard BEFORE INSERT ON CampaignSettingChanges BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id JOIN Organisations o ON o.id=a.organisation_id WHERE a.campaign_id=NEW.campaign_id AND a.user_id=NEW.actor_id AND a.kind='admin' AND a.revoked_at IS NULL AND u.status='active' AND o.active=1) THEN RAISE(ABORT,'SETTINGS_FORBIDDEN') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM Claims WHERE campaign_id=NEW.campaign_id AND status NOT IN ('cancelled','expired') AND gift_due_at>json_extract(NEW.payload,'$.after.giftDueAt')) OR EXISTS(SELECT 1 FROM Wishes WHERE campaign_id=NEW.campaign_id AND (claim_due_at>json_extract(NEW.payload,'$.after.claimDeadlineAt') OR gift_due_at>json_extract(NEW.payload,'$.after.giftDueAt'))) THEN RAISE(ABORT,'EXISTING_DEADLINES_CONFLICT') END;
END;
CREATE TABLE PaperDocumentEvents (
 id TEXT PRIMARY KEY REFERENCES CaseOperations(id),
 claim_id TEXT NOT NULL REFERENCES Claims(id),
 document_type TEXT NOT NULL CHECK(document_type IN ('thanks','proof')),
 ciphertext TEXT NOT NULL,
 key_version TEXT NOT NULL
);
CREATE TRIGGER paper_event_no_update BEFORE UPDATE ON PaperDocumentEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER paper_event_no_delete BEFORE DELETE ON PaperDocumentEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
