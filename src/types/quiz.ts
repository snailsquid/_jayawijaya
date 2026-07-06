export type QuestionType = 1 | 2;
export type TextboxType = 1 | 2;
export type QuizMode = 'practice' | 'exam';

export interface Question {
  type?: QuestionType;
  question: string;
  answers?: string[];
  correct_answer: number | number[];
  explanation?: string;
  point?: number;
  textbox_type?: TextboxType;
  case_sensitive?: boolean;
  answer?: string;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  categoryId?: string;
  hash?: string;
}

export interface Category {
  id: string;
  name: string;
  moduleIds: string[];
  isExpanded?: boolean;
}

export interface QuizState {
  mode: QuizMode;
  randomize: boolean;
  currentQuestionIndex: number;
  answers: (number | number[] | string | null)[];
  questionStates: QuestionState[];
  flaggedQuestions: number[];
  submitted: boolean;
}

export type QuestionState = 'unseen' | 'unanswered' | 'answered' | 'flagged';

export interface QuizConfig {
  selectedModuleIds: string[];
  mode: QuizMode;
  randomize: boolean;
  questionLimit?: number;
  distributionMode?: 'equal' | 'proportional';
  timerEnabled: boolean;
  timerHours: number;
  timerMinutes: number;
  timerSeconds: number;
}

export interface QuizResult {
  totalScore: number;
  maxScore: number;
  answeredCorrectly: number;
  totalQuestions: number;
  results: QuestionResultItem[];
}

export interface QuestionResultItem {
  questionIndex: number;
  correct: boolean;
  userAnswer: number | number[] | string | null;
  correctAnswer: number | number[] | string;
  point: number;
  maxPoint: number;
}