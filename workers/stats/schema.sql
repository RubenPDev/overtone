-- Overtone's stats: one row per browser, one row per thing that happened.
-- Running this file starts from empty: the old anonymous totals are dropped.

DROP TABLE IF EXISTS counts;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS daily;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS visitors;

-- A browser, by the random ID it keeps in localStorage. Where it came from and what
-- it runs on are from its first visit; `engaged` turns on once someone touches the
-- page, which is what keeps crawlers out of the numbers.
CREATE TABLE visitors (
  uid       TEXT    PRIMARY KEY,
  first_ts  INTEGER NOT NULL,
  last_ts   INTEGER NOT NULL,
  first_day TEXT    NOT NULL,
  engaged   INTEGER NOT NULL DEFAULT 0,
  country   TEXT,   -- from the IP address, by Cloudflare
  region    TEXT,   -- likewise
  ip_tz     TEXT,   -- the time zone the IP address is in
  network   TEXT,   -- who runs the connection: a carrier, an ISP, a VPN or relay
  tz        TEXT,   -- the time zone the device is set to
  device    TEXT,
  os        TEXT,
  browser   TEXT,
  lang      TEXT,
  screen    TEXT,
  source    TEXT,
  referrer  TEXT,
  landing   TEXT
);

CREATE TABLE events (
  id     INTEGER PRIMARY KEY,
  eid    TEXT    NOT NULL UNIQUE, -- the event's own ID from the browser, so a resend is ignored
  ts     INTEGER NOT NULL, -- ms since 1970, UTC
  day    TEXT    NOT NULL, -- the UTC day, which is also when puzzles change
  uid    TEXT    NOT NULL,
  sid    TEXT,
  type   TEXT    NOT NULL,
  game   TEXT,
  puzzle INTEGER,
  today  INTEGER,          -- 1 if it was that day's puzzle
  data   TEXT              -- JSON details, by type
);

CREATE INDEX events_ts   ON events (ts);
CREATE INDEX events_uid  ON events (uid, ts);
CREATE INDEX events_type ON events (type);
