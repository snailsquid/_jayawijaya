import { describe, expect, it } from 'vitest';
import { assertWithinQuota, MODULE_LIMITS, ModuleValidationError, validateModuleInput } from '../../worker/module-policy';

const validModule = {
  title: 'Liver quiz',
  hash: 'abc',
  questions: [{ question: 'Question?', answers: ['A', 'B'], correct_answer: 1 }],
};

describe('module policy', () => {
  it('normalizes a valid module and calculates storage', () => {
    const result = validateModuleInput(validModule);
    expect(result.title).toBe('Liver quiz');
    expect(result.questionCount).toBe(1);
    expect(result.byteSize).toBeGreaterThan(0);
  });

  it('rejects browser-selected ownership', () => {
    expect(() => validateModuleInput({ ...validModule, ownerId: 'bob' })).toThrowError(ModuleValidationError);
  });

  it.each([
    [{ ...validModule, title: '' }, 'title'],
    [{ ...validModule, title: 'x'.repeat(MODULE_LIMITS.titleLength + 1) }, 'title'],
    [{ ...validModule, questions: [] }, 'question'],
    [{ ...validModule, categoryId: 'x'.repeat(MODULE_LIMITS.categoryLength + 1) }, 'Category'],
    [{ ...validModule, categoryId: 7 }, 'Category'],
    [{ ...validModule, questions: Array(MODULE_LIMITS.questionsPerModule + 1).fill({ question: 'x' }) }, 'more than'],
    [{ ...validModule, questions: [{ question: 'x'.repeat(MODULE_LIMITS.questionLength + 1) }] }, 'too long'],
    [{ ...validModule, questions: [{ question: 'x', answers: Array(21).fill('a') }] }, 'too many answers'],
    [{ ...validModule, questions: [null] }, 'invalid'],
    [{ ...validModule, questions: [{ question: '' }] }, 'requires question'],
    [{ ...validModule, questions: [{ question: 'x', explanation: 'x'.repeat(MODULE_LIMITS.explanationLength + 1) }] }, 'explanation'],
    [{ ...validModule, questions: [{ question: 'x', answers: [1] }] }, 'invalid answer'],
  ])('rejects invalid data', (input, message) => {
    expect(() => validateModuleInput(input)).toThrow(message);
  });

  it('enforces free count and storage quotas at their boundaries', () => {
    expect(() => assertWithinQuota('free', { moduleCount: 99, usedBytes: 0 }, 1)).not.toThrow();
    expect(() => assertWithinQuota('free', { moduleCount: 100, usedBytes: 0 }, 1)).toThrow('Module count quota');
    expect(() => assertWithinQuota('free', { moduleCount: 1, usedBytes: MODULE_LIMITS.free.storageBytes }, 1)).toThrow('Storage quota');
  });

  it('allows updates to replace their previous bytes', () => {
    expect(() => assertWithinQuota('free', { moduleCount: 100, usedBytes: 100 }, 100, 100)).not.toThrow();
  });

  it('normalizes optional fields and unknown tiers', () => {
    const result = validateModuleInput({ title: validModule.title, questions: validModule.questions, description: 3, category_id: 'GI', contentHash: 'other' });
    expect(result).toMatchObject({ description: null, categoryId: 'GI', contentHash: 'other' });
    expect(() => assertWithinQuota('unknown', { moduleCount: 0, usedBytes: 0 }, 1)).not.toThrow();
    expect(validateModuleInput({ ...validModule, description: 'Description', categoryId: null })).toMatchObject({ description: 'Description', categoryId: null });
    expect(validateModuleInput({ title: 'No hash', questions: validModule.questions }).contentHash).toBe('');
    expect(() => assertWithinQuota('pro', { moduleCount: 100, usedBytes: 0 }, 1)).not.toThrow();
  });

  it('rejects modules whose serialized questions exceed 2 MB', () => {
    const oversized = Array.from({ length: 500 }, (_, index) => ({
      question: `${index}${'q'.repeat(5_000)}`,
      explanation: 'e'.repeat(5_000),
      answers: ['A', 'B'],
      correct_answer: 1,
    }));
    expect(() => validateModuleInput({ title: 'Large', questions: oversized })).toThrow('2 MB');
  });

  it.each([
    [{ question: 'Q?', type: 3, answers: ['A', 'B'], correct_answer: 1 }, 'invalid type'],
    [{ question: 'Q?', answers: ['A'], correct_answer: 1 }, 'between 2'],
    [{ question: 'Q?', answers: ['A', 'B'] }, 'correct answer'],
    [{ question: 'Q?', answers: ['A', 'B'], correct_answer: 3 }, 'correct answer'],
    [{ question: 'Q?', answers: ['A', 'B'], correct_answer: [1, 1] }, 'correct answer'],
    [{ question: 'Q?', type: 2, answer: '' }, 'text answer'],
    [{ question: 'Q?', type: 2, answer: 'A', correct_answer: 1 }, 'mix'],
    [{ question: 'Q?', answer: 'A' }, 'type 2'],
    [{ question: 'Q?', answers: ['A', 'B'], correct_answer: 1, point: 0 }, 'point'],
  ])('rejects unusable question schemas', (question, message) => {
    expect(() => validateModuleInput({ ...validModule, questions: [question] })).toThrow(message);
  });
});
