-- For a database already set up from an earlier schema.sql: adds the device details
-- and the names table without touching anything recorded so far. Run it once:
--   npx wrangler d1 execute overtone-stats --remote --file=migrations/001-names-and-device.sql
-- (A database made from the current schema.sql already has all of this.)

ALTER TABLE visitors ADD COLUMN city TEXT;
ALTER TABLE visitors ADD COLUMN os_version TEXT;
ALTER TABLE visitors ADD COLUMN browser_version TEXT;
ALTER TABLE visitors ADD COLUMN model TEXT;
ALTER TABLE visitors ADD COLUMN dpr REAL;
ALTER TABLE visitors ADD COLUMN langs TEXT;
ALTER TABLE visitors ADD COLUMN standalone INTEGER;

CREATE TABLE IF NOT EXISTS labels (
  uid     TEXT PRIMARY KEY,
  name    TEXT,
  note    TEXT,
  updated INTEGER
);
