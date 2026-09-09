import { useCallback, useEffect, useState } from 'react';
import type { Module } from '../types/quiz';
import { modulesApi } from '../lib/api';

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState({ moduleCount: 0, usedBytes: 0 });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await modulesApi.list();
      setModules(response.modules);
      setUsage(response.usage);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load modules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const addModules = useCallback(async (newModules: Module[]) => {
    const created: Module[] = [];
    for (const module of newModules) {
      const response = await modulesApi.create(module);
      created.push(response.module);
    }
    setModules(previous => [...created, ...previous]);
    setUsage(previous => ({
      moduleCount: previous.moduleCount + created.length,
      usedBytes: previous.usedBytes + created.reduce((sum, module) => sum + new TextEncoder().encode(JSON.stringify(module.questions)).byteLength, 0),
    }));
  }, []);

  const updateModule = useCallback(async (id: string, patch: Partial<Module>) => {
    const response = await modulesApi.update(id, patch);
    setModules(previous => previous.map(module => module.id === id ? response.module : module));
  }, []);

  const deleteModule = useCallback(async (id: string) => {
    await modulesApi.remove(id);
    setModules(previous => {
      const removed = previous.find(module => module.id === id);
      if (removed) {
        const bytes = new TextEncoder().encode(JSON.stringify(removed.questions)).byteLength;
        setUsage(current => ({ moduleCount: Math.max(0, current.moduleCount - 1), usedBytes: Math.max(0, current.usedBytes - bytes) }));
      }
      return previous.filter(module => module.id !== id);
    });
  }, []);

  return { modules, usage, loading, error, addModules, updateModule, deleteModule, reload };
}
