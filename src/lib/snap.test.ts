import { describe, expect, it } from 'vitest';
import { loadSnap } from './snap';

describe('Snap.js loader', () => {
  it('loads the configured environment script with the public client key', async () => {
    const loading = loadSnap('https://app.sandbox.midtrans.com/snap/snap.js', 'client-key');
    const script = document.head.querySelector<HTMLScriptElement>('script[src="https://app.sandbox.midtrans.com/snap/snap.js"]');
    expect(script?.dataset.clientKey).toBe('client-key');
    window.snap = { pay: () => undefined };
    script?.dispatchEvent(new Event('load'));
    await expect(loading).resolves.toBeUndefined();
  });
});
