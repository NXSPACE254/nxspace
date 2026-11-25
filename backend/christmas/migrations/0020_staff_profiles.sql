CREATE TABLE StaffProfiles (
  identity_id TEXT PRIMARY KEY REFERENCES StaffIdentities(id),
  display_name TEXT NOT NULL DEFAULT '' CHECK(length(display_name) <= 80),
  contact_email TEXT NOT NULL DEFAULT '' CHECK(length(contact_email) <= 254)
);
