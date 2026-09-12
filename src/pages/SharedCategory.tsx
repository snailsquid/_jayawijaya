import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { categoriesApi } from '@/lib/api';
import type { LiveCategory } from '@/types/quiz';
import { PageHeader, PageShell } from '@/components/app-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SharedCategory() {
  const { token='' }=useParams(), navigate=useNavigate();
  const [category,setCategory]=useState<LiveCategory|null>(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  useEffect(()=>{ void categoriesApi.resolveShare(token).then(result=>setCategory(result.category)).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to open this category.')); },[token]);
  const subscribe=async()=>{setBusy(true);setError('');try{await categoriesApi.subscribe(token);navigate('/start',{replace:true});}catch(reason){setError(reason instanceof Error?reason.message:'Unable to subscribe.');setBusy(false);}};
  return <PageShell className="max-w-xl"><PageHeader title="Shared live category" />{error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {!error&&!category&&<p>Loading category…</p>}{category&&<Card><CardHeader><CardTitle>{category.name}</CardTitle><CardDescription>{category.members.length} modules in publisher-defined order</CardDescription></CardHeader>
      <CardContent className="space-y-4"><ol className="list-decimal space-y-1 pl-5">{category.members.map(item=><li key={item.moduleId}>{item.title} <span className="text-muted-foreground">({item.questionCount} questions)</span></li>)}</ol>
        <p className="text-sm text-muted-foreground">Future updates sync while sharing remains active. If sharing stops, your last version stays available.</p><Button disabled={busy} onClick={()=>void subscribe()}>{busy?'Adding…':'Add category and modules'}</Button></CardContent></Card>}</PageShell>;
}
