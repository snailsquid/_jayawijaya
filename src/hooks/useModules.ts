import { useCallback, useEffect, useState } from 'react';
import type { Module } from '../types/quiz';
import { modulesApi } from '../lib/api';

const moduleBytes = (module: Module) => new TextEncoder().encode(JSON.stringify(module.questions)).byteLength;

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
      usedBytes: previous.usedBytes + created.reduce((sum, module) => sum + moduleBytes(module), 0),
    }));
  }, []);

  const updateModule = useCallback(async (id: string, patch: Partial<Module>) => {
    const response = await modulesApi.update(id, patch);
    setModules(previous => {
      const replaced = previous.find(module => module.id === id);
      if (replaced) {
        const byteDelta = moduleBytes(response.module) - moduleBytes(replaced);
        if (byteDelta !== 0) {
          setUsage(current => ({ ...current, usedBytes: Math.max(0, current.usedBytes + byteDelta) }));
        }
      }
      return previous.map(module => module.id === id ? response.module : module);
    });
  }, []);

  const deleteModule = useCallback(async (id: string) => {
    await modulesApi.remove(id);
    setModules(previous => {
      const removed = previous.find(module => module.id === id);
      if (removed) {
        const bytes = removed.subscribed ? 0 : moduleBytes(removed);
        setUsage(current => ({ moduleCount: Math.max(0, current.moduleCount - 1), usedBytes: Math.max(0, current.usedBytes - bytes) }));
      }
      return previous.filter(module => module.id !== id);
    });
  }, []);

  const setSharing = useCallback(async (id: string, enabled: boolean) => {
    const { module } = await modulesApi.setSharing(id, enabled);
    setModules(previous => previous.map(item => item.id === id ? module : item));
    return module;
  }, []);

  const publishModule = useCallback(async (id: string, replacement: Module) => {
    const { module } = await modulesApi.publish(id, replacement);
    setModules(previous => {
      const replaced = previous.find(item => item.id === id);
      if (replaced) {
        const byteDelta = moduleBytes(module) - moduleBytes(replaced);
        if (byteDelta !== 0) {
          setUsage(current => ({ ...current, usedBytes: Math.max(0, current.usedBytes + byteDelta) }));
        }
      }
      return previous.map(item => item.id === id ? module : item);
    });
    return module;
  }, []);

  const syncModule = useCallback(async (id: string) => {
    const { module } = await modulesApi.sync(id);
    setModules(previous => previous.map(item => item.id === id ? module : item));
  }, []);

  const syncAll = useCallback(async () => {
    const response = await modulesApi.syncAll();
    setModules(response.modules);
    return response.updated;
  }, []);

  const subscribeByCode = useCallback(async (code: string) => {
    const { module } = await modulesApi.subscribe(code);
    setModules(previous => [module, ...previous]);
    setUsage(previous => ({
      moduleCount: previous.moduleCount + 1,
      usedBytes: previous.usedBytes,
    }));
    return module;
  }, []);

  return { modules, usage, loading, error, addModules, updateModule, deleteModule, setSharing, publishModule, syncModule, syncAll, subscribeByCode, reload };
}
