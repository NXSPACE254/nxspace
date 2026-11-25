CREATE TABLE CampaignBrandMedia (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES Campaigns(id),
  actor_id TEXT NOT NULL REFERENCES AdminUsers(id),
  bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 2097152),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 2048),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 2048),
  ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX campaign_brand_media_rate ON CampaignBrandMedia(actor_id,created_at);
