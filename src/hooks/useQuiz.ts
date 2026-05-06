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

export function useQuiz() {
  const initializeQuiz = useCallback((
    modules: Module[],
    mode: QuizMode,
    randomize: boolean
  ): { questions: Question[]; state: QuizState } => {
    let questions = modules.flatMap((m) => m.questions);
    
    if (randomize) {
      questions = shuffleArray(questions);
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