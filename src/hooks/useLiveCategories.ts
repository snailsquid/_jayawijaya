import { useCallback, useEffect, useState } from 'react';
import { categoriesApi } from '@/lib/api';
import type { LiveCategory } from '@/types/quiz';

export function useLiveCategories(enabled = true) {
  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) { setCategories([]); setLoading(false); return; }
    setLoading(true);
    try { setCategories((await categoriesApi.list()).categories); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load live categories.'); }
    finally { setLoading(false); }
  }, [enabled]);

  useEffect(() => { void reload(); }, [reload]);
  const replace = (category: LiveCategory) => setCategories(current => current.map(item => item.id === category.id ? category : item));

  return {
    categories, loading, error, reload,
    create: async (name: string, moduleIds: string[], localCategoryId?: string) => {
      const { category } = await categoriesApi.create({ name, moduleIds, localCategoryId }, crypto.randomUUID());
      setCategories(current => [category, ...current]); return category;
    },
    publish: async (id: string, name: string, moduleIds: string[], expectedVersion?: number) => {
      const { category } = await categoriesApi.update(id, { name, moduleIds }, expectedVersion); replace(category); return category;
    },
    setSharing: async (id: string, enabledSharing: boolean) => {
      const { category } = await categoriesApi.setSharing(id, enabledSharing); replace(category); return category;
    },
    sync: async (id: string) => { const response = await categoriesApi.sync(id); replace(response.category); return response; },
    remove: async (id: string) => { await categoriesApi.remove(id); setCategories(current => current.filter(item => item.id !== id)); },
    subscribeByCode: async (code: string) => { const { category } = await categoriesApi.subscribe(code.trim().toUpperCase()); setCategories(current => current.some(item => item.id === category.id) ? current : [category, ...current]); return category; },
  };
}
