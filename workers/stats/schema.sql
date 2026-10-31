CREATE TABLE IF NOT EXISTS counts (
  game   TEXT    NOT NULL,
  puzzle INTEGER NOT NULL,
  event  TEXT    NOT NULL,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game, puzzle, event)
);
