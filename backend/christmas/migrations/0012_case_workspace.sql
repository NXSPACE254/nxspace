-- Additive UI-workflow data; prior claims, public copy and history remain intact.
ALTER TABLE DonorPasswords ADD COLUMN must_change INTEGER NOT NULL DEFAULT 0 CHECK(must_change IN (0,1));
CREATE TABLE CampaignContentDrafts (campaign_id TEXT PRIMARY KEY REFERENCES Campaigns(id),payload TEXT NOT NULL CHECK(json_valid(payload)),version INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')));
CREATE TABLE CampaignContentRevisions (id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES Campaigns(id),payload TEXT NOT NULL CHECK(json_valid(payload)),version INTEGER NOT NULL,kind TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES AdminUsers(id),created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TRIGGER content_revision_no_update BEFORE UPDATE ON CampaignContentRevisions BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER content_revision_no_delete BEFORE DELETE ON CampaignContentRevisions BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE CaseSupportEvents (id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES Campaigns(id),wish_id TEXT NOT NULL REFERENCES Wishes(id),unit_id TEXT NOT NULL REFERENCES Organisations(id),actor_id TEXT NOT NULL REFERENCES AdminUsers(id),topic_id TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('open','resolved')),ciphertext TEXT NOT NULL,key_version TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()),UNIQUE(topic_id,version));
CREATE INDEX case_support_wish ON CaseSupportEvents(campaign_id,wish_id,topic_id,version);
CREATE TRIGGER support_no_update BEFORE UPDATE ON CaseSupportEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER support_no_delete BEFORE DELETE ON CaseSupportEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE WorkspaceSearchLimits (campaign_id TEXT NOT NULL,actor_id TEXT NOT NULL,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL,PRIMARY KEY(campaign_id,actor_id));
