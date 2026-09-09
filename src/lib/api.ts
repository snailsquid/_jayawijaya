import type { Module } from '../types/quiz';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(body?.error?.message ?? 'Request failed.', response.status, body?.error?.code ?? 'REQUEST_FAILED');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const modulesApi = {
  list: () => request<{ modules: Module[]; usage: { moduleCount: number; usedBytes: number } }>('/api/modules'),
  create: (module: Module) => request<{ module: Module }>('/api/modules', { method: 'POST', body: JSON.stringify(module) }),
  update: (id: string, patch: Partial<Module>) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => request<void>(`/api/modules/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
