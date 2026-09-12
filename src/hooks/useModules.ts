import { useCallback, useEffect, useRef, useState } from 'react';
import type { Module } from '../types/quiz';
import type { ModuleMutation, OfflineWorkspace, WorkspaceIdentity } from '../types/offline';
import { ApiError, modulesApi } from '../lib/api';
import { readWorkspace, updateWorkspace, writeWorkspace } from '../lib/offline-db';
import { useOnline } from './useOnline';
import { ACCOUNT_MODULE_LIMITS, GUEST_MODULE_LIMITS } from '../lib/module-limits';

const moduleBytes = (module: Module) => new TextEncoder().encode(JSON.stringify(module.questions)).byteLength;
const mutationId = () => crypto.randomUUID();
const remoteId = (module: Module | undefined, fallback: string) => module?.remoteId ?? fallback;
const isConnectivityError = (error: unknown) => !navigator.onLine || error instanceof TypeError;
const MAX_REBASE_ATTEMPTS = 3;

function localUsage(modules: Module[]) {
  return {
    moduleCount: modules.length,
    usedBytes: modules.filter(module => !module.subscribed).reduce((sum, module) => sum + moduleBytes(module), 0),
  };
}

function mergeServerModules(local: Module[], server: Module[]) {
  return server.map(item => {
    const cached = local.find(candidate => candidate.remoteId === item.id || candidate.id === item.id);
    return cached?.remoteId ? { ...item, id: cached.id, remoteId: item.id } : item;
  });
}

async function replayMutation(workspaceId: string, originalMutation: ModuleMutation) {
  let mutation = originalMutation;
  let failureMessage = 'Synchronization failed.';
  for (let attempt = 0; attempt < MAX_REBASE_ATTEMPTS; attempt += 1) {
   const snapshot = await readWorkspace(workspaceId);
   const local = snapshot.modules.find(module => module.id === mutation.moduleId);
   try {
    if (mutation.kind === 'create') {
      const { module } = await modulesApi.create(mutation.module, mutation.id);
      await updateWorkspace(workspaceId, current => ({
        ...current,
        modules: current.modules.map(item => item.id === mutation.moduleId
          ? { ...module, id: item.id, remoteId: module.id }
          : item),
        queue: current.queue.filter(item => item.id !== mutation.id),
      }));
      return;
    }
    if (mutation.kind === 'update') {
      const { module } = await modulesApi.update(mutation.remoteId ?? remoteId(local, mutation.moduleId), mutation.patch, mutation.baseRevision);
      await updateWorkspace(workspaceId, current => ({
        ...current,
        modules: current.modules.map(item => item.id === mutation.moduleId
          ? { ...module, id: item.id, remoteId: item.remoteId }
          : item),
        queue: current.queue.filter(item => item.id !== mutation.id),
      }));
      return;
    }
    await modulesApi.remove(mutation.remoteId ?? remoteId(local, mutation.moduleId), mutation.baseRevision);
    await updateWorkspace(workspaceId, current => ({ ...current, queue: current.queue.filter(item => item.id !== mutation.id) }));
    return;
   } catch (error) {
    if (error instanceof ApiError && error.code === 'VERSION_CONFLICT' && error.currentModule) {
      failureMessage = error.message;
      if (attempt === MAX_REBASE_ATTEMPTS - 1) break;
      const serverModule = { ...error.currentModule, id: mutation.moduleId, remoteId: error.currentModule.id };
      mutation = mutation.kind === 'create' ? mutation : { ...mutation, baseRevision: error.currentModule.revision };
      const updatePatch = mutation.kind === 'update' ? mutation.patch : null;
      await updateWorkspace(workspaceId, current => ({
        ...current,
        modules: updatePatch
          ? current.modules.map(item => item.id === mutation.moduleId ? { ...serverModule, ...updatePatch, id: item.id, remoteId: serverModule.remoteId } : item)
          : current.modules,
        queue: current.queue.map(item => item.id === mutation.id ? mutation : item),
      }));
      continue;
    }
    if (isConnectivityError(error)) throw error;
    failureMessage = error instanceof Error ? error.message : 'Synchronization failed.';
    break;
   }
  }
  await updateWorkspace(workspaceId, current => ({
    ...current,
    queue: current.queue.filter(item => item.id !== mutation.id),
    failures: [...current.failures.filter(item => item.id !== mutation.id), {
      id: mutation.id,
      mutation: { ...mutation, error: undefined } as ModuleMutation,
      message: `${mutation.kind} ${mutation.moduleId}: ${failureMessage}`,
      failedAt: Date.now(),
    }],
  }));
}

export function useModules(workspace: WorkspaceIdentity) {
  const [store, setStore] = useState<OfflineWorkspace | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [guestModules, setGuestModules] = useState<Module[]>([]);
  const online = useOnline();
  const syncing = useRef<Promise<void> | null>(null);

  const refreshLocal = useCallback(async () => setStore(await readWorkspace(workspace.id)), [workspace.id]);

  const syncNow = useCallback(async () => {
    if (workspace.kind === 'guest' || !navigator.onLine) return;
    if (syncing.current) return syncing.current;
    const run = (async () => {
     try {
      const initial = await readWorkspace(workspace.id);
      for (const mutation of initial.queue) {
        if (!navigator.onLine) break;
        await replayMutation(workspace.id, mutation);
      }
      const pending = await readWorkspace(workspace.id);
      if (pending.queue.length === 0) {
        const response = await modulesApi.list();
        const modules = mergeServerModules(pending.modules, response.modules);
        await writeWorkspace({ ...pending, modules, usage: response.usage, limits: response.limits, lastSyncedAt: Date.now() });
      }
      setError('');
    } catch (reason) {
      if (!isConnectivityError(reason)) setError(reason instanceof Error ? reason.message : 'Synchronization failed.');
     } finally {
      await refreshLocal();
     }
    })();
    syncing.current = run;
    try { await run; } finally { syncing.current = null; }
  }, [refreshLocal, workspace.id, workspace.kind]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const value = await readWorkspace(workspace.id);
      if (active) setStore(value);
      if (workspace.kind === 'account') {
        const guest = await readWorkspace('guest');
        if (active) setGuestModules(guest.modules);
      }
      await syncNow();
      if (active) setInitializing(false);
    })();
    return () => { active = false; };
  }, [syncNow, workspace.id, workspace.kind]);

  useEffect(() => { if (online) void syncNow(); }, [online, syncNow]);

  const commit = useCallback(async (update: (current: OfflineWorkspace) => OfflineWorkspace) => {
    // Do not let an older synchronization snapshot overwrite a newer local edit.
    // This is especially important while the initial account sync is still loading.
    if (syncing.current) await syncing.current;
    const next = await updateWorkspace(workspace.id, current => {
      const changed = update(current);
      return { ...changed, usage: localUsage(changed.modules) };
    });
    setStore(next);
    if (workspace.kind === 'account' && navigator.onLine) void syncNow();
    return next;
  }, [syncNow, workspace.id, workspace.kind]);

  const addModules = useCallback(async (newModules: Module[]) => {
    await commit(current => {
      const nextBytes = newModules.reduce((sum, module) => sum + moduleBytes(module), current.usage.usedBytes);
      if (current.modules.length + newModules.length > current.limits.modules) throw new Error('Module count quota reached.');
      if (nextBytes > current.limits.storageBytes) throw new Error('Module storage quota reached.');
      const modules = newModules.map(module => ({ ...module, id: module.id || crypto.randomUUID(), isOwner: true, visibility: module.visibility ?? 'private' as const }));
      const queue = workspace.kind === 'account'
        ? [...current.queue, ...modules.map(module => ({ id: mutationId(), kind: 'create' as const, moduleId: module.id, module, createdAt: Date.now() }))]
        : current.queue;
      return { ...current, modules: [...modules, ...current.modules], queue, failures: current.failures.filter(failure => !modules.some(module => module.id === failure.mutation.moduleId)) };
    });
  }, [commit, workspace.kind]);

  const updateModule = useCallback(async (id: string, patch: Partial<Module>) => {
    await commit(current => {
      const original = current.modules.find(module => module.id === id);
      if (!original) throw new Error('Module not found.');
      const modules = current.modules.map(module => module.id === id ? { ...module, ...patch } : module);
      if (workspace.kind === 'guest') return { ...current, modules };
      const create = current.queue.find(item => item.moduleId === id && item.kind === 'create');
      if (create?.kind === 'create') {
        return { ...current, modules, queue: current.queue.map(item => item.id === create.id ? { ...create, module: { ...create.module, ...patch } } : item) };
      }
      const existing = current.queue.find(item => item.moduleId === id && item.kind === 'update');
      const next: ModuleMutation = { id: existing?.id ?? mutationId(), kind: 'update', moduleId: id, remoteId: existing?.kind === 'update' ? existing.remoteId : original.remoteId, patch: { ...(existing?.kind === 'update' ? existing.patch : {}), ...patch }, baseRevision: existing?.kind === 'update' ? existing.baseRevision : original.revision, createdAt: existing?.createdAt ?? Date.now() };
      return { ...current, modules, queue: [...current.queue.filter(item => item.id !== existing?.id), next], failures: current.failures.filter(failure => failure.mutation.moduleId !== id) };
    });
  }, [commit, workspace.kind]);

  const deleteModule = useCallback(async (id: string) => {
    await commit(current => {
      const original = current.modules.find(module => module.id === id);
      if (!original) return current;
      if (workspace.kind === 'guest') return { ...current, modules: current.modules.filter(module => module.id !== id) };
      const pendingCreate = current.queue.some(item => item.moduleId === id && item.kind === 'create');
      const queue = pendingCreate
        ? current.queue.filter(item => item.moduleId !== id)
        : [...current.queue.filter(item => item.moduleId !== id), { id: mutationId(), kind: 'delete' as const, moduleId: id, remoteId: original.remoteId, baseRevision: original.revision, createdAt: Date.now() }];
      return { ...current, modules: current.modules.filter(module => module.id !== id), queue, failures: current.failures.filter(failure => failure.mutation.moduleId !== id) };
    });
  }, [commit, workspace.kind]);

  const cloudOnly = useCallback(() => {
    if (!online || workspace.kind === 'guest') throw new Error('This action requires a signed-in internet connection.');
  }, [online, workspace.kind]);

  const setSharing = useCallback(async (id: string, enabled: boolean) => {
    cloudOnly(); const { module } = await modulesApi.setSharing(remoteId(store?.modules.find(item => item.id === id), id), enabled);
    await commit(current => ({ ...current, modules: current.modules.map(item => item.id === id ? { ...module, id, remoteId: item.remoteId } : item) }));
    return module;
  }, [cloudOnly, commit, store?.modules]);

  const publishModule = useCallback(async (id: string, replacement: Module) => updateModule(id, replacement).then(() => replacement), [updateModule]);
  const syncModule = useCallback(async (id: string) => { cloudOnly(); const { module } = await modulesApi.sync(remoteId(store?.modules.find(item => item.id === id), id)); await commit(current => ({ ...current, modules: current.modules.map(item => item.id === id ? { ...module, id, remoteId: item.remoteId } : item) })); }, [cloudOnly, commit, store?.modules]);
  const syncAll = useCallback(async () => { cloudOnly(); await syncNow(); return 0; }, [cloudOnly, syncNow]);

  const importGuestModules = useCallback(async (selectedIds?: string[]) => {
    if (workspace.kind !== 'account') return 0;
    const guest = await readWorkspace('guest');
    const existing = new Set((store?.modules ?? []).map(module => module.hash ?? module.title));
    const selected = selectedIds ? new Set(selectedIds) : null;
    const imports = guest.modules.filter(module => (!selected || selected.has(module.id)) && !existing.has(module.hash ?? module.title)).map(module => ({ ...module, id: crypto.randomUUID(), remoteId: undefined, revision: undefined }));
    if (imports.length) await addModules(imports);
    return imports.length;
  }, [addModules, store?.modules, workspace.kind]);

  return {
    modules: store?.modules ?? [], usage: store?.usage ?? { moduleCount: 0, usedBytes: 0 },
    limits: store?.limits ?? (workspace.kind === 'guest' ? GUEST_MODULE_LIMITS : ACCOUNT_MODULE_LIMITS.free),
    loading: store === null || initializing, error, online, pendingCount: store?.queue.length ?? 0,
    syncErrors: (store?.failures ?? []).map(failure => failure.message),
    conflicts: store?.conflicts ?? [], guestModules, addModules, updateModule, deleteModule, setSharing,
    publishModule, syncModule, syncAll, syncNow, importGuestModules,
    subscribeByCode: async (code: string) => { cloudOnly(); const { module } = await modulesApi.subscribe(code); await commit(current => ({ ...current, modules: [module, ...current.modules] })); return module; },
    reload: syncNow,
  };
}
