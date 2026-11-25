CREATE TABLE IntakeSessionRevocations (
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  user_id TEXT NOT NULL REFERENCES AdminUsers(id),
  revoked_through INTEGER NOT NULL CHECK(revoked_through >= 0),
  PRIMARY KEY(campaign_id,user_id)
);
