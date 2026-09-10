import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModules } from '../../src/hooks/useModules';
import type { Module } from '../../src/types/quiz';
import { emptyWorkspace, writeWorkspace } from '../../src/lib/offline-db';
import type { ModuleConflict } from '../../src/types/offline';

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

vi.mock('../../src/lib/api', () => ({ modulesApi: api, ApiError: class ApiError extends Error {} }));

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

  it('resolves a conflict with the server version', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const local = { ...original, title: 'Local', revision: '1:old:' };
    const server = { ...original, title: 'Server', revision: '2:new:', remoteId: original.id };
    const mutation = { id: 'conflict', kind: 'update' as const, moduleId: original.id, patch: { title: 'Local' }, baseRevision: local.revision, createdAt: 1 };
    const conflict: ModuleConflict = { id: mutation.id, mutation, localModule: local, serverModule: server };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [local], conflicts: [conflict] });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.resolveConflict(conflict.id, 'server'));

    expect(result.current.modules[0].title).toBe('Server');
    expect(result.current.conflicts).toHaveLength(0);
  });

  it('requeues the local version against the latest revision', async () => {
    const workspace = { id: crypto.randomUUID(), kind: 'account' as const, name: 'Test' };
    const local = { ...original, title: 'Local', revision: '1:old:' };
    const server = { ...original, title: 'Server', revision: '2:new:', remoteId: original.id };
    const mutation = { id: 'conflict', kind: 'update' as const, moduleId: original.id, patch: { title: 'Local' }, baseRevision: local.revision, createdAt: 1 };
    await writeWorkspace({ ...emptyWorkspace(workspace.id), modules: [local], conflicts: [{ id: mutation.id, mutation, localModule: local, serverModule: server }] });
    const { result } = renderHook(() => useModules(workspace));
    await waitFor(() => expect(result.current.loading).toBe(false));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await act(() => result.current.resolveConflict(mutation.id, 'local'));

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.conflicts).toHaveLength(0);
    expect(result.current.modules[0].title).toBe('Local');
  });
});
