import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { updateOfflineApp } from '../lib/pwa';
import { Button } from './ui/button';

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const ready = () => setOfflineReady(true);
    const update = () => setUpdateReady(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    window.addEventListener('jayawijaya:offline-ready', ready); window.addEventListener('jayawijaya:update-ready', update);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('jayawijaya:offline-ready', ready); window.removeEventListener('jayawijaya:update-ready', update); };
  }, []);
  if (online && !updateReady && !offlineReady) return null;
  return <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm shadow-lg">
    {!online && <><WifiOff className="size-4" /> Offline</>}
    {offlineReady && online && <span>Ready for offline use</span>}
    {updateReady && <Button size="sm" onClick={() => void updateOfflineApp()}>Update</Button>}
    {!updateReady && offlineReady && <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>Dismiss</Button>}
  </div>;
}
