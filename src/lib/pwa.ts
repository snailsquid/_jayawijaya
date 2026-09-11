import { registerSW } from 'virtual:pwa-register';

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function registerOfflineApp() {
  applyUpdate = registerSW({
    immediate: true,
    onOfflineReady: () => window.dispatchEvent(new Event('jayawijaya:offline-ready')),
    onNeedRefresh: () => window.dispatchEvent(new Event('jayawijaya:update-ready')),
  });
}

export function updateOfflineApp() {
  return applyUpdate?.(true);
}
