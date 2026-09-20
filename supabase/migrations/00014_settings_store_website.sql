-- The website printed at the foot of receipts ("Order also: ...") is editable in
-- Store Details. Until this is applied the app falls back to www.GTS08.com.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_website VARCHAR(255);
