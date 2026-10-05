-- BILL-157: SMS segment count per notification, for cost tracking. Null for non-SMS rows.
-- Never edit an applied migration; add a new one.
ALTER TABLE notification_log ADD COLUMN segments INTEGER;
