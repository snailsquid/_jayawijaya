import type { Module, Question, QuizMode, QuizState } from '../types/quiz';

export interface RunningState {
  ownerId: string;
  modules: Module[];
  mode: QuizMode;
  randomize: boolean;
  questionLimit?: number;
  distributionMode?: 'equal' | 'proportional';
  timerDuration?: number;
  timerStart?: number;
}

export interface QuizSnapshot {
  ownerId: string;
  running: RunningState;
  quiz: { questions: Question[]; state: QuizState };
}

export const snapshotKey = (ownerId: string) => `jayawijaya-running:${ownerId}`;

export function saveQuizSnapshot(snapshot: QuizSnapshot) {
  sessionStorage.setItem(snapshotKey(snapshot.ownerId), JSON.stringify(snapshot));
}

export function loadQuizSnapshot(ownerId: string): QuizSnapshot | null {
  const saved = sessionStorage.getItem(snapshotKey(ownerId));
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as QuizSnapshot;
    return parsed.ownerId === ownerId && parsed.running.ownerId === ownerId ? parsed : null;
  } catch {
    return null;
  }
}

export function removeQuizSnapshot(ownerId: string) {
  sessionStorage.removeItem(snapshotKey(ownerId));
}

