import { useState } from 'react';
import { Radio, Settings } from 'lucide-react';
import type { Category, LiveCategory } from '@/types/quiz';
import { Button } from '@/components/ui/button';
import { ShareCategoryModal } from './ShareCategoryModal';
import { toast } from 'sonner';

interface Props {
  category: Category;
  liveCategory?: LiveCategory;
  disabled?: boolean;
  onCreate: (name: string, moduleIds: string[], localCategoryId?: string) => Promise<LiveCategory>;
  onSetSharing: (id: string, enabled: boolean) => Promise<LiveCategory>;
  onActivated?: () => void | Promise<void>;
}

export function LiveCategoryActions({ category, liveCategory, disabled, onCreate, onSetSharing, onActivated }: Props) {
  const [busy,setBusy]=useState(false), [sharing,setSharing]=useState<LiveCategory>();
  const run=async()=>{ setBusy(true); try {
    if (liveCategory?.visibility === 'live') { setSharing(liveCategory); return; }
    let live=liveCategory ?? await onCreate(category.name,category.moduleIds,category.id);
    if(live.visibility!=='live') live=await onSetSharing(live.id,true);
    await onActivated?.();
    setSharing(live);
  } catch(reason) { toast.error(reason instanceof Error ? reason.message : 'Unable to share this category.'); } finally { setBusy(false); } };
  return <><Button size="sm" variant="outline" disabled={disabled||busy||category.moduleIds.length===0} onClick={()=>void run()}>{liveCategory?.visibility === 'live'?<Settings/>:<Radio/>}{busy?'Sharing…':liveCategory?.visibility === 'live'?'Manage sharing':'Share live'}</Button>
    {sharing&&<ShareCategoryModal category={sharing} url={`${window.location.origin}/shared-category/${sharing.shareToken}`} onClose={()=>setSharing(undefined)} />}</>;
}
