import { beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env, reset, SELF, type D1Migration } from 'cloudflare:test';

declare module 'cloudflare:test' { interface ProvidedEnv { DB: D1Database; TEST_MIGRATIONS: D1Migration[] } }

async function signUp(identity: string) {
  const response=await SELF.fetch('http://example.test/api/auth/sign-up/email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:identity,email:`${identity}@example.test`,password:'secure-password-123'})});
  return response.headers.get('set-cookie')!.split(';')[0];
}
async function api(path:string,cookie:string,init:RequestInit={}) { return SELF.fetch(`http://example.test${path}`,{...init,headers:{'content-type':'application/json',origin:'http://example.test',cookie,...init.headers}}); }
async function premium(identity:string) {
  const user=await env.DB.prepare('SELECT id FROM user WHERE email=?').bind(`${identity}@example.test`).first<{id:string}>(), now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO payments(id,order_id,user_id,product_code,amount,currency,status,created_at,updated_at) VALUES(?,?,?,'mvp-lifetime',1,'IDR','succeeded',?,?)`).bind(`pay-${identity}`,`order-${identity}`,user!.id,now,now),
    env.DB.prepare(`INSERT INTO entitlements(id,user_id,payment_id,product_code,plan,starts_at,active,created_at,updated_at) VALUES(?,?,?,'mvp-lifetime','MVP',?,1,?,?)`).bind(`ent-${identity}`,user!.id,`pay-${identity}`,now,now,now),
  ]);
}
const body=(title:string)=>({title,hash:`hash-${title}`,visibility:'live',questions:[{question:`${title}?`,answers:['A','B'],correct_answer:1}]});
async function liveModule(cookie:string,title:string) { const response=await api('/api/modules',cookie,{method:'POST',body:JSON.stringify(body(title))}); expect(response.status).toBe(201); return (await response.json() as {module:{id:string}}).module; }

describe('live category API',()=>{
  beforeEach(async()=>{await reset();await applyD1Migrations(env.DB,env.TEST_MIGRATIONS);});

  it('publishes an ordered category, resolves its link/code, and subscribes idempotently',async()=>{
    const alice=await signUp('category-alice'),bob=await signUp('category-bob'); await premium('category-alice');
    const first=await liveModule(alice,'First'),second=await liveModule(alice,'Second');
    const created=await api('/api/categories',alice,{method:'POST',body:JSON.stringify({name:'Rounds',moduleIds:[second.id,first.id],localCategoryId:'Rounds',visibility:'live',clientMutationId:'rounds-1'})});
    expect(created.status).toBe(201); const category=(await created.json() as {category:{id:string;shareToken:string;shareCode:string;moduleIds:string[];localCategoryId:string}}).category;
    expect(category.moduleIds).toEqual([second.id,first.id]); expect(category.shareCode).toMatch(/^[A-Z2-9]{4}$/);
    expect(category.localCategoryId).toBe('Rounds');
    expect((await api(`/api/categories/shared/${category.shareToken}`,bob)).status).toBe(200);
    const subscribed=await api(`/api/categories/shared/${category.shareCode.toLowerCase()}/subscribe`,bob,{method:'POST'}); expect(subscribed.status).toBe(201);
    expect(await subscribed.json()).toMatchObject({category:{localCategoryId:'Rounds'}});
    const retry=await api(`/api/categories/shared/${category.shareCode}/subscribe`,bob,{method:'POST'}); expect(retry.status).toBe(200);
    const modules=await api('/api/modules',bob); const subscribedModules=(await modules.json() as {modules:Array<{id:string;categoryId:string}>}).modules;
    expect(subscribedModules.map(item=>item.id).sort()).toEqual([first.id,second.id].sort());
    expect(subscribedModules.every(item=>item.categoryId==='Rounds')).toBe(true);
  });

  it('automatically makes every owned category member live when sharing starts',async()=>{
    const alice=await signUp('rules-alice'); await premium('rules-alice');
    const response=await api('/api/modules',alice,{method:'POST',body:JSON.stringify({...body('Private'),visibility:'private'})});
    const module=(await response.json() as {module:{id:string}}).module;
    const draft=await api('/api/categories',alice,{method:'POST',body:JSON.stringify({name:'Draft',moduleIds:[module.id]})}); expect(draft.status).toBe(201);
    const category=(await draft.json() as {category:{id:string}}).category;
    const share=await api(`/api/categories/${category.id}/share`,alice,{method:'POST',body:JSON.stringify({enabled:true})});
    expect(share.status).toBe(200);
    const modules=await api('/api/modules',alice);
    expect(await modules.json()).toMatchObject({modules:[{id:module.id,visibility:'live',shareCode:expect.stringMatching(/^[A-Z2-9]{4}$/)}]});
  });

  it('still rejects category members that are not active owned modules',async()=>{
    const alice=await signUp('invalid-owner'),bob=await signUp('invalid-member'); await premium('invalid-owner');
    const response=await api('/api/modules',bob,{method:'POST',body:JSON.stringify({...body('Foreign'),visibility:'private'})});
    const foreign=(await response.json() as {module:{id:string}}).module;
    const created=await api('/api/categories',alice,{method:'POST',body:JSON.stringify({name:'Invalid',moduleIds:[foreign.id],visibility:'live'})});
    expect(created.status).toBe(422);
    expect(await created.json()).toMatchObject({error:{code:'INVALID_CATEGORY_MODULE'}});
  });

  it('syncs category membership and freezes the subscriber snapshot after unshare',async()=>{
    const alice=await signUp('sync-owner'),bob=await signUp('sync-reader'); await premium('sync-owner');
    const first=await liveModule(alice,'One'),second=await liveModule(alice,'Two');
    const created=await api('/api/categories',alice,{method:'POST',body:JSON.stringify({name:'Initial',moduleIds:[first.id],visibility:'live'})});
    const category=(await created.json() as {category:{id:string;shareToken:string;currentVersion:number}}).category;
    await api(`/api/categories/shared/${category.shareToken}/subscribe`,bob,{method:'POST'});
    const updated=await api(`/api/categories/${category.id}`,alice,{method:'PATCH',body:JSON.stringify({name:'Updated',moduleIds:[second.id,first.id],expectedVersion:category.currentVersion})}); expect(updated.status).toBe(200);
    const sync=await api(`/api/categories/${category.id}/sync`,bob,{method:'POST'}); expect(sync.status).toBe(200); expect(await sync.json()).toMatchObject({updated:true,category:{name:'Updated',moduleIds:[second.id,first.id]}});
    await api(`/api/categories/${category.id}/share`,alice,{method:'POST',body:JSON.stringify({enabled:false})});
    const frozen=await api('/api/categories',bob); expect(await frozen.json()).toMatchObject({categories:[{frozen:true,currentVersion:2}]});
    const noSync=await api(`/api/categories/${category.id}/sync`,bob,{method:'POST'}); expect(await noSync.json()).toMatchObject({updated:false,category:{frozen:true}});
  });

  it('publishes module edits to every affected live category automatically',async()=>{
    const alice=await signUp('update-owner'),bob=await signUp('update-reader'); await premium('update-owner');
    const module=await liveModule(alice,'Original');
    const created=await api('/api/categories',alice,{method:'POST',body:JSON.stringify({name:'Automatic',moduleIds:[module.id],visibility:'live'})});
    const category=(await created.json() as {category:{id:string;shareToken:string}}).category;
    await api(`/api/categories/shared/${category.shareToken}/subscribe`,bob,{method:'POST'});

    const updated=await api(`/api/modules/${module.id}`,alice,{method:'PATCH',body:JSON.stringify({title:'Revised',hash:'hash-revised'})});
    expect(updated.status).toBe(200);
    expect(await api(`/api/categories/${category.id}/sync`,bob,{method:'POST'}).then(response=>response.json()))
      .toMatchObject({updated:true,category:{currentVersion:2,members:[{moduleId:module.id,moduleVersion:2,title:'Revised'}]}});
  });
});
