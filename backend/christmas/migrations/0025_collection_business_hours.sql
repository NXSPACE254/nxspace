ALTER TABLE Organisations ADD COLUMN business_hours TEXT NOT NULL DEFAULT ''
  CHECK(length(business_hours) <= 1000);
