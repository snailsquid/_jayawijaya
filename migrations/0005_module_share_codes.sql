ALTER TABLE modules ADD COLUMN share_code TEXT;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY id) - 1 AS code_number
  FROM modules WHERE visibility = 'live'
)
UPDATE modules SET share_code = (
  SELECT substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (code_number / 32768) % 32 + 1, 1)
    || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (code_number / 1024) % 32 + 1, 1)
    || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (code_number / 32) % 32 + 1, 1)
    || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code_number % 32 + 1, 1)
  FROM ranked WHERE ranked.id = modules.id
) WHERE visibility = 'live';

CREATE UNIQUE INDEX modules_share_code_idx ON modules(share_code) WHERE share_code IS NOT NULL;
