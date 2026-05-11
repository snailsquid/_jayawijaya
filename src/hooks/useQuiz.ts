import { useCallback } from 'react';
import type { 
  Module, 
  Question, 
  QuizMode, 
  QuizState, 
  QuestionState,
  QuestionResultItem,
  QuizResult
} from '../types/quiz';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type DistributionMode = 'equal' | 'proportional';

interface ModuleAllocation {
  module: Module;
  allocated: number;
  originalAllocation: number;
}

export function calculateAllocation(
  modules: Module[],
  limit: number,
  mode: DistributionMode
): { moduleId: string; allocated: number; originalAllocation: number }[] {
  const availableModules = modules.filter((module) => module.questions.length > 0);
  const totalQuestions = availableModules.reduce(
    (total, module) => total + module.questions.length,
    0
  );
  const cappedLimit = Math.min(Math.max(Math.floor(limit), 0), totalQuestions);

  if (availableModules.length === 0 || cappedLimit === 0) {
    return availableModules.map((module) => ({ moduleId: module.id, allocated: 0, originalAllocation: 0 }));
  }

  const allocations = mode === 'equal'
    ? calculateEqualAllocation(availableModules, cappedLimit)
    : calculateProportionalAllocation(availableModules, cappedLimit, totalQuestions);

  fillRemainingAllocation(allocations, cappedLimit);

  return allocations.map(({ module, allocated, originalAllocation }) => ({
    moduleId: module.id,
    allocated,
    originalAllocation,
  }));
}

function calculateEqualAllocation(modules: Module[], limit: number): ModuleAllocation[] {
  const shuffledModules = shuffleArray(modules);
  const base = Math.floor(limit / shuffledModules.length);
  const remainder = limit % shuffledModules.length;

  return shuffledModules.map((module, index) => {
    const originalAlloc = base + (index < remainder ? 1 : 0);
    return {
      module,
      allocated: Math.min(originalAlloc, module.questions.length),
      originalAllocation: originalAlloc,
    };
  });
}

function calculateProportionalAllocation(
  modules: Module[],
  limit: number,
  totalQuestions: number
): ModuleAllocation[] {
  const allocations = modules.map((module) => {
    const exactAllocation = (limit * module.questions.length) / totalQuestions;
    const allocated = Math.floor(exactAllocation);

    return {
      module,
      allocated,
      fractional: exactAllocation - allocated,
      originalAllocation: allocated,
    };
  });
  const remainder = limit - allocations.reduce((total, item) => total + item.allocated, 0);

  [...allocations]
    .sort((a, b) => b.fractional - a.fractional)
    .slice(0, remainder)
    .forEach((item) => {
      item.allocated = Math.min(item.allocated + 1, item.module.questions.length);
      item.originalAllocation = item.originalAllocation + 1;
    });

  return allocations.map(({ module, allocated, originalAllocation }) => ({
    module,
    allocated: Math.min(allocated, module.questions.length),
    originalAllocation,
  }));
}

function fillRemainingAllocation(allocations: ModuleAllocation[], limit: number): void {
  let assigned = allocations.reduce((total, item) => total + item.allocated, 0);

  while (assigned < limit) {
    let addedThisPass = false;

    for (const allocation of allocations) {
      if (assigned >= limit) break;
      if (allocation.allocated >= allocation.module.questions.length) continue;

      allocation.allocated += 1;
      assigned += 1;
      addedThisPass = true;
    }

    if (!addedThisPass) break;
  }
}

function sampleQuestionsByAllocation(
  modules: Module[],
  allocations: { moduleId: string; allocated: number }[]
): Question[] {
  return allocations.flatMap(({ moduleId, allocated }) => {
    const module = modules.find((item) => item.id === moduleId);
    if (!module || allocated <= 0) return [];

    return shuffleArray(module.questions).slice(0, allocated);
  });
}

export function useQuiz() {
  const initializeQuiz = useCallback((
    modules: Module[],
    mode: QuizMode,
    randomize: boolean,
    questionLimit?: number,
    distributionMode: DistributionMode = 'equal'
  ): { questions: Question[]; state: QuizState } => {
    let questions = modules.flatMap((m) => m.questions);
    
    if (randomize) {
      if (questionLimit === undefined) {
        questions = shuffleArray(questions);
      } else {
        const allocations = calculateAllocation(modules, questionLimit, distributionMode);
        questions = shuffleArray(sampleQuestionsByAllocation(modules, allocations));
      }
    }

    const state: QuizState = {
      mode,
      randomize,
      currentQuestionIndex: 0,
      answers: new Array(questions.length).fill(null),
      questionStates: new Array(questions.length).fill('unseen'),
      flaggedQuestions: [],
      submitted: false,
    };

    return { questions, state };
  }, []);

  const checkAnswer = useCallback((
    question: Question,
    answer: number | number[] | string | null
  ): boolean => {
    if (answer === null) return false;

    if (question.type === 2 && question.answer) {
      const userAnswer = String(answer).trim();
      const correctAnswer = question.case_sensitive
        ? String(question.answer).trim()
        : String(question.answer).trim().toLowerCase();
      if (!question.case_sensitive) {
        return userAnswer.toLowerCase() === correctAnswer;
      }
      return userAnswer === correctAnswer;
    }

    if (Array.isArray(question.correct_answer)) {
      if (Array.isArray(answer)) {
        if (answer.length !== question.correct_answer.length) return false;
        const sortedAnswer = [...answer].sort();
        const sortedCorrect = [...question.correct_answer].sort();
        return sortedAnswer.every((a, i) => a === sortedCorrect[i]);
      }
      return false;
    }

    return answer === question.correct_answer;
  }, []);

  const calculateResults = useCallback((
    questions: Question[],
    answers: (number | number[] | string | null)[]
  ): QuizResult => {
    const results: QuestionResultItem[] = [];
    let totalScore = 0;
    let maxScore = 0;
    let answeredCorrectly = 0;

    questions.forEach((q, index) => {
      const userAnswer = answers[index];
      const correct = checkAnswer(q, userAnswer);
      const point = correct ? (q.point ?? 1) : 0;
      const maxPoint = q.point ?? 1;

      totalScore += point;
      maxScore += maxPoint;
      if (correct) answeredCorrectly++;

      results.push({
        questionIndex: index,
        correct,
        userAnswer,
        correctAnswer: q.correct_answer,
        point,
        maxPoint,
      });
    });

    return {
      totalScore,
      maxScore,
      answeredCorrectly,
      totalQuestions: questions.length,
      results,
    };
  }, [checkAnswer]);

  const getQuestionState = useCallback((
    state: QuizState,
    index: number,
    mode: QuizMode = 'practice'
  ): QuestionState => {
    if (state.flaggedQuestions.includes(index)) return 'flagged';
    if (state.questionStates[index] === 'answered') return 'answered';
    if (mode === 'exam' && state.answers[index] !== null) return 'answered';
    if (state.questionStates[index] === 'unseen') return 'unseen';
    return 'unanswered';
  }, []);

  return {
    initializeQuiz,
    checkAnswer,
    calculateResults,
    getQuestionState,
    shuffleArray,
  };
}
