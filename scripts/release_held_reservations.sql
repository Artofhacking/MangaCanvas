-- Last-resort rollback for stale held reservations (MySQL 8).
-- Prefer the in-process sweeper. Run only if workers are down.
-- Restores users.credits and marks rows expired. Does not write ledger consume.

UPDATE users u
INNER JOIN billing_reservations r ON r.user_id = u.id
SET
  u.credits = u.credits + r.amount,
  r.status = 'expired',
  r.updated_at = UTC_TIMESTAMP(6)
WHERE r.status = 'held'
  AND r.expires_at < UTC_TIMESTAMP(6)
  AND r.updated_at < DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 120 SECOND);
