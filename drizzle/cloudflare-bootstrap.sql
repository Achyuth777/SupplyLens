-- Safe to rerun: preserve all existing workspace data.
CREATE TABLE IF NOT EXISTS workspaces (
  owner TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  revision INTEGER DEFAULT 0 NOT NULL
);
