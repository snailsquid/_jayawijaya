-- Re-running this file replaces the promotional window instead of stacking it.
-- The seven days begin when this statement is executed against the database.
INSERT INTO access_grants
  (id, subject_type, subject_id, tier, starts_at, expires_at, active, reason, created_at)
VALUES
  ('global-premium-week', 'global', NULL, 'pro',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days'),
   1, 'Seven-day site-wide premium access',
   strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(id) DO UPDATE SET
  starts_at = excluded.starts_at,
  expires_at = excluded.expires_at,
  active = 1,
  reason = excluded.reason;
