export const MODULE_CONTENT_LIMITS = {
  uploadBytes: 2 * 1024 * 1024,
  questionsPerModule: 500,
  titleLength: 200,
  categoryLength: 100,
  questionLength: 10_000,
  answersPerQuestion: 20,
  answerLength: 2_000,
  explanationLength: 20_000,
} as const;

interface QuestionInput {
  type?: unknown; question?: unknown; answers?: unknown; correct_answer?: unknown;
  explanation?: unknown; point?: unknown; textbox_type?: unknown;
  case_sensitive?: unknown; answer?: unknown;
}

export interface ModuleContentInput {
  title?: unknown; description?: unknown; categoryId?: unknown; category_id?: unknown;
  hash?: unknown; contentHash?: unknown; questions?: unknown;
}

export class ModuleContentValidationError extends Error {}

function textLength(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}

export function validateModuleContent(input: ModuleContentInput) {
  if (typeof input.title !== 'string' || input.title.trim().length === 0) throw new ModuleContentValidationError('Module title is required.');
  if (input.title.length > MODULE_CONTENT_LIMITS.titleLength) throw new ModuleContentValidationError(`Module title cannot exceed ${MODULE_CONTENT_LIMITS.titleLength} characters.`);
  const category = input.categoryId ?? input.category_id;
  if (category !== undefined && category !== null && typeof category !== 'string') throw new ModuleContentValidationError('Category must be text.');
  if (textLength(category) > MODULE_CONTENT_LIMITS.categoryLength) throw new ModuleContentValidationError(`Category cannot exceed ${MODULE_CONTENT_LIMITS.categoryLength} characters.`);
  if (!Array.isArray(input.questions) || input.questions.length === 0) throw new ModuleContentValidationError('A module must contain at least one question.');
  if (input.questions.length > MODULE_CONTENT_LIMITS.questionsPerModule) throw new ModuleContentValidationError(`A module cannot contain more than ${MODULE_CONTENT_LIMITS.questionsPerModule} questions.`);

  input.questions.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new ModuleContentValidationError(`Question ${index + 1} is invalid.`);
    const question = raw as QuestionInput;
    if (typeof question.question !== 'string' || question.question.trim().length === 0) throw new ModuleContentValidationError(`Question ${index + 1} requires question text.`);
    if (question.question.length > MODULE_CONTENT_LIMITS.questionLength) throw new ModuleContentValidationError(`Question ${index + 1} is too long.`);
    if (question.type !== undefined && question.type !== 1 && question.type !== 2) throw new ModuleContentValidationError(`Question ${index + 1} has an invalid type.`);
    if (question.explanation !== undefined && typeof question.explanation !== 'string') throw new ModuleContentValidationError(`Question ${index + 1} has an invalid explanation.`);
    if (textLength(question.explanation) > MODULE_CONTENT_LIMITS.explanationLength) throw new ModuleContentValidationError(`Question ${index + 1} explanation is too long.`);
    if (question.point !== undefined && (typeof question.point !== 'number' || !Number.isFinite(question.point) || question.point <= 0)) throw new ModuleContentValidationError(`Question ${index + 1} has an invalid point value.`);
    if (question.textbox_type !== undefined && question.textbox_type !== 1 && question.textbox_type !== 2) throw new ModuleContentValidationError(`Question ${index + 1} has an invalid textbox type.`);
    if (question.case_sensitive !== undefined && typeof question.case_sensitive !== 'boolean') throw new ModuleContentValidationError(`Question ${index + 1} has an invalid case-sensitive setting.`);

    if (question.type === 2) {
      if (typeof question.answer !== 'string' || question.answer.trim().length === 0 || question.answer.length > MODULE_CONTENT_LIMITS.answerLength) throw new ModuleContentValidationError(`Question ${index + 1} requires a valid text answer.`);
      if (question.answers !== undefined || question.correct_answer !== undefined) throw new ModuleContentValidationError(`Question ${index + 1} cannot mix text and choice answers.`);
    } else {
      if (question.answer !== undefined || question.textbox_type !== undefined || question.case_sensitive !== undefined) throw new ModuleContentValidationError(`Question ${index + 1} must use type 2 for text answers.`);
      if (!Array.isArray(question.answers)) throw new ModuleContentValidationError(`Question ${index + 1} requires answer choices.`);
      if (question.answers.length > MODULE_CONTENT_LIMITS.answersPerQuestion) throw new ModuleContentValidationError(`Question ${index + 1} has too many answers.`);
      if (question.answers.some(answer => typeof answer !== 'string' || answer.trim().length === 0 || answer.length > MODULE_CONTENT_LIMITS.answerLength)) throw new ModuleContentValidationError(`Question ${index + 1} contains an invalid answer.`);
      if (question.answers.length < 2) throw new ModuleContentValidationError(`Question ${index + 1} requires between 2 and ${MODULE_CONTENT_LIMITS.answersPerQuestion} answers.`);
      const correctAnswers = Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer];
      if (correctAnswers.length === 0 || correctAnswers.some(answer => !Number.isInteger(answer) || (answer as number) < 1 || (answer as number) > (question.answers as unknown[]).length) || new Set(correctAnswers).size !== correctAnswers.length) throw new ModuleContentValidationError(`Question ${index + 1} has an invalid correct answer.`);
    }
  });

  const questionsJson = JSON.stringify(input.questions);
  const byteSize = new TextEncoder().encode(questionsJson).byteLength;
  if (byteSize > MODULE_CONTENT_LIMITS.uploadBytes) throw new ModuleContentValidationError('Module exceeds the 2 MB upload limit.');
  return { title: input.title.trim(), description: typeof input.description === 'string' ? input.description : null, categoryId: typeof category === 'string' ? category : null, contentHash: typeof input.hash === 'string' ? input.hash : typeof input.contentHash === 'string' ? input.contentHash : '', questionsJson, byteSize, questionCount: input.questions.length };
}
