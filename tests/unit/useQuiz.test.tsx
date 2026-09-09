import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calculateAllocation, useQuiz } from '../../src/hooks/useQuiz';
import type { Module, QuizState } from '../../src/types/quiz';

const modules: Module[] = [
  { id: 'a', title: 'A', questions: Array.from({ length: 2 }, (_, i) => ({ question: `A${i}`, correct_answer: 1 })) },
  { id: 'b', title: 'B', questions: Array.from({ length: 6 }, (_, i) => ({ question: `B${i}`, correct_answer: 1 })) },
];

describe('quiz logic', () => {
  it('allocates equal and proportional limits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(calculateAllocation(modules, 4, 'equal').reduce((sum, x) => sum + x.allocated, 0)).toBe(4);
    expect(calculateAllocation(modules, 4, 'proportional').map(x => x.allocated)).toEqual([1, 3]);
    vi.restoreAllMocks();
  });

  it('handles allocation boundaries and empty modules', () => {
    expect(calculateAllocation([], 4, 'equal')).toEqual([]);
    expect(calculateAllocation(modules, -1, 'equal').every(x => x.allocated === 0)).toBe(true);
    expect(calculateAllocation(modules, 100, 'equal').reduce((sum, x) => sum + x.allocated, 0)).toBe(8);
    const capped = calculateAllocation([
      { id: 'tiny', title: 'Tiny', questions: [{ question: 'x', correct_answer: 1 }] },
      { id: 'large', title: 'Large', questions: Array.from({ length: 9 }, (_, i) => ({ question: `${i}`, correct_answer: 1 })) },
    ], 8, 'equal');
    expect(capped.reduce((sum, x) => sum + x.allocated, 0)).toBe(8);
  });

  it('checks single, multiple, and text answers', () => {
    const { result } = renderHook(() => useQuiz());
    expect(result.current.checkAnswer({ question: 'x', correct_answer: 2 }, 2)).toBe(true);
    expect(result.current.checkAnswer({ question: 'x', correct_answer: [1, 3] }, [3, 1])).toBe(true);
    expect(result.current.checkAnswer({ type: 2, question: 'x', correct_answer: 0, answer: 'Liver' }, ' liver ')).toBe(true);
    expect(result.current.checkAnswer({ type: 2, question: 'x', correct_answer: 0, answer: 'Liver', case_sensitive: true }, 'liver')).toBe(false);
    expect(result.current.checkAnswer({ question: 'x', correct_answer: 1 }, null)).toBe(false);
    expect(result.current.checkAnswer({ question: 'x', correct_answer: [1, 3] }, [1])).toBe(false);
    expect(result.current.checkAnswer({ question: 'x', correct_answer: [1, 3] }, 1)).toBe(false);
  });

  it('calculates weighted results and initializes state', () => {
    const { result } = renderHook(() => useQuiz());
    const initialized = result.current.initializeQuiz(modules, 'exam', false);
    expect(initialized.questions).toHaveLength(8);
    const scored = result.current.calculateResults([{ question: 'x', correct_answer: 1, point: 3 }], [1]);
    expect(scored).toMatchObject({ totalScore: 3, maxScore: 3, answeredCorrectly: 1 });
    const missed = result.current.calculateResults([{ question: 'x', correct_answer: 1 }], [2]);
    expect(missed.totalScore).toBe(0);
  });

  it('reports question states with flag and exam precedence', () => {
    const { result } = renderHook(() => useQuiz());
    const state: QuizState = {
      mode: 'exam' as const, randomize: false, currentQuestionIndex: 0,
      answers: [1, 1, null, null],
      questionStates: ['unseen', 'answered', 'unseen', 'unanswered'],
      flaggedQuestions: [0], submitted: false,
    };
    expect(result.current.getQuestionState(state, 0, 'exam')).toBe('flagged');
    expect(result.current.getQuestionState(state, 1, 'exam')).toBe('answered');
    expect(result.current.getQuestionState(state, 2, 'exam')).toBe('unseen');
    expect(result.current.getQuestionState(state, 3, 'practice')).toBe('unanswered');
  });
});
