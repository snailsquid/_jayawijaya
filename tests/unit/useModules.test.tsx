import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModules } from '../../src/hooks/useModules';
import type { Module } from '../../src/types/quiz';
import { emptyWorkspace, readWorkspace, writeWorkspace } from '../../src/lib/offline-db';
import { ApiError } from '../../src/lib/api';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  remove: vi.fn(),
  setSharing: vi.fn(),
  sync: vi.fn(),
  syncAll: vi.fn(),
}));

vi.mock('../../src/lib/api', () => ({
  modulesApi: api,
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    currentModule?: Module;
    constructor(message: string, status: number, code: string, currentModule?: Module) {
      super(message); this.status = status; this.code = code; this.currentModule = currentModule;
    }
  },
}));

const original: Module = {
  id: 'module-1',
  title: 'Module',
  questions: [{ question: 'Short?', answers: ['Yes', 'No'], correct_answer: 1 }],
};

const bytes = (module: Module) => new TextEncoder().encode(JSON.stringify(module.questions)).byteLength;

describe('useModules usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    api.list.mockResolvedValue({
      modules: [original],
      usage: { moduleCount: 1, usedBytes: bytes(original) },
      limits: { modules: 100, storageBytes: 25 * 1024 * 1024, liveModules: false },
    });
  });

  it('updates storage usage when a persisted module changes size', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const enlarged: Module = {
      ...original,
      questions: [{ ...original.questions[0], explanation: 'A substantially longer persisted explanation.' }],
    };
    api.update.mockResolvedValue({ module: enlarged });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.updateModule(original.id, { questions: enlarged.questions }));

    expect(result.current.usage).toEqual({ moduleCount: 1, usedBytes: bytes(enlarged) });
    expect(result.current.modules[0]).toEqual(enlarged);
  });

  it('does not change storage usage for a category-only update', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const categorized = { ...original, categoryId: 'GI' };
    api.update.mockResolvedValue({ module: categorized });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.updateModule(original.id, { categoryId: 'GI' }));

    expect(result.current.usage).toEqual({ moduleCount: 1, usedBytes: bytes(original) });
    expect(result.current.modules[0]).toEqual(categorized);
  });

  it('updates storage usage when publishing a replacement', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const enlarged: Module = {
      ...original,
      questions: [{ ...original.questions[0], explanation: 'A longer published explanation.' }],
    };
    api.update.mockResolvedValue({ module: enlarged });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.publishModule(original.id, enlarged));

    expect(result.current.usage).toEqual({ moduleCount: 1, usedBytes: bytes(enlarged) });
    expect(result.current.modules[0]).toEqual(enlarged);
  });

  it('keeps the stable module identity and syncs live state when replacing content', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const cached = { ...original, id: 'stable-local-id', remoteId: 'server-id', revision: '1:old:', visibility: 'private' as const };
    const replacement = { ...cached, id: 'pasted-123', title: 'Revised', hash: 'new-hash', visibility: 'live' as const };
    const updated = { ...cached, title: 'Revised', hash: 'new-hash', revision: '2:new:' };
    const shared = { ...updated, visibility: 'live' as const, shareCode: 'ABCD' };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [cached] });
    api.update.mockResolvedValue({ module: updated });
    api.setSharing.mockResolvedValue({ module: shared });
    api.list
      .mockResolvedValueOnce({ modules: [{ ...cached, id: 'server-id' }], usage: { moduleCount: 1, usedBytes: bytes(cached) }, limits: emptyWorkspace(workspace.id).limits })
      .mockResolvedValue({ modules: [{ ...shared, id: 'server-id' }], usage: { moduleCount: 1, usedBytes: bytes(shared) }, limits: emptyWorkspace(workspace.id).limits });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.publishModule(cached.id, replacement));
    await waitFor(() => expect(api.setSharing).toHaveBeenCalledWith('server-id', true));

    expect(api.update).toHaveBeenCalledWith('server-id', expect.not.objectContaining({ id: expect.anything() }), cached.revision);
    expect(result.current.modules[0]).toMatchObject({ id: cached.id, remoteId: 'server-id', title: 'Revised', visibility: 'live' });
    expect(result.current.syncErrors).toEqual([]);
  });

  it('keeps guest changes locally without calling the server', async () => {
    const workspace = { id: `guest-${crypto.randomUUID()}`, kind: 'guest' as const, name: 'Guest' };
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const local = { ...original, id: 'guest-module' };

    await act(() => result.current.addModules([local]));
    await act(() => result.current.updateModule(local.id, { categoryId: 'Offline' }));

    expect(result.current.modules[0].categoryId).toBe('Offline');
    expect(result.current.pendingCount).toBe(0);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('rebases a queued patch on the current server revision without user input', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const local = { ...original, title: 'Local', revision: '1:old:' };
    const server = { ...original, title: 'Server', revision: '2:new:', remoteId: original.id };
    const mutation = { id: 'conflict', kind: 'update' as const, moduleId: original.id, patch: { title: 'Local' }, baseRevision: local.revision, createdAt: 1 };
    const updated = { ...server, title: 'Local', revision: '3:updated:' };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [local], queue: [mutation] });
    api.update.mockRejectedValueOnce(new ApiError('stale', 409, 'VERSION_CONFLICT', server)).mockResolvedValueOnce({ module: updated });
    api.list.mockResolvedValueOnce({ modules: [updated], usage: { moduleCount: 1, usedBytes: bytes(updated) }, limits: emptyWorkspace(workspace.id).limits });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.update).toHaveBeenNthCalledWith(1, original.id, mutation.patch, '1:old:');
    expect(api.update).toHaveBeenNthCalledWith(2, original.id, mutation.patch, '2:new:');
    expect(result.current.modules[0].title).toBe('Local');
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.conflicts).toHaveLength(0);
  });

  it('migrates legacy conflicts into rebased queued intent', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const local = { ...original, title: 'Local', revision: '1:old:' };
    const server = { ...original, title: 'Server', revision: '2:new:', remoteId: original.id };
    const mutation = { id: 'conflict', kind: 'update' as const, moduleId: original.id, patch: { title: 'Local' }, baseRevision: local.revision, createdAt: 1 };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [local], conflicts: [{ id: mutation.id, mutation, localModule: local, serverModule: server }] });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const migrated = await readWorkspace(workspace.id);

    expect(migrated.queue).toEqual([{ ...mutation, remoteId: server.remoteId, baseRevision: server.revision, error: undefined }]);
    expect(migrated.conflicts).toEqual([]);
    expect(migrated.modules[0]).toMatchObject({ id: original.id, title: 'Local', revision: server.revision });
  });

  it('retries a stale delete against the current revision', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const server = { ...original, id: 'server-id', revision: '2:new:' };
    const mutation = { id: 'delete-1', kind: 'delete' as const, moduleId: 'stable-local-id', remoteId: server.id, baseRevision: '1:old:', createdAt: 1 };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), queue: [mutation] });
    api.remove.mockRejectedValueOnce(new ApiError('stale', 409, 'VERSION_CONFLICT', server)).mockResolvedValueOnce(undefined);
    api.list.mockResolvedValueOnce({ modules: [], usage: { moduleCount: 0, usedBytes: 0 }, limits: emptyWorkspace(workspace.id).limits });

    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.remove).toHaveBeenNthCalledWith(1, server.id, '1:old:');
    expect(api.remove).toHaveBeenNthCalledWith(2, server.id, '2:new:');
    expect(result.current.pendingCount).toBe(0);
  });

  it('bounds conflict retries and lets later mutations continue after a permanent failure', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const first = { id: 'bad', kind: 'update' as const, moduleId: original.id, patch: { title: 'Local' }, baseRevision: '1', createdAt: 1 };
    const secondModule = { ...original, id: 'module-2', title: 'Second', revision: '1' };
    const second = { id: 'good', kind: 'delete' as const, moduleId: secondModule.id, baseRevision: '1', createdAt: 2 };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [original], queue: [first, second] });
    api.update.mockRejectedValue(new ApiError('still stale', 409, 'VERSION_CONFLICT', { ...original, revision: '2' }));
    api.remove.mockResolvedValue(undefined);
    api.list.mockResolvedValueOnce({ modules: [original], usage: { moduleCount: 1, usedBytes: bytes(original) }, limits: emptyWorkspace(workspace.id).limits });

    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.update).toHaveBeenCalledTimes(3);
    expect(api.remove).toHaveBeenCalledOnce();
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.syncErrors).toEqual([expect.stringContaining('still stale')]);
  });

  it('uses the server snapshot when there is no pending local intent, including subscriptions', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const cached = { ...original, id: 'stable-local-id', remoteId: original.id, title: 'Cached edit', subscribed: true };
    const server = { ...original, title: 'Publisher version', subscribed: true, revision: '2' };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [cached] });
    api.list.mockResolvedValueOnce({ modules: [server], usage: { moduleCount: 1, usedBytes: 0 }, limits: emptyWorkspace(workspace.id).limits });

    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.modules[0]).toMatchObject({ id: 'stable-local-id', remoteId: original.id, title: 'Publisher version', subscribed: true });
  });
});
