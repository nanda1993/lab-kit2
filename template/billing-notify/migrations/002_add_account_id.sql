-- Applied to production 2026-06-18. Never edit an applied migration; add a new one.
ALTER TABLE notification_log ADD COLUMN account_id TEXT;
CREATE INDEX notification_log_account_idx ON notification_log (account_id);
