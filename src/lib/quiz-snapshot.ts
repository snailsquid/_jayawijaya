import type { Module, Question, QuizMode, QuizState } from '../types/quiz';
import { loadDurableQuizSnapshot, removeDurableQuizSnapshot, saveDurableQuizSnapshot } from './offline-db';

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

export async function saveQuizSnapshot(snapshot: QuizSnapshot) {
  const durableWrite = saveDurableQuizSnapshot(snapshot).then(() => true, () => false);
  let localWrite = false;
  try {
    localStorage.setItem(snapshotKey(snapshot.ownerId), JSON.stringify(snapshot));
    localWrite = true;
  } catch { /* IndexedDB may still preserve a snapshot that exceeds this store's quota. */ }
  const durableWriteSucceeded = await durableWrite;
  if (!durableWriteSucceeded && !localWrite) throw new Error('Unable to save the quiz snapshot.');
}

function validSnapshot(snapshot: QuizSnapshot | undefined | null, ownerId: string): snapshot is QuizSnapshot {
  return snapshot?.ownerId === ownerId && snapshot.running.ownerId === ownerId;
}

export async function loadQuizSnapshot(ownerId: string): Promise<QuizSnapshot | null> {
  const durable = await loadDurableQuizSnapshot(ownerId).catch(() => undefined);
  if (validSnapshot(durable, ownerId)) return durable;
  const saved = localStorage.getItem(snapshotKey(ownerId));
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as QuizSnapshot;
    return validSnapshot(parsed, ownerId) ? parsed : null;
  } catch {
    return null;
  }
}

export async function removeQuizSnapshot(ownerId: string) {
  localStorage.removeItem(snapshotKey(ownerId));
  await removeDurableQuizSnapshot(ownerId);
}

export async function clearActiveQuizSnapshot() {
  const ownerId = localStorage.getItem(activeOwnerKey);
  if (ownerId) await removeQuizSnapshot(ownerId);
  localStorage.removeItem(activeOwnerKey);
}
