import { openDB, type DBSchema } from 'idb';
import type { QuizSnapshot } from './quiz-snapshot';
import type { OfflineWorkspace, WorkspaceIdentity } from '../types/offline';

const FREE_LIMITS = { modules: 100, storageBytes: 25 * 1024 * 1024, liveModules: false };
export const guestWorkspace: WorkspaceIdentity = { id: 'guest', kind: 'guest', name: 'Guest' };

interface OfflineSchema extends DBSchema {
  workspaces: { key: string; value: OfflineWorkspace };
  snapshots: { key: string; value: QuizSnapshot };
}

const database = () => openDB<OfflineSchema>('jayawijaya-offline', 1, {
  upgrade(db) {
    db.createObjectStore('workspaces', { keyPath: 'id' });
    db.createObjectStore('snapshots', { keyPath: 'ownerId' });
  },
});

export function emptyWorkspace(id: string): OfflineWorkspace {
  return { id, modules: [], usage: { moduleCount: 0, usedBytes: 0 }, limits: FREE_LIMITS, queue: [], conflicts: [] };
}

export async function readWorkspace(id: string) {
  return (await database()).get('workspaces', id).then(value => value ?? emptyWorkspace(id));
}

export async function writeWorkspace(workspace: OfflineWorkspace) {
  await (await database()).put('workspaces', workspace);
  return workspace;
}

export async function updateWorkspace(id: string, update: (current: OfflineWorkspace) => OfflineWorkspace) {
  const db = await database();
  const tx = db.transaction('workspaces', 'readwrite');
  const current = await tx.store.get(id) ?? emptyWorkspace(id);
  const next = update(current);
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function removeWorkspace(id: string) {
  await (await database()).delete('workspaces', id);
}

export async function saveDurableQuizSnapshot(snapshot: QuizSnapshot) {
  await (await database()).put('snapshots', snapshot);
}

export async function loadDurableQuizSnapshot(ownerId: string) {
  return (await database()).get('snapshots', ownerId);
}

export async function removeDurableQuizSnapshot(ownerId: string) {
  await (await database()).delete('snapshots', ownerId);
}
