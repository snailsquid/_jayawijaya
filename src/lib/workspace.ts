import type { AppUser } from './auth-client';
import type { WorkspaceIdentity } from '../types/offline';
import { guestWorkspace } from './offline-db';

const cachedAccountKey = 'jayawijaya-cached-account';
const activeWorkspaceKey = 'jayawijaya-active-workspace';

export function accountWorkspace(user: AppUser): WorkspaceIdentity {
  return { id: user.id, kind: 'account', name: user.name, email: user.email, image: user.image, role: user.role, tier: user.tier };
}

export function cacheAccount(user: AppUser) {
  const workspace = accountWorkspace(user);
  localStorage.setItem(cachedAccountKey, JSON.stringify(workspace));
  setActiveWorkspace(workspace);
  return workspace;
}

export function cachedAccount(): WorkspaceIdentity | null {
  try { return JSON.parse(localStorage.getItem(cachedAccountKey) ?? 'null') as WorkspaceIdentity | null; }
  catch { return null; }
}

export function setActiveWorkspace(workspace: WorkspaceIdentity) {
  localStorage.setItem(activeWorkspaceKey, JSON.stringify(workspace));
}

export function activeWorkspace(): WorkspaceIdentity {
  try { return JSON.parse(localStorage.getItem(activeWorkspaceKey) ?? 'null') as WorkspaceIdentity | null ?? guestWorkspace; }
  catch { return guestWorkspace; }
}
