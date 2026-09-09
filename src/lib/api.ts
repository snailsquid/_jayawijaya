import type { Module } from '../types/quiz';
import type { MidtransClientConfig, Payment, PaymentProduct } from '../types/payment';

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
  setSharing: (id: string, enabled: boolean) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}/share`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  publish: (id: string, module: Module) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}/publish`, { method: 'POST', body: JSON.stringify(module) }),
  resolveShare: (token: string) => request<{ module: Module }>(`/api/modules/shared/${encodeURIComponent(token)}`),
  subscribe: (token: string) => request<{ module: Module }>(`/api/modules/shared/${encodeURIComponent(token)}/subscribe`, { method: 'POST' }),
  sync: (id: string) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}/sync`, { method: 'POST' }),
  syncAll: () => request<{ modules: Module[]; updated: number }>('/api/modules/sync', { method: 'POST' }),
};

export const paymentsApi = {
  list: () => request<{ payments: Payment[]; product: PaymentProduct; config: MidtransClientConfig }>('/api/payments'),
  create: (productCode: string) => request<{ payment: Payment; config: MidtransClientConfig }>('/api/payments', {
    method: 'POST', body: JSON.stringify({ productCode }),
  }),
  get: (orderId: string) => request<{ payment: Payment }>(`/api/payments/${encodeURIComponent(orderId)}`),
  cancel: (orderId: string) => request<{ payment: Payment }>(`/api/payments/${encodeURIComponent(orderId)}`, { method: 'DELETE' }),
};
