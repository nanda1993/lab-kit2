-- SMS segments sent, for Finance cost tracking (BILL-157). NULL for non-SMS rows.
ALTER TABLE notification_log ADD COLUMN segments INTEGER;
