import type { Module, Question, QuizMode, QuizState } from '../types/quiz';
import { removeDurableQuizSnapshot, saveDurableQuizSnapshot } from './offline-db';

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
export const activeOwnerKey = 'jayawijaya-active-owner';

export function saveQuizSnapshot(snapshot: QuizSnapshot) {
  localStorage.setItem(snapshotKey(snapshot.ownerId), JSON.stringify(snapshot));
  void saveDurableQuizSnapshot(snapshot);
}

export function loadQuizSnapshot(ownerId: string): QuizSnapshot | null {
  const saved = localStorage.getItem(snapshotKey(ownerId));
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as QuizSnapshot;
    return parsed.ownerId === ownerId && parsed.running.ownerId === ownerId ? parsed : null;
  } catch {
    return null;
  }
}

export function removeQuizSnapshot(ownerId: string) {
  localStorage.removeItem(snapshotKey(ownerId));
  void removeDurableQuizSnapshot(ownerId);
}

export function clearActiveQuizSnapshot() {
  const ownerId = localStorage.getItem(activeOwnerKey);
  if (ownerId) removeQuizSnapshot(ownerId);
  localStorage.removeItem(activeOwnerKey);
}
