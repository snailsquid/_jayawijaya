interface SnapCallbacks {
  onSuccess(result: unknown): void;
  onPending(result: unknown): void;
  onError(result: unknown): void;
  onClose(): void;
}

declare global {
  interface Window {
    snap?: { pay(token: string, callbacks: SnapCallbacks): void };
  }
}

let loading: Promise<void> | null = null;

export function loadSnap(url: string, clientKey: string): Promise<void> {
  if (window.snap) return Promise.resolve();
  if (loading) return loading;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.dataset.clientKey = clientKey;
    script.async = true;
    script.onload = () => window.snap ? resolve() : reject(new Error('Midtrans Snap did not initialize.'));
    script.onerror = () => reject(new Error('Could not load Midtrans Snap.'));
    document.head.appendChild(script);
  }).catch(error => {
    loading = null;
    throw error;
  });
  loading = promise;
  return promise;
}
