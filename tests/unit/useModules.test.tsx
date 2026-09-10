import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModules } from '../../src/hooks/useModules';
import type { Module } from '../../src/types/quiz';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  remove: vi.fn(),
  setSharing: vi.fn(),
  sync: vi.fn(),
  syncAll: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('../../src/lib/api', () => ({ modulesApi: api }));

const original: Module = {
  id: 'module-1',
  title: 'Module',
  questions: [{ question: 'Short?', answers: ['Yes', 'No'], correct_answer: 1 }],
};

const bytes = (module: Module) => new TextEncoder().encode(JSON.stringify(module.questions)).byteLength;

describe('useModules usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue({
      modules: [original],
      usage: { moduleCount: 1, usedBytes: bytes(original) },
      limits: { modules: 1_000, storageBytes: 500 * 1024 * 1024 },
    });
  });

  it('uses the server-derived quota limits', async () => {
    const { result } = renderHook(() => useModules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.limits).toEqual({ modules: 1_000, storageBytes: 500 * 1024 * 1024 });
  });

  it('updates storage usage when a persisted module changes size', async () => {
    const enlarged: Module = {
      ...original,
      questions: [{ ...original.questions[0], explanation: 'A substantially longer persisted explanation.' }],
    };
    api.update.mockResolvedValue({ module: enlarged });
    const { result } = renderHook(() => useModules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.updateModule(original.id, { questions: enlarged.questions }));

    expect(result.current.usage).toEqual({ moduleCount: 1, usedBytes: bytes(enlarged) });
    expect(result.current.modules[0]).toEqual(enlarged);
  });

  it('does not change storage usage for a category-only update', async () => {
    const categorized = { ...original, categoryId: 'GI' };
    api.update.mockResolvedValue({ module: categorized });
    const { result } = renderHook(() => useModules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.updateModule(original.id, { categoryId: 'GI' }));

    expect(result.current.usage).toEqual({ moduleCount: 1, usedBytes: bytes(original) });
    expect(result.current.modules[0]).toEqual(categorized);
  });

  it('updates storage usage when publishing a replacement', async () => {
    const enlarged: Module = {
      ...original,
      questions: [{ ...original.questions[0], explanation: 'A longer published explanation.' }],
    };
    api.publish.mockResolvedValue({ module: enlarged });
    const { result } = renderHook(() => useModules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.publishModule(original.id, enlarged));

    expect(result.current.usage).toEqual({ moduleCount: 1, usedBytes: bytes(enlarged) });
    expect(result.current.modules[0]).toEqual(enlarged);
  });

  it('counts a subscribed module without charging its bytes to owned storage', async () => {
    const subscribed = { ...original, id: 'shared-module', subscribed: true };
    api.subscribe.mockResolvedValue({ module: subscribed });
    const { result } = renderHook(() => useModules());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.subscribeByCode('ABCD'));

    expect(result.current.usage).toEqual({ moduleCount: 2, usedBytes: bytes(original) });
    expect(result.current.modules[0]).toEqual(subscribed);
  });
});
