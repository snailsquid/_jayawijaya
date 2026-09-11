ALTER TABLE modules ADD COLUMN client_mutation_id TEXT;
CREATE UNIQUE INDEX modules_owner_client_mutation_idx
  ON modules(owner_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;
