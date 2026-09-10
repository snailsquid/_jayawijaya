import type { Module } from './quiz';

export interface WorkspaceIdentity {
  id: string;
  kind: 'guest' | 'account';
  name: string;
  email?: string;
  image?: string | null;
  role?: 'user' | 'admin';
  tier?: 'free' | 'pro';
}

export type ModuleMutation =
  | { id: string; kind: 'create'; moduleId: string; module: Module; createdAt: number; error?: string }
  | { id: string; kind: 'update'; moduleId: string; patch: Partial<Module>; baseRevision?: string; createdAt: number; error?: string }
  | { id: string; kind: 'delete'; moduleId: string; baseRevision?: string; createdAt: number; error?: string };

export interface ModuleConflict {
  id: string;
  mutation: ModuleMutation;
  localModule?: Module;
  serverModule: Module;
}

export interface OfflineWorkspace {
  id: string;
  modules: Module[];
  usage: { moduleCount: number; usedBytes: number };
  limits: { modules: number; storageBytes: number; liveModules?: boolean };
  queue: ModuleMutation[];
  conflicts: ModuleConflict[];
  lastSyncedAt?: number;
}
