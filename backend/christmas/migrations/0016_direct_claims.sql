-- Package 28: additive annual policy; old accounts and claims remain intact.
ALTER TABLE CampaignOperatingRules ADD COLUMN direct_claims INTEGER NOT NULL DEFAULT 0 CHECK(direct_claims IN (0,1));
ALTER TABLE DonorContacts ADD COLUMN verification_method TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE OwnerAccess ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'legacy';
CREATE TABLE PinResetEvents (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES Campaigns(id), portal_id TEXT NOT NULL REFERENCES DonorPortals(id),
 actor_id TEXT NOT NULL REFERENCES AdminUsers(id), identity_method TEXT NOT NULL,
 reference_ciphertext TEXT NOT NULL, key_version TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER pin_reset_no_update BEFORE UPDATE ON PinResetEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER pin_reset_no_delete BEFORE DELETE ON PinResetEvents BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE DonorPins (
 portal_id TEXT PRIMARY KEY REFERENCES DonorPortals(id),
 salt TEXT NOT NULL CHECK(length(salt)=32),
 pin_hash TEXT NOT NULL CHECK(length(pin_hash)=64),
 key_version TEXT NOT NULL,
 iterations INTEGER NOT NULL DEFAULT 100000 CHECK(iterations=100000),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE PinAttemptWindows (
 campaign_id TEXT NOT NULL REFERENCES Campaigns(id), bucket_hash TEXT NOT NULL,
 seconds INTEGER NOT NULL, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL,
 PRIMARY KEY(campaign_id,bucket_hash,seconds)
);
CREATE TABLE PrivacyStatements (
 campaign_id TEXT NOT NULL REFERENCES Campaigns(id), version TEXT NOT NULL,
 title TEXT NOT NULL, body TEXT NOT NULL, published_at INTEGER NOT NULL DEFAULT(unixepoch()),
 actor_id TEXT NOT NULL REFERENCES AdminUsers(id), PRIMARY KEY(campaign_id,version)
);
CREATE TRIGGER privacy_no_update BEFORE UPDATE ON PrivacyStatements BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER privacy_no_delete BEFORE DELETE ON PrivacyStatements BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE ClaimPublicSnapshots (
 claim_id TEXT PRIMARY KEY REFERENCES Claims(id), payload TEXT NOT NULL CHECK(json_valid(payload)),
 origin TEXT NOT NULL DEFAULT 'claim_time', created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
INSERT INTO ClaimPublicSnapshots(claim_id,payload,origin,created_at)
 SELECT c.id,json_object('publicCode',w.public_code,'publicNickname',w.public_nickname,'giftName',w.gift_name,'description',w.description,'specifications',w.specifications,'claimedAt',c.claimed_at,'giftDueAt',c.gift_due_at),'migration_current_content',c.claimed_at FROM Claims c JOIN Wishes w ON w.id=c.wish_id;
CREATE TRIGGER claim_public_snapshot AFTER INSERT ON Claims BEGIN
 INSERT INTO ClaimPublicSnapshots(claim_id,payload) SELECT NEW.id,json_object('publicCode',w.public_code,'publicNickname',w.public_nickname,'giftName',w.gift_name,'description',w.description,'specifications',w.specifications,'claimedAt',NEW.claimed_at,'giftDueAt',NEW.gift_due_at) FROM Wishes w WHERE w.id=NEW.wish_id;
END;
CREATE TRIGGER snapshot_no_update BEFORE UPDATE ON ClaimPublicSnapshots BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER snapshot_no_delete BEFORE DELETE ON ClaimPublicSnapshots BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE ClaimPrivacyAcceptances (
 claim_id TEXT PRIMARY KEY REFERENCES Claims(id), campaign_id TEXT NOT NULL,
 privacy_version TEXT NOT NULL, accepted_at INTEGER NOT NULL DEFAULT(unixepoch()),
 FOREIGN KEY(campaign_id,privacy_version) REFERENCES PrivacyStatements(campaign_id,version)
);
CREATE TRIGGER privacy_accept_guard BEFORE INSERT ON Claims WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id AND direct_claims=1) BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM DonorContacts d JOIN PrivacyStatements p ON p.campaign_id=d.campaign_id AND p.version=d.consent_version JOIN DonorPins n ON n.portal_id=NEW.portal_id WHERE d.id=NEW.donor_contact_id AND d.verification_method='self_reported') THEN RAISE(ABORT,'DIRECT_CONSENT_REQUIRED') END;
END;
CREATE TRIGGER privacy_accept AFTER INSERT ON Claims WHEN EXISTS(SELECT 1 FROM CampaignOperatingRules WHERE campaign_id=NEW.campaign_id AND direct_claims=1) BEGIN
 INSERT INTO ClaimPrivacyAcceptances(claim_id,campaign_id,privacy_version) SELECT NEW.id,NEW.campaign_id,consent_version FROM DonorContacts WHERE id=NEW.donor_contact_id;
END;
CREATE TRIGGER acceptance_no_update BEFORE UPDATE ON ClaimPrivacyAcceptances BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER acceptance_no_delete BEFORE DELETE ON ClaimPrivacyAcceptances BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TABLE MailingCorrections (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES Campaigns(id), claim_id TEXT NOT NULL REFERENCES Claims(id),
 contact_id TEXT NOT NULL REFERENCES DonorContacts(id), actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
 unit_id TEXT NOT NULL REFERENCES Organisations(id), expected_version INTEGER NOT NULL,
 new_ciphertext TEXT NOT NULL, difference_ciphertext TEXT NOT NULL, key_version TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER mailing_correction_guard BEFORE INSERT ON MailingCorrections BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Claims c JOIN DonorContacts d ON d.id=c.donor_contact_id JOIN OperatingAccounts a ON a.campaign_id=c.campaign_id JOIN AdminUsers u ON u.id=a.user_id WHERE c.id=NEW.claim_id AND c.campaign_id=NEW.campaign_id AND d.id=NEW.contact_id AND d.profile_version=NEW.expected_version AND d.erased_at IS NULL AND a.user_id=NEW.actor_id AND a.organisation_id=NEW.unit_id AND a.kind IN ('admin','bookhouse') AND a.revoked_at IS NULL AND u.status='active') THEN RAISE(ABORT,'MAILING_CORRECTION_CONFLICT') END;
END;
CREATE TRIGGER mailing_correction_apply AFTER INSERT ON MailingCorrections BEGIN
 UPDATE DonorContacts SET ciphertext=NEW.new_ciphertext,key_version=NEW.key_version,profile_version=profile_version+1,protection_actor=NEW.actor_id,owner_access_id=NULL,protection_reason='operational_profile',preference_patch=NULL,edit_unit_id=NEW.unit_id,edit_handler=(SELECT COALESCE(NULLIF(display_name,''),'授權工作人員') FROM OperatingAccounts WHERE user_id=NEW.actor_id AND campaign_id=NEW.campaign_id),edit_reference='mailing_correction' WHERE id=NEW.contact_id;
 INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) VALUES(NEW.id,NEW.campaign_id,NEW.unit_id,NEW.actor_id,'授權工作人員','contact.mailing_corrected',NEW.claim_id,'encrypted_difference');
END;
CREATE TRIGGER mailing_correction_no_update BEFORE UPDATE ON MailingCorrections BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER mailing_correction_no_delete BEFORE DELETE ON MailingCorrections BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
