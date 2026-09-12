import { MODULE_LIMITS, ModuleValidationError } from './module-policy';

export const CATEGORY_LIMITS = { nameLength: MODULE_LIMITS.categoryLength, members: 200, bodyBytes: 64 * 1024 } as const;

export interface CategoryInput { name?: unknown; moduleIds?: unknown; clientMutationId?: unknown; localCategoryId?: unknown }

export function validateCategoryInput(input: CategoryInput) {
  if (typeof input.name !== 'string' || !input.name.trim()) {
    throw new ModuleValidationError('Category name is required.', 422, 'INVALID_CATEGORY');
  }
  if (input.name.length > CATEGORY_LIMITS.nameLength) {
    throw new ModuleValidationError(`Category name cannot exceed ${CATEGORY_LIMITS.nameLength} characters.`, 422, 'INVALID_CATEGORY');
  }
  if (!Array.isArray(input.moduleIds) || input.moduleIds.length === 0 ||
      input.moduleIds.some(id => typeof id !== 'string' || !id)) {
    throw new ModuleValidationError('A live category requires at least one valid module.', 422, 'INVALID_CATEGORY');
  }
  if (input.moduleIds.length > CATEGORY_LIMITS.members) {
    throw new ModuleValidationError(`A live category cannot contain more than ${CATEGORY_LIMITS.members} modules.`, 422, 'INVALID_CATEGORY');
  }
  if (new Set(input.moduleIds).size !== input.moduleIds.length) {
    throw new ModuleValidationError('A module can only appear once in a live category.', 422, 'INVALID_CATEGORY');
  }
  if (input.clientMutationId !== undefined &&
      (typeof input.clientMutationId !== 'string' || input.clientMutationId.length < 1 || input.clientMutationId.length > 100)) {
    throw new ModuleValidationError('Client mutation ID is invalid.', 400, 'INVALID_MUTATION_ID');
  }
  if (input.localCategoryId !== undefined &&
      (typeof input.localCategoryId !== 'string' || !input.localCategoryId.trim() || input.localCategoryId.length > CATEGORY_LIMITS.nameLength)) {
    throw new ModuleValidationError('Local category ID is invalid.', 422, 'INVALID_CATEGORY');
  }
  return {
    name: input.name.trim(),
    moduleIds: input.moduleIds as string[],
    clientMutationId: input.clientMutationId as string | undefined,
    localCategoryId: typeof input.localCategoryId === 'string' ? input.localCategoryId.trim() : undefined,
  };
}
