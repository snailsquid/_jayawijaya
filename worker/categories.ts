import type { Auth } from './auth';
import type { Env } from './env';
import { CATEGORY_LIMITS, validateCategoryInput, type CategoryInput } from './category-policy';
import { effectiveTier } from './entitlements';
import { limitsFor, ModuleValidationError } from './module-policy';

interface AuthUser { id: string; tier?: string }
type CategoryBody = CategoryInput & { enabled?: unknown; expectedVersion?: unknown; visibility?: unknown };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function currentUser(auth: Auth, request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user as AuthUser | null;
}

async function readBody(request: Request): Promise<CategoryBody> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > CATEGORY_LIMITS.bodyBytes) {
    throw new ModuleValidationError('Category request is too large.', 413, 'CATEGORY_TOO_LARGE');
  }
  try { return raw.trim() ? JSON.parse(raw) as CategoryBody : {}; }
  catch { throw new ModuleValidationError('Request body must be valid JSON.', 400, 'INVALID_JSON'); }
}

async function rateLimit(env: Env, userId: string) {
  const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
  const row = await env.DB.prepare(`INSERT INTO request_rate_limits (user_id, window_start, request_count)
    VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET
    request_count = CASE WHEN window_start < ? THEN 1 ELSE request_count + 1 END,
    window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END
    RETURNING request_count`).bind(userId, windowStart, windowStart, windowStart).first<{ request_count: number }>();
  if (Number(row?.request_count ?? 1) > 120) throw new ModuleValidationError('Too many changes. Try again in a minute.', 429, 'RATE_LIMITED');
}

async function createShareCode(env: Env) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(bytes, byte => SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length]).join('');
    if (!await env.DB.prepare(`SELECT 1 ok FROM live_categories WHERE share_code = ?
      UNION ALL SELECT 1 ok FROM modules WHERE share_code = ? LIMIT 1`).bind(code, code).first()) return code;
  }
  throw new ModuleValidationError('Could not allocate a share code. Try again.', 503, 'SHARE_CODE_UNAVAILABLE');
}

async function members(env: Env, categoryId: string, version: number) {
  const rows = await env.DB.prepare(`SELECT cm.module_id, cm.module_version, v.title, v.question_count
    FROM live_category_members cm JOIN module_versions v ON v.module_id=cm.module_id AND v.version=cm.module_version
    WHERE cm.category_id=? AND cm.category_version=? ORDER BY cm.position`).bind(categoryId, version).all<Record<string, unknown>>();
  return rows.results.map(row => ({ moduleId: String(row.module_id), moduleVersion: Number(row.module_version), title: String(row.title), questionCount: Number(row.question_count) }));
}

async function fromRow(env: Env, row: Record<string, unknown>) {
  const currentVersion = Number(row.current_version);
  const availableVersion = Number(row.available_version ?? row.latest_version);
  const items = await members(env, String(row.id), currentVersion);
  return {
    id: String(row.id), name: String(row.name), moduleIds: items.map(item => item.moduleId), members: items,
    ownerId: String(row.owner_id), isOwner: Boolean(row.is_owner), visibility: row.visibility as 'private' | 'live',
    shareToken: row.is_owner && row.visibility === 'live' ? String(row.share_token) : undefined,
    shareCode: row.visibility === 'live' ? String(row.share_code) : undefined,
    subscribed: Boolean(row.subscribed), frozen: Boolean(row.frozen), currentVersion, latestVersion: availableVersion,
    localCategoryId: String(row.local_category_id),
  };
}

const categorySelect = `SELECT c.id,c.owner_id,c.visibility,c.share_token,c.share_code,c.latest_version,
  l.current_version,l.local_category_id,l.subscribed,v.name,
  CASE WHEN c.owner_id=? THEN 1 ELSE 0 END is_owner,
  CASE WHEN l.subscribed=1 AND (c.visibility<>'live' OR c.deleted_at IS NOT NULL) THEN 1 ELSE 0 END frozen,
  CASE WHEN c.visibility='live' AND c.deleted_at IS NULL THEN c.latest_version ELSE l.current_version END available_version
  FROM live_category_library l JOIN live_categories c ON c.id=l.category_id
  JOIN live_category_versions v ON v.category_id=c.id AND v.version=l.current_version`;

async function getCategory(env: Env, userId: string, categoryId: string) {
  return env.DB.prepare(`${categorySelect} WHERE l.user_id=? AND c.id=?`).bind(userId, userId, categoryId).first<Record<string, unknown>>();
}

async function validateOwnedModules(env: Env, ownerId: string, moduleIds: string[], requireLive = false) {
  const placeholders = moduleIds.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT id,latest_version FROM modules WHERE owner_id=? AND deleted_at IS NULL
    ${requireLive ? "AND visibility='live'" : ''} AND id IN (${placeholders})`)
    .bind(ownerId, ...moduleIds).all<{ id: string; latest_version: number }>();
  const versions = new Map(rows.results.map(row => [row.id, Number(row.latest_version)]));
  if (versions.size !== moduleIds.length) throw new ModuleValidationError(requireLive
    ? 'A shared category can only contain your currently live modules.'
    : 'Categories can only contain your active modules.', 422, 'INVALID_CATEGORY_MODULE');
  return versions;
}

async function insertVersion(env: Env, categoryId: string, version: number, name: string, moduleIds: string[], versions: Map<string, number>, now: string) {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO live_category_versions(category_id,version,name,created_at) VALUES(?,?,?,?)').bind(categoryId, version, name, now),
    ...moduleIds.map((moduleId, position) => env.DB.prepare(`INSERT INTO live_category_members
      (category_id,category_version,position,module_id,module_version) VALUES(?,?,?,?,?)`)
      .bind(categoryId, version, position, moduleId, versions.get(moduleId))),
  ]);
}

async function syncCategory(env: Env, user: AuthUser, categoryId: string) {
  const before = await getCategory(env, user.id, categoryId);
  if (!before) throw new ModuleValidationError('Category not found.', 404, 'NOT_FOUND');
  if (!before.subscribed) return { category: await fromRow(env, before), updated: false };
  const source = await env.DB.prepare(`SELECT latest_version FROM live_categories
    WHERE id=? AND visibility='live' AND deleted_at IS NULL`).bind(categoryId).first<{ latest_version: number }>();
  if (!source || Number(source.latest_version) <= Number(before.current_version)) return { category: await fromRow(env, before), updated: false };
  const target = await members(env, categoryId, Number(source.latest_version));
  const existing = await env.DB.prepare('SELECT module_id FROM module_library WHERE user_id=?').bind(user.id).all<{ module_id: string }>();
  const existingIds = new Set(existing.results.map(row => row.module_id));
  const incoming = target.filter(item => !existingIds.has(item.moduleId)).length;
  const now = new Date().toISOString();
  const guard = await env.DB.prepare(`UPDATE live_category_library SET current_version=?,updated_at=?
    WHERE user_id=? AND category_id=? AND current_version=?
    AND (SELECT COUNT(*) FROM module_library WHERE user_id=?) + ? <= ?`)
    .bind(source.latest_version, now, user.id, categoryId, before.current_version, user.id, incoming, limitsFor(user.tier).modules).run();
  if (!guard.meta.changes) {
    const current = await getCategory(env, user.id, categoryId);
    if (current && Number(current.current_version) === Number(source.latest_version)) return { category: await fromRow(env, current), updated: false };
    throw new ModuleValidationError('Module count quota reached.', 409, 'MODULE_QUOTA_REACHED');
  }
  const targetIds = new Set(target.map(item => item.moduleId));
  const oldLinks = await env.DB.prepare('SELECT module_id FROM live_category_library_modules WHERE user_id=? AND category_id=?')
    .bind(user.id, categoryId).all<{ module_id: string }>();
  await env.DB.batch([
    ...target.map(item => env.DB.prepare(`INSERT INTO module_library(user_id,module_id,current_version,category_id,subscribed,created_at,updated_at)
      VALUES(?,?,?,?,0,?,?) ON CONFLICT(user_id,module_id) DO UPDATE SET current_version=MAX(module_library.current_version,excluded.current_version),
      category_id=excluded.category_id,updated_at=excluded.updated_at
      WHERE module_library.subscribed=0 AND NOT EXISTS (SELECT 1 FROM modules m WHERE m.id=excluded.module_id AND m.owner_id=excluded.user_id)`)
      .bind(user.id, item.moduleId, item.moduleVersion, before.local_category_id, now, now)),
    env.DB.prepare('DELETE FROM live_category_library_modules WHERE user_id=? AND category_id=?').bind(user.id, categoryId),
    ...target.map(item => env.DB.prepare('INSERT INTO live_category_library_modules(user_id,category_id,module_id) VALUES(?,?,?)').bind(user.id, categoryId, item.moduleId)),
    ...oldLinks.results.filter(link => !targetIds.has(link.module_id)).map(link => env.DB.prepare(`DELETE FROM module_library WHERE user_id=? AND module_id=? AND subscribed=0
      AND NOT EXISTS (SELECT 1 FROM live_category_library_modules x WHERE x.user_id=? AND x.module_id=? AND x.category_id<>?)
      AND NOT EXISTS (SELECT 1 FROM modules m WHERE m.id=? AND m.owner_id=?)`)
      .bind(user.id, link.module_id, user.id, link.module_id, categoryId, link.module_id, user.id)),
  ]);
  return { category: await fromRow(env, (await getCategory(env, user.id, categoryId))!), updated: true };
}

export async function handleCategories(request: Request, env: Env, auth: Auth): Promise<Response> {
  const user = await currentUser(auth, request);
  if (!user) return json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, 401);
  user.tier = await effectiveTier(env.DB, user.id, user.tier);
  const url = new URL(request.url);
  const path = url.pathname.split('/').filter(Boolean).slice(2).map(decodeURIComponent);
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (request.headers.get('origin') !== url.origin) throw new ModuleValidationError('Invalid request origin.', 403, 'INVALID_ORIGIN');
      await rateLimit(env, user.id);
    }
    if (request.method === 'GET' && path.length === 0) {
      const rows = await env.DB.prepare(`${categorySelect} WHERE l.user_id=? ORDER BY l.created_at DESC`).bind(user.id, user.id).all<Record<string, unknown>>();
      return json({ categories: await Promise.all(rows.results.map(row => fromRow(env, row))) });
    }
    if (request.method === 'POST' && path.length === 0) {
      const rawBody = await readBody(request);
      const input = validateCategoryInput(rawBody);
      if (input.clientMutationId) {
        const existing = await env.DB.prepare(`${categorySelect} WHERE l.user_id=? AND c.owner_id=? AND c.client_mutation_id=?`)
          .bind(user.id, user.id, user.id, input.clientMutationId).first<Record<string, unknown>>();
        if (existing) return json({ category: await fromRow(env, existing) });
      }
      const wantsLive = rawBody.visibility === 'live';
      if (wantsLive && !limitsFor(user.tier).liveModules) throw new ModuleValidationError('Sharing live categories requires VIP, VIP+, or MVP.', 403, 'PREMIUM_REQUIRED');
      const versions = await validateOwnedModules(env, user.id, input.moduleIds, wantsLive);
      const id = crypto.randomUUID(), now = new Date().toISOString(), localId = input.localCategoryId ?? crypto.randomUUID();
      const token = wantsLive ? crypto.randomUUID().replaceAll('-', '') : null, code = wantsLive ? await createShareCode(env) : null;
      await env.DB.prepare(`INSERT INTO live_categories(id,owner_id,visibility,share_token,share_code,latest_version,client_mutation_id,created_at,updated_at)
        VALUES(?,?,?,?,?,1,?,?,?)`).bind(id,user.id,wantsLive?'live':'private',token,code,input.clientMutationId??null,now,now).run();
      await insertVersion(env,id,1,input.name,input.moduleIds,versions,now);
      await env.DB.prepare(`INSERT INTO live_category_library(user_id,category_id,current_version,local_category_id,subscribed,created_at,updated_at)
        VALUES(?,?,1,?,0,?,?)`).bind(user.id,id,localId,now,now).run();
      return json({ category: await fromRow(env,(await getCategory(env,user.id,id))!) },201);
    }
    if (path[0] === 'shared' && path[1]) {
      const source = await env.DB.prepare(`SELECT c.id,c.owner_id,c.visibility,c.share_token,c.share_code,c.latest_version current_version,
        c.latest_version available_version,c.latest_version,0 subscribed,0 is_owner,0 frozen,c.id local_category_id,v.name
        FROM live_categories c JOIN live_category_versions v ON v.category_id=c.id AND v.version=c.latest_version
        WHERE (c.share_token=? OR c.share_code=?) AND c.visibility='live' AND c.deleted_at IS NULL`)
        .bind(path[1],path[1].toUpperCase()).first<Record<string,unknown>>();
      if (!source) throw new ModuleValidationError('Category share link is invalid or no longer active.',404,'SHARE_NOT_FOUND');
      if (request.method === 'GET' && path.length === 2) return json({ category: await fromRow(env,source) });
      if (request.method === 'POST' && path[2] === 'subscribe') {
        if (source.owner_id === user.id) throw new ModuleValidationError('You already own this category.',409,'ALREADY_OWNED');
        const existingCategory = await getCategory(env,user.id,String(source.id));
        if (existingCategory) return json({ category: await fromRow(env,existingCategory) });
        const target = await members(env,String(source.id),Number(source.latest_version));
        const existingModules = await env.DB.prepare('SELECT module_id FROM module_library WHERE user_id=?').bind(user.id).all<{module_id:string}>();
        const existingIds = new Set(existingModules.results.map(row=>row.module_id));
        const incoming = target.filter(item=>!existingIds.has(item.moduleId)).length;
        const now=new Date().toISOString(),localId=crypto.randomUUID();
        const results = await env.DB.batch([
          env.DB.prepare(`INSERT INTO live_category_library(user_id,category_id,current_version,local_category_id,subscribed,created_at,updated_at)
            SELECT ?,?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM module_library WHERE user_id=?)+?<=?`)
            .bind(user.id,source.id,source.latest_version,localId,now,now,user.id,incoming,limitsFor(user.tier).modules),
          ...target.map(item=>env.DB.prepare(`INSERT INTO module_library(user_id,module_id,current_version,category_id,subscribed,created_at,updated_at)
            SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM live_category_library WHERE user_id=? AND category_id=?)
            ON CONFLICT(user_id,module_id) DO UPDATE SET
              current_version=CASE WHEN module_library.subscribed=0 AND NOT EXISTS
                (SELECT 1 FROM modules m WHERE m.id=excluded.module_id AND m.owner_id=excluded.user_id)
                THEN MAX(module_library.current_version,excluded.current_version) ELSE module_library.current_version END,
              category_id=excluded.category_id,updated_at=excluded.updated_at`)
            .bind(user.id,item.moduleId,item.moduleVersion,localId,0,now,now,user.id,source.id)),
          ...target.map(item=>env.DB.prepare(`INSERT INTO live_category_library_modules(user_id,category_id,module_id)
            SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM live_category_library WHERE user_id=? AND category_id=?)`)
            .bind(user.id,source.id,item.moduleId,user.id,source.id)),
        ]);
        const inserted = results[0];
        if (!inserted.meta.changes) throw new ModuleValidationError('Module count quota reached.',409,'MODULE_QUOTA_REACHED');
        return json({ category: await fromRow(env,(await getCategory(env,user.id,String(source.id)))!) },201);
      }
    }
    const categoryId=path[0];
    if (!categoryId) throw new ModuleValidationError('Not found.',404,'NOT_FOUND');
    if (request.method==='GET' && path.length===1) { const row=await getCategory(env,user.id,categoryId); return row?json({category:await fromRow(env,row)}):json({error:{code:'NOT_FOUND',message:'Category not found.'}},404); }
    if (request.method==='PATCH' && path.length===1) {
      const body=await readBody(request), input=validateCategoryInput(body), current=await getCategory(env,user.id,categoryId);
      if (!current || current.owner_id!==user.id) throw new ModuleValidationError('Category not found.',404,'NOT_FOUND');
      if (body.expectedVersion!==undefined && Number(body.expectedVersion)!==Number(current.current_version)) throw new ModuleValidationError('Category changed on another device.',409,'VERSION_CONFLICT');
      const versions=await validateOwnedModules(env,user.id,input.moduleIds,current.visibility==='live'), next=Number(current.current_version)+1, now=new Date().toISOString();
      await insertVersion(env,categoryId,next,input.name,input.moduleIds,versions,now);
      const updated=await env.DB.prepare('UPDATE live_categories SET latest_version=?,updated_at=? WHERE id=? AND owner_id=? AND latest_version=?')
        .bind(next,now,categoryId,user.id,current.current_version).run();
      if (!updated.meta.changes) throw new ModuleValidationError('Category changed on another device.',409,'VERSION_CONFLICT');
      await env.DB.prepare('UPDATE live_category_library SET current_version=?,updated_at=? WHERE user_id=? AND category_id=?').bind(next,now,user.id,categoryId).run();
      return json({category:await fromRow(env,(await getCategory(env,user.id,categoryId))!)});
    }
    if (request.method==='POST' && path[1]==='share') {
      const enabled=(await readBody(request)).enabled===true;
      if (enabled&&!limitsFor(user.tier).liveModules) throw new ModuleValidationError('Sharing live categories requires VIP, VIP+, or MVP.',403,'PREMIUM_REQUIRED');
      if (enabled) {
        const current = await getCategory(env,user.id,categoryId);
        if (!current || current.owner_id!==user.id) throw new ModuleValidationError('Category not found.',404,'NOT_FOUND');
        await validateOwnedModules(env,user.id,(await members(env,categoryId,Number(current.current_version))).map(item=>item.moduleId),true);
      }
      const result=await env.DB.prepare(`UPDATE live_categories SET visibility=?,share_token=?,share_code=?,updated_at=?
        WHERE id=? AND owner_id=? AND deleted_at IS NULL`).bind(enabled?'live':'private',enabled?crypto.randomUUID().replaceAll('-',''):null,enabled?await createShareCode(env):null,new Date().toISOString(),categoryId,user.id).run();
      if (!result.meta.changes) throw new ModuleValidationError('Category not found.',404,'NOT_FOUND');
      return json({category:await fromRow(env,(await getCategory(env,user.id,categoryId))!)});
    }
    if (request.method==='POST'&&path[1]==='sync') return json(await syncCategory(env,user,categoryId));
    if (request.method==='DELETE'&&path.length===1) {
      const row=await getCategory(env,user.id,categoryId); if(!row) throw new ModuleValidationError('Category not found.',404,'NOT_FOUND');
      if(row.owner_id===user.id) await env.DB.batch([
        env.DB.prepare(`UPDATE live_categories SET visibility='private',share_token=NULL,share_code=NULL,deleted_at=?,updated_at=? WHERE id=? AND owner_id=?`).bind(new Date().toISOString(),new Date().toISOString(),categoryId,user.id),
        env.DB.prepare('DELETE FROM live_category_library WHERE user_id=? AND category_id=?').bind(user.id,categoryId),
      ]); else await env.DB.prepare('DELETE FROM live_category_library WHERE user_id=? AND category_id=?').bind(user.id,categoryId).run();
      return new Response(null,{status:204});
    }
    return json({error:{code:'METHOD_NOT_ALLOWED',message:'Method not allowed.'}},405);
  } catch(error) {
    if(error instanceof ModuleValidationError) return json({error:{code:error.code,message:error.message}},error.status);
    if(error instanceof Error&&error.message.includes('UNIQUE')) return json({error:{code:'DUPLICATE_CATEGORY',message:'This category already exists.'}},409);
    console.error(error); return json({error:{code:'INTERNAL_ERROR',message:'Something went wrong.'}},500);
  }
}
