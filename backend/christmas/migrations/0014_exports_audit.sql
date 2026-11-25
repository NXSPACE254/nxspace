ALTER TABLE OperatingAccounts ADD COLUMN documents_export INTEGER NOT NULL DEFAULT 0 CHECK(documents_export IN (0,1));
CREATE TABLE PlatformAudit (
 id TEXT PRIMARY KEY,
 campaign_id TEXT REFERENCES Campaigns(id),
 module TEXT NOT NULL DEFAULT 'christmas',
 actor_id TEXT NOT NULL,
 actor_name TEXT NOT NULL,
 unit_id TEXT NOT NULL,
 action TEXT NOT NULL,
 resource_id TEXT NOT NULL,
 result TEXT NOT NULL CHECK(result IN ('success','failure')),
 details TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details)),
 before_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(before_json)),
 after_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(after_json)),
 occurred_at INTEGER NOT NULL DEFAULT(unixepoch()),
 retention_until INTEGER NOT NULL DEFAULT(unixepoch()+31536000)
);
CREATE INDEX platform_audit_recent ON PlatformAudit(campaign_id,occurred_at DESC);
CREATE TRIGGER platform_audit_no_update BEFORE UPDATE ON PlatformAudit BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER platform_audit_retention BEFORE DELETE ON PlatformAudit WHEN OLD.retention_until>unixepoch() BEGIN SELECT RAISE(ABORT,'RETENTION_NOT_DUE'); END;
CREATE TRIGGER platform_unit_audit AFTER INSERT ON UnitActions BEGIN
 INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result,before_json,after_json)
 SELECT NEW.id,NEW.campaign_id,NEW.actor_id,NEW.handler,NEW.unit_id,NEW.action,NEW.resource_id,'success',
 COALESCE((SELECT after_json FROM PlatformAudit WHERE campaign_id=NEW.campaign_id AND resource_id=NEW.resource_id ORDER BY occurred_at DESC,rowid DESC LIMIT 1),'{}'),
 json_object('claimStatus',(SELECT status FROM Claims WHERE id=NEW.resource_id),'claimVersion',(SELECT version FROM Claims WHERE id=NEW.resource_id),'wishStatus',(SELECT status FROM Wishes WHERE id=NEW.resource_id),'wishVersion',(SELECT version FROM Wishes WHERE id=NEW.resource_id),'publication',(SELECT publication_status FROM Wishes WHERE id=NEW.resource_id),'thankStatus',(SELECT thank_status FROM CaseFiles WHERE claim_id=NEW.resource_id),'proofStatus',(SELECT proof_status FROM CaseFiles WHERE claim_id=NEW.resource_id),'documentsExport',(SELECT documents_export FROM OperatingAccounts WHERE user_id=NEW.resource_id AND campaign_id=NEW.campaign_id));
END;
-- Keep older business history visible without copying free-text contact reasons.
INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result,occurred_at,retention_until)
SELECT id,campaign_id,actor_id,handler,unit_id,action,resource_id,'success',occurred_at,occurred_at+31536000 FROM UnitActions;
CREATE TRIGGER platform_donor_auth AFTER INSERT ON DonorAuthEvents BEGIN
 INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result)
 SELECT 'auth-'||NEW.id,campaign_id,NEW.portal_id,'認領者','public','account.'||NEW.action,NEW.portal_id,'success' FROM DonorPortals WHERE id=NEW.portal_id;
END;
INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result,occurred_at,retention_until)
SELECT 'auth-'||e.id,p.campaign_id,e.portal_id,'認領者','public','account.'||e.action,e.portal_id,'success',e.created_at,e.created_at+31536000 FROM DonorAuthEvents e JOIN DonorPortals p ON p.id=e.portal_id;
