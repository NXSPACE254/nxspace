-- Additive settings and auditable, non-destructive NXSPACE batch management.
ALTER TABLE Organisations ADD COLUMN receiving_address TEXT NOT NULL DEFAULT '';
ALTER TABLE Organisations ADD COLUMN receiving_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE Organisations ADD COLUMN receiving_from TEXT NOT NULL DEFAULT '';
ALTER TABLE Organisations ADD COLUMN receiving_until TEXT NOT NULL DEFAULT '';
ALTER TABLE Organisations ADD COLUMN receiving_hours TEXT NOT NULL DEFAULT '';
ALTER TABLE Organisations ADD COLUMN receiving_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE Organisations ADD COLUMN information_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(information_confirmed IN (0,1));
ALTER TABLE Organisations ADD COLUMN receiving_open INTEGER NOT NULL DEFAULT 0 CHECK(receiving_open IN (0,1));
ALTER TABLE Organisations ADD COLUMN information_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE Wishes ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1));
CREATE TABLE BulkWishOperations (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES Campaigns(id), actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
 action TEXT NOT NULL CHECK(action IN ('approve','publish','unpublish','unpublish_demo')),
 request_hash TEXT NOT NULL, result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER bulk_wish_actor_guard BEFORE INSERT ON BulkWishOperations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id JOIN UserRoles r ON r.user_id=u.id AND r.campaign_id=a.campaign_id WHERE a.user_id=NEW.actor_id AND a.campaign_id=NEW.campaign_id AND a.kind='admin' AND a.revoked_at IS NULL AND u.status='active' AND r.role_id='nx_admin') THEN RAISE(ABORT,'BULK_FORBIDDEN') END;
END;
CREATE TRIGGER bulk_wish_no_update BEFORE UPDATE ON BulkWishOperations BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER bulk_wish_no_delete BEFORE DELETE ON BulkWishOperations BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
