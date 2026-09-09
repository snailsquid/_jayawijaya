export const MODULE_LIMITS = {
  free: {
    modules: 100,
    storageBytes: 25 * 1024 * 1024,
  },
  pro: {
    modules: 1_000,
    storageBytes: 500 * 1024 * 1024,
  },
  uploadBytes: 2 * 1024 * 1024,
  questionsPerModule: 500,
  titleLength: 200,
  categoryLength: 100,
  questionLength: 10_000,
  answersPerQuestion: 20,
  answerLength: 2_000,
  explanationLength: 20_000,
} as const;

export type Tier = keyof Pick<typeof MODULE_LIMITS, 'free' | 'pro'>;

interface QuestionInput {
  type?: unknown;
  question?: unknown;
  answers?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
  point?: unknown;
  textbox_type?: unknown;
  case_sensitive?: unknown;
  answer?: unknown;
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

function textLength(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}

export function validateModuleInput(input: ModuleInput) {
  if (input.ownerId !== undefined || input.owner_id !== undefined) {
    throw new ModuleValidationError('ownerId is assigned by the server.', 400, 'OWNER_NOT_ALLOWED');
  }
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    throw new ModuleValidationError('Module title is required.');
  }
  if (input.title.length > MODULE_LIMITS.titleLength) {
    throw new ModuleValidationError(`Module title cannot exceed ${MODULE_LIMITS.titleLength} characters.`);
  }
  const category = input.categoryId ?? input.category_id;
  if (category !== undefined && category !== null && typeof category !== 'string') {
    throw new ModuleValidationError('Category must be text.');
  }
  if (textLength(category) > MODULE_LIMITS.categoryLength) {
    throw new ModuleValidationError(`Category cannot exceed ${MODULE_LIMITS.categoryLength} characters.`);
  }
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new ModuleValidationError('A module must contain at least one question.');
  }
  if (input.questions.length > MODULE_LIMITS.questionsPerModule) {
    throw new ModuleValidationError(`A module cannot contain more than ${MODULE_LIMITS.questionsPerModule} questions.`);
  }

  input.questions.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new ModuleValidationError(`Question ${index + 1} is invalid.`);
    }
    const question = raw as QuestionInput;
    if (typeof question.question !== 'string' || question.question.trim().length === 0) {
      throw new ModuleValidationError(`Question ${index + 1} requires question text.`);
    }
    if (question.question.length > MODULE_LIMITS.questionLength) {
      throw new ModuleValidationError(`Question ${index + 1} is too long.`);
    }
    if (question.type !== undefined && question.type !== 1 && question.type !== 2) {
      throw new ModuleValidationError(`Question ${index + 1} has an invalid type.`);
    }
    if (question.explanation !== undefined && typeof question.explanation !== 'string') {
      throw new ModuleValidationError(`Question ${index + 1} has an invalid explanation.`);
    }
    if (textLength(question.explanation) > MODULE_LIMITS.explanationLength) {
      throw new ModuleValidationError(`Question ${index + 1} explanation is too long.`);
    }
    if (question.point !== undefined && (typeof question.point !== 'number' || !Number.isFinite(question.point) || question.point <= 0)) {
      throw new ModuleValidationError(`Question ${index + 1} has an invalid point value.`);
    }
    if (question.textbox_type !== undefined && question.textbox_type !== 1 && question.textbox_type !== 2) {
      throw new ModuleValidationError(`Question ${index + 1} has an invalid textbox type.`);
    }
    if (question.case_sensitive !== undefined && typeof question.case_sensitive !== 'boolean') {
      throw new ModuleValidationError(`Question ${index + 1} has an invalid case-sensitive setting.`);
    }

    if (question.type === 2) {
      if (typeof question.answer !== 'string' || question.answer.trim().length === 0 || question.answer.length > MODULE_LIMITS.answerLength) {
        throw new ModuleValidationError(`Question ${index + 1} requires a valid text answer.`);
      }
      if (question.answers !== undefined || question.correct_answer !== undefined) {
        throw new ModuleValidationError(`Question ${index + 1} cannot mix text and choice answers.`);
      }
    } else {
      if (question.answer !== undefined || question.textbox_type !== undefined || question.case_sensitive !== undefined) {
        throw new ModuleValidationError(`Question ${index + 1} must use type 2 for text answers.`);
      }
      if (!Array.isArray(question.answers)) {
        throw new ModuleValidationError(`Question ${index + 1} requires answer choices.`);
      }
      if (question.answers.length > MODULE_LIMITS.answersPerQuestion) {
        throw new ModuleValidationError(`Question ${index + 1} has too many answers.`);
      }
      for (const answer of question.answers) {
        if (typeof answer !== 'string' || answer.trim().length === 0 || answer.length > MODULE_LIMITS.answerLength) {
          throw new ModuleValidationError(`Question ${index + 1} contains an invalid answer.`);
        }
      }
      if (question.answers.length < 2) {
        throw new ModuleValidationError(`Question ${index + 1} requires between 2 and ${MODULE_LIMITS.answersPerQuestion} answers.`);
      }
      const correctAnswers = Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer];
      if (correctAnswers.length === 0 || correctAnswers.some(answer =>
        !Number.isInteger(answer) || (answer as number) < 1 || (answer as number) > question.answers!.length
      ) || new Set(correctAnswers).size !== correctAnswers.length) {
        throw new ModuleValidationError(`Question ${index + 1} has an invalid correct answer.`);
      }
    }
  });

  const questionsJson = JSON.stringify(input.questions);
  const byteSize = new TextEncoder().encode(questionsJson).byteLength;
  if (byteSize > MODULE_LIMITS.uploadBytes) {
    throw new ModuleValidationError('Module exceeds the 2 MB upload limit.', 413, 'MODULE_TOO_LARGE');
  }

  return {
    title: input.title.trim(),
    description: typeof input.description === 'string' ? input.description : null,
    categoryId: typeof category === 'string' ? category : null,
    contentHash: typeof input.hash === 'string' ? input.hash : typeof input.contentHash === 'string' ? input.contentHash : '',
    questionsJson,
    byteSize,
    questionCount: input.questions.length,
  };
}

export function assertWithinQuota(
  tier: string | undefined,
  usage: { moduleCount: number; usedBytes: number },
  incomingBytes: number,
  replacingBytes = 0,
) {
  const normalizedTier: Tier = tier === 'pro' ? 'pro' : 'free';
  const limits = MODULE_LIMITS[normalizedTier];
  const isCreate = replacingBytes === 0;
  if (isCreate && usage.moduleCount >= limits.modules) {
    throw new ModuleValidationError('Module count quota reached.', 409, 'MODULE_QUOTA_REACHED');
  }
  if (usage.usedBytes - replacingBytes + incomingBytes > limits.storageBytes) {
    throw new ModuleValidationError('Storage quota reached.', 409, 'STORAGE_QUOTA_REACHED');
  }
}
