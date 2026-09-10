ALTER TABLE modules ADD COLUMN share_code TEXT;

UPDATE modules SET share_code = upper(hex(randomblob(2))) WHERE visibility = 'live';

CREATE UNIQUE INDEX modules_share_code_idx ON modules(share_code) WHERE share_code IS NOT NULL;
