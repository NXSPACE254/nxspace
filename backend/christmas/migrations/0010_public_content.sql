-- Public copy only: never store contacts, children identities or secrets here.
CREATE TABLE CampaignPublicContent (
  campaign_id TEXT PRIMARY KEY REFERENCES Campaigns(id),
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
