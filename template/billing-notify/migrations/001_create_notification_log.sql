-- Applied to production 2026-03-02. Never edit an applied migration; add a new one.
CREATE TABLE notification_log (
  id            TEXT PRIMARY KEY,
  channel       TEXT NOT NULL,
  template      TEXT NOT NULL,
  status        TEXT NOT NULL,
  provider_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
