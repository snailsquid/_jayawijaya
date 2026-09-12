import { useState } from 'react';
import { Radio, Settings } from 'lucide-react';
import type { Category, LiveCategory } from '@/types/quiz';
import { Button } from '@/components/ui/button';
import { ShareCategoryModal } from './ShareCategoryModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  category: Category;
  liveCategory?: LiveCategory;
  disabled?: boolean;
  onCreate: (name: string, moduleIds: string[], localCategoryId?: string) => Promise<LiveCategory>;
  onSetSharing: (id: string, enabled: boolean) => Promise<LiveCategory>;
}

export function LiveCategoryActions({ category, liveCategory, disabled, onCreate, onSetSharing }: Props) {
  const [busy,setBusy]=useState(false), [sharing,setSharing]=useState<LiveCategory>(), [error,setError]=useState('');
  const run=async()=>{ setBusy(true); try {
    setError('');
    if (liveCategory?.visibility === 'live') { setSharing(liveCategory); return; }
    let live=liveCategory ?? await onCreate(category.name,category.moduleIds,category.id);
    if(live.visibility!=='live') live=await onSetSharing(live.id,true); setSharing(live);
  } catch(reason) { setError(reason instanceof Error ? reason.message : 'Unable to share this category.'); } finally { setBusy(false); } };
  return <><Button size="sm" variant="outline" disabled={disabled||busy||category.moduleIds.length===0} onClick={()=>void run()}>{liveCategory?.visibility === 'live'?<Settings/>:<Radio/>}{busy?'Sharing…':liveCategory?.visibility === 'live'?'Manage sharing':'Share live'}</Button>
    {error&&<Alert variant="destructive" className="basis-full"><AlertDescription>{error}</AlertDescription></Alert>}
    {sharing&&<ShareCategoryModal category={sharing} url={`${window.location.origin}/shared-category/${sharing.shareToken}`} onClose={()=>setSharing(undefined)} />}</>;
}
