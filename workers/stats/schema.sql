CREATE TABLE IF NOT EXISTS counts (
  game   TEXT    NOT NULL,
  puzzle INTEGER NOT NULL,
  event  TEXT    NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game, puzzle, event)
);

CREATE TABLE IF NOT EXISTS players (
  country TEXT    PRIMARY KEY,
  n       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily (
  day    TEXT    NOT NULL,
  metric TEXT    NOT NULL,
  key    TEXT    NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric, key)
);

-- /likes runs on every homepage visit, and this stops it reading the whole table.
CREATE INDEX IF NOT EXISTS daily_metric ON daily (metric);
