import { openDB, type DBSchema } from 'idb';
import type { QuizSnapshot } from './quiz-snapshot';
import type { OfflineWorkspace, WorkspaceIdentity } from '../types/offline';
import { ACCOUNT_MODULE_LIMITS, GUEST_MODULE_LIMITS } from './module-limits';

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
  const limits = id === guestWorkspace.id ? GUEST_MODULE_LIMITS : ACCOUNT_MODULE_LIMITS.free;
  return { id, modules: [], usage: { moduleCount: 0, usedBytes: 0 }, limits, queue: [], conflicts: [] };
}

function normalizeWorkspace(workspace: OfflineWorkspace): OfflineWorkspace {
  // Account workspaces created before quota alignment used the guest's 100-module limit.
  if (workspace.id !== guestWorkspace.id && workspace.limits.modules === GUEST_MODULE_LIMITS.modules) {
    return { ...workspace, limits: ACCOUNT_MODULE_LIMITS.free };
  }
  return workspace;
}

export async function readWorkspace(id: string) {
  return (await database()).get('workspaces', id).then(value => value ? normalizeWorkspace(value) : emptyWorkspace(id));
}

export async function writeWorkspace(workspace: OfflineWorkspace) {
  await (await database()).put('workspaces', workspace);
  return workspace;
}

export async function updateWorkspace(id: string, update: (current: OfflineWorkspace) => OfflineWorkspace) {
  const db = await database();
  const tx = db.transaction('workspaces', 'readwrite');
  const stored = await tx.store.get(id);
  const current = stored ? normalizeWorkspace(stored) : emptyWorkspace(id);
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
