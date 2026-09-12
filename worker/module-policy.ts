import { ACCOUNT_MODULE_LIMITS, accountLimitsFor } from '../src/lib/module-limits';
import { MODULE_CONTENT_LIMITS, ModuleContentValidationError, validateModuleContent } from '../src/lib/module-validation';

export const MODULE_LIMITS = {
  ...ACCOUNT_MODULE_LIMITS,
  ...MODULE_CONTENT_LIMITS,
} as const;

export type Tier = keyof Pick<typeof MODULE_LIMITS, 'free' | 'pro'>;

export function limitsFor(tier?: string) {
  return accountLimitsFor(tier);
}

export interface ModuleInput {
  id?: unknown;
  ownerId?: unknown;
  owner_id?: unknown;
  title?: unknown;
  description?: unknown;
  categoryId?: unknown;
  category_id?: unknown;
  hash?: unknown;
  contentHash?: unknown;
  questions?: unknown;
}

export class ModuleValidationError extends Error {
  constructor(message: string, public readonly status = 422, public readonly code = 'INVALID_MODULE') {
    super(message);
  }
}

export function validateModuleInput(input: ModuleInput) {
  if (input.ownerId !== undefined || input.owner_id !== undefined) {
    throw new ModuleValidationError('ownerId is assigned by the server.', 400, 'OWNER_NOT_ALLOWED');
  }
  try { return validateModuleContent(input); }
  catch (reason) {
    if (reason instanceof ModuleContentValidationError) throw new ModuleValidationError(reason.message, reason.message.includes('2 MB') ? 413 : 422, reason.message.includes('2 MB') ? 'MODULE_TOO_LARGE' : 'INVALID_MODULE');
    throw reason;
  }
}

export function assertWithinQuota(
  tier: string | undefined,
  usage: { moduleCount: number; usedBytes: number },
  incomingBytes: number,
  replacingBytes = 0,
) {
  const limits = limitsFor(tier);
  const isCreate = replacingBytes === 0;
  if (isCreate && usage.moduleCount >= limits.modules) {
    throw new ModuleValidationError('Module count quota reached.', 409, 'MODULE_QUOTA_REACHED');
  }
  if (usage.usedBytes - replacingBytes + incomingBytes > limits.storageBytes) {
    throw new ModuleValidationError('Storage quota reached.', 409, 'STORAGE_QUOTA_REACHED');
  }
}
