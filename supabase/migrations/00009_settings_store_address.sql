-- Adds the store address to the settings singleton so admins can maintain
-- receipt header details (name, address, phone) in the dashboard instead of
-- env vars. See docs/00-open-questions.md D002.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_address VARCHAR(255);
