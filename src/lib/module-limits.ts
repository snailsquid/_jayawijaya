export const ACCOUNT_MODULE_LIMITS = {
  free: {
    modules: 10,
    storageBytes: 25 * 1024 * 1024,
    liveModules: false,
  },
  pro: {
    modules: 200,
    storageBytes: 500 * 1024 * 1024,
    liveModules: true,
  },
} as const;

export const GUEST_MODULE_LIMITS = {
  modules: 100,
  storageBytes: 25 * 1024 * 1024,
  liveModules: false,
} as const;

export function accountLimitsFor(tier?: string) {
  return tier === 'pro' ? ACCOUNT_MODULE_LIMITS.pro : ACCOUNT_MODULE_LIMITS.free;
}
