import type { Module } from '../types/quiz';
import type { ActiveEntitlement, MidtransClientConfig, Payment, PaymentProduct } from '../types/payment';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly currentModule?: Module;

  constructor(message: string, status: number, code: string, currentModule?: Module) {
    super(message);
    this.status = status;
    this.code = code;
    this.currentModule = currentModule;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; currentModule?: Module } } | null;
    throw new ApiError(body?.error?.message ?? 'Request failed.', response.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.currentModule);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const modulesApi = {
  list: () => request<{ modules: Module[]; usage: { moduleCount: number; usedBytes: number }; limits: { modules: number; storageBytes: number; liveModules: boolean } }>('/api/modules'),
  create: (module: Module, clientMutationId?: string) => request<{ module: Module }>('/api/modules', {
    method: 'POST', body: JSON.stringify({ ...module, clientMutationId }),
  }),
  update: (id: string, patch: Partial<Module>, expectedRevision?: string) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...patch, expectedRevision }) }),
  remove: (id: string, expectedRevision?: string) => request<void>(`/api/modules/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ expectedRevision }) }),
  setSharing: (id: string, enabled: boolean) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}/share`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  publish: (id: string, module: Module) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}/publish`, { method: 'POST', body: JSON.stringify(module) }),
  resolveShare: (token: string) => request<{ module: Module }>(`/api/modules/shared/${encodeURIComponent(token)}`),
  subscribe: (token: string) => request<{ module: Module }>(`/api/modules/shared/${encodeURIComponent(token)}/subscribe`, { method: 'POST' }),
  sync: (id: string) => request<{ module: Module }>(`/api/modules/${encodeURIComponent(id)}/sync`, { method: 'POST' }),
  syncAll: () => request<{ modules: Module[]; updated: number }>('/api/modules/sync', { method: 'POST' }),
};

export const paymentsApi = {
  list: () => request<{ payments: Payment[]; products: PaymentProduct[]; entitlement: ActiveEntitlement | null; config: MidtransClientConfig }>('/api/payments'),
  create: (productCode: string, amount?: number) => request<{ payment: Payment; config: MidtransClientConfig }>('/api/payments', {
    method: 'POST', body: JSON.stringify({ productCode, ...(amount === undefined ? {} : { amount }) }),
  }),
  get: (orderId: string) => request<{ payment: Payment }>(`/api/payments/${encodeURIComponent(orderId)}`),
  cancel: (orderId: string) => request<{ payment: Payment }>(`/api/payments/${encodeURIComponent(orderId)}`, { method: 'DELETE' }),
};
