import type { Auth } from './auth';
import type { Env } from './env';
import { assertWithinQuota, limitsFor, MODULE_LIMITS, ModuleValidationError, validateModuleInput, type ModuleInput } from './module-policy';
import { effectiveTier } from './entitlements';

interface AuthUser { id: string; role?: string; tier?: string }
type ModuleBody = ModuleInput & { visibility?: unknown; enabled?: unknown; expectedRevision?: unknown; clientMutationId?: unknown };

class ModuleConflictError extends ModuleValidationError {
  constructor(public readonly currentModule: ReturnType<typeof fromRow>) {
    super('Module changed on another device. Choose which version to keep.', 409, 'VERSION_CONFLICT');
  }
}

const MUTATIONS_PER_MINUTE = 120;
const json = (body: unknown, status = 200) => Response.json(body, { status });

async function currentUser(auth: Auth, request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user as AuthUser | null;
}

async function enforceMutationRateLimit(env: Env, userId: string) {
  const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
  const row = await env.DB.prepare(`INSERT INTO request_rate_limits (user_id, window_start, request_count)
    VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET
    request_count = CASE WHEN window_start < ? THEN 1 ELSE request_count + 1 END,
    window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END
    RETURNING request_count`).bind(userId, windowStart, windowStart, windowStart).first<{ request_count: number }>();
  if (Number(row?.request_count ?? 1) > MUTATIONS_PER_MINUTE) {
    throw new ModuleValidationError('Too many changes. Try again in a minute.', 429, 'RATE_LIMITED');
  }
}

async function readBody(request: Request): Promise<ModuleBody> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MODULE_LIMITS.uploadBytes) throw new ModuleValidationError('Request exceeds the 2 MB upload limit.', 413, 'MODULE_TOO_LARGE');
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MODULE_LIMITS.uploadBytes) throw new ModuleValidationError('Request exceeds the 2 MB upload limit.', 413, 'MODULE_TOO_LARGE');
    if (!raw.trim()) return {};
    return JSON.parse(raw) as ModuleBody;
  } catch (error) {
    if (error instanceof ModuleValidationError) throw error;
    throw new ModuleValidationError('Request body must be valid JSON.', 400, 'INVALID_JSON');
  }
}

async function usage(env: Env, userId: string) {
  const row = await env.DB.prepare(`SELECT COUNT(*) module_count,
    COALESCE(SUM(CASE WHEN m.owner_id = ? AND m.deleted_at IS NULL THEN v.byte_size ELSE 0 END), 0) used_bytes
    FROM module_library l JOIN modules m ON m.id = l.module_id
    JOIN module_versions v ON v.module_id = l.module_id AND v.version = l.current_version
    WHERE l.user_id = ?`).bind(userId, userId).first<{ module_count: number; used_bytes: number }>();
  return { moduleCount: Number(row?.module_count ?? 0), usedBytes: Number(row?.used_bytes ?? 0) };
}

function fromRow(row: Record<string, unknown>) {
  const currentVersion = Number(row.current_version);
  const latestVersion = Number(row.available_version ?? row.latest_version);
  return {
    id: row.id as string, title: row.title as string, description: row.description ?? undefined,
    categoryId: row.library_category ?? undefined, hash: row.content_hash as string,
    questions: JSON.parse(String(row.questions_json)), ownerId: row.owner_id as string,
    isOwner: Boolean(row.is_owner), visibility: row.visibility as 'private' | 'live',
    shareToken: row.is_owner && row.visibility === 'live' ? row.share_token as string : undefined,
    shareCode: row.visibility === 'live' ? row.share_code as string : undefined,
    subscribed: Boolean(row.subscribed), frozen: Boolean(row.frozen), currentVersion, latestVersion,
    revision: `${currentVersion}:${String(row.library_updated_at ?? '')}:${String(row.library_category ?? '')}`,
  };
}

const librarySelect = `SELECT m.id, m.owner_id, m.visibility, m.share_token, m.share_code, l.category_id library_category,
  l.updated_at library_updated_at,
  l.subscribed, l.current_version, v.title, v.description, v.content_hash, v.questions_json,
  CASE WHEN m.owner_id = ? THEN 1 ELSE 0 END is_owner,
  CASE WHEN l.subscribed = 1 AND (m.visibility <> 'live' OR m.deleted_at IS NOT NULL) THEN 1 ELSE 0 END frozen,
  CASE WHEN m.visibility = 'live' AND m.deleted_at IS NULL THEN m.latest_version ELSE l.current_version END available_version,
  m.latest_version
  FROM module_library l JOIN modules m ON m.id = l.module_id
  JOIN module_versions v ON v.module_id = l.module_id AND v.version = l.current_version`;

async function getLibraryModule(env: Env, userId: string, moduleId: string) {
  return env.DB.prepare(`${librarySelect} WHERE l.user_id = ? AND m.id = ?`).bind(userId, userId, moduleId).first<Record<string, unknown>>();
}

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function createShareCode(env: Env): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(bytes, byte => SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length]).join('');
    const existing = await env.DB.prepare(`SELECT 1 ok FROM modules WHERE share_code = ?
      UNION ALL SELECT 1 ok FROM live_categories WHERE share_code = ? LIMIT 1`).bind(code, code).first();
    if (!existing) return code;
  }
  throw new ModuleValidationError('Could not allocate a share code. Try again.', 503, 'SHARE_CODE_UNAVAILABLE');
}

async function assertExpectedRevision(env: Env, userId: string, moduleId: string, expected: unknown) {
  if (typeof expected !== 'string') return;
  const row = await getLibraryModule(env, userId, moduleId);
  if (!row) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
  const current = fromRow(row);
  if (current.revision !== expected) throw new ModuleConflictError(current);
}

async function listModules(env: Env, userId: string, autoSync = true) {
  if (autoSync) await env.DB.prepare(`UPDATE module_library SET current_version =
    (SELECT latest_version FROM modules WHERE id = module_library.module_id), updated_at = ?
    WHERE user_id = ? AND subscribed = 1 AND EXISTS
    (SELECT 1 FROM modules WHERE id = module_library.module_id AND visibility = 'live' AND deleted_at IS NULL
      AND latest_version > module_library.current_version)`).bind(new Date().toISOString(), userId).run();
  const rows = await env.DB.prepare(`${librarySelect} WHERE l.user_id = ? ORDER BY l.created_at DESC`).bind(userId, userId).all<Record<string, unknown>>();
  return rows.results.map(fromRow);
}

async function publishAffectedCategories(env: Env, ownerId: string, moduleId: string, moduleVersion: number, now: string) {
  const categories = await env.DB.prepare(`SELECT c.id,c.latest_version,v.name
    FROM live_categories c JOIN live_category_versions v
      ON v.category_id=c.id AND v.version=c.latest_version
    WHERE c.owner_id=? AND c.visibility='live' AND c.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM live_category_members cm
        WHERE cm.category_id=c.id AND cm.category_version=c.latest_version AND cm.module_id=?)`)
    .bind(ownerId, moduleId).all<{ id: string; latest_version: number; name: string }>();
  for (const category of categories.results) {
    const current = Number(category.latest_version), next = current + 1;
    const members = await env.DB.prepare(`SELECT position,module_id,module_version FROM live_category_members
      WHERE category_id=? AND category_version=? ORDER BY position`)
      .bind(category.id, current).all<{ position: number; module_id: string; module_version: number }>();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO live_category_versions(category_id,version,name,created_at) VALUES(?,?,?,?)')
        .bind(category.id, next, category.name, now),
      ...members.results.map(member => env.DB.prepare(`INSERT INTO live_category_members
        (category_id,category_version,position,module_id,module_version) VALUES(?,?,?,?,?)`)
        .bind(category.id, next, member.position, member.module_id, member.module_id === moduleId ? moduleVersion : member.module_version)),
      env.DB.prepare(`UPDATE live_categories SET latest_version=?,updated_at=?
        WHERE id=? AND owner_id=? AND latest_version=?`).bind(next, now, category.id, ownerId, current),
      env.DB.prepare(`UPDATE live_category_library SET current_version=?,updated_at=?
        WHERE user_id=? AND category_id=? AND current_version=?`).bind(next, now, ownerId, category.id, current),
    ]);
  }
}

async function publish(env: Env, user: AuthUser, moduleId: string, body: ModuleBody) {
  const source = await env.DB.prepare(`SELECT m.*, v.title current_title, v.description current_description,
    v.content_hash current_hash, v.questions_json current_questions, v.byte_size current_bytes
    FROM modules m JOIN module_versions v ON v.module_id = m.id AND v.version = m.latest_version
    WHERE m.id = ? AND m.owner_id = ? AND m.deleted_at IS NULL`).bind(moduleId, user.id).first<Record<string, unknown>>();
  if (!source) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
  if (source.visibility === 'live' && !limitsFor(user.tier).liveModules) {
    throw new ModuleValidationError('Publishing live modules requires VIP, VIP+, or MVP.', 403, 'PREMIUM_REQUIRED');
  }
  const parsed = validateModuleInput({
    title: body.title ?? source.current_title, description: body.description ?? source.current_description,
    questions: body.questions ?? JSON.parse(String(source.current_questions)),
    hash: body.hash ?? body.contentHash ?? source.current_hash,
    categoryId: null,
  });
  if (!parsed.contentHash) throw new ModuleValidationError('Module content hash is required.');
  const next = Number(source.latest_version) + 1;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE modules SET title = ?, description = ?, content_hash = ?, questions_json = ?, byte_size = ?,
      question_count = ?, latest_version = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND latest_version = ?
      AND COALESCE((SELECT SUM(other.byte_size) FROM modules other
        WHERE other.owner_id = ? AND other.id <> ? AND other.deleted_at IS NULL), 0) + ? <= ?`)
      .bind(parsed.title, parsed.description, parsed.contentHash, parsed.questionsJson, parsed.byteSize, parsed.questionCount, next, now, moduleId, user.id, source.latest_version,
        user.id, moduleId, parsed.byteSize, limitsFor(user.tier).storageBytes),
    env.DB.prepare(`INSERT INTO module_versions
      (module_id, version, title, description, content_hash, questions_json, byte_size, question_count, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`).bind(moduleId, next, parsed.title, parsed.description, parsed.contentHash, parsed.questionsJson, parsed.byteSize, parsed.questionCount, now),
    env.DB.prepare(`UPDATE module_library SET current_version = ?, updated_at = ? WHERE user_id = ? AND module_id = ?
      AND EXISTS (SELECT 1 FROM module_versions WHERE module_id = ? AND version = ?)`)
      .bind(next, now, user.id, moduleId, moduleId, next),
  ]);
  const updated = await getLibraryModule(env, user.id, moduleId);
  if (!updated || Number(updated.current_version) !== next) {
    const stillExists = await env.DB.prepare('SELECT 1 ok FROM modules WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(moduleId, user.id).first();
    if (!stillExists) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
    assertWithinQuota(user.tier, await usage(env, user.id), parsed.byteSize, Number(source.current_bytes));
    throw new ModuleValidationError('Module was updated concurrently. Reload and try again.', 409, 'VERSION_CONFLICT');
  }
  await publishAffectedCategories(env, user.id, moduleId, next, now);
  return fromRow(updated);
}

export async function handleModules(request: Request, env: Env, auth: Auth): Promise<Response> {
  const user = await currentUser(auth, request);
  if (!user) return json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, 401);
  user.tier = await effectiveTier(env.DB, user.id, user.tier);
  const url = new URL(request.url);
  const path = url.pathname.split('/').filter(Boolean).slice(2).map(decodeURIComponent);
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (request.headers.get('origin') !== url.origin) throw new ModuleValidationError('Invalid request origin.', 403, 'INVALID_ORIGIN');
      await enforceMutationRateLimit(env, user.id);
    }

    if (request.method === 'GET' && path.length === 0) return json({
      modules: await listModules(env, user.id), usage: await usage(env, user.id), limits: limitsFor(user.tier),
    });

    if (request.method === 'POST' && path.length === 0) {
      const body = await readBody(request); const parsed = validateModuleInput(body);
      if (body.clientMutationId !== undefined && (typeof body.clientMutationId !== 'string' || body.clientMutationId.length < 1 || body.clientMutationId.length > 100)) {
        throw new ModuleValidationError('Client mutation ID is invalid.', 400, 'INVALID_MUTATION_ID');
      }
      if (typeof body.clientMutationId === 'string') {
        const existing = await env.DB.prepare(`${librarySelect} WHERE l.user_id = ? AND m.owner_id = ? AND m.client_mutation_id = ?`)
          .bind(user.id, user.id, user.id, body.clientMutationId).first<Record<string, unknown>>();
        if (existing) return json({ module: fromRow(existing) });
      }
      if (!parsed.contentHash) throw new ModuleValidationError('Module content hash is required.');
      const visibility = body.visibility === 'live' ? 'live' : 'private';
      if (visibility === 'live' && !limitsFor(user.tier).liveModules) {
        throw new ModuleValidationError('Live module creation requires VIP, VIP+, or MVP.', 403, 'PREMIUM_REQUIRED');
      }
      const stats = await usage(env, user.id); assertWithinQuota(user.tier, stats, parsed.byteSize);
      const id = crypto.randomUUID(); const now = new Date().toISOString();
      const token = visibility === 'live' ? crypto.randomUUID().replaceAll('-', '') : null;
      const shareCode = visibility === 'live' ? await createShareCode(env) : null;
      const deleted = await env.DB.prepare(`SELECT id, latest_version FROM modules
        WHERE owner_id = ? AND content_hash = ? AND deleted_at IS NOT NULL`)
        .bind(user.id, parsed.contentHash).first<{ id: string; latest_version: number }>();
      if (deleted) {
        const next = Number(deleted.latest_version) + 1;
        await env.DB.batch([
          env.DB.prepare(`UPDATE modules SET title=?, description=?, category_id=NULL, content_version=?, questions_json=?,
            byte_size=?, question_count=?, visibility=?, share_token=?, share_code=?, latest_version=?, client_mutation_id=?, deleted_at=NULL, updated_at=?
            WHERE id=? AND owner_id=? AND deleted_at IS NOT NULL`)
            .bind(parsed.title, parsed.description, next, parsed.questionsJson, parsed.byteSize, parsed.questionCount,
              visibility, token, shareCode, next, body.clientMutationId ?? null, now, deleted.id, user.id),
          env.DB.prepare(`INSERT INTO module_versions
            (module_id,version,title,description,content_hash,questions_json,byte_size,question_count,created_at)
            SELECT ?,?,?,?,?,?,?,?,? WHERE changes() > 0`)
            .bind(deleted.id, next, parsed.title, parsed.description, parsed.contentHash, parsed.questionsJson,
              parsed.byteSize, parsed.questionCount, now),
          env.DB.prepare(`INSERT INTO module_library
            (user_id,module_id,current_version,category_id,subscribed,created_at,updated_at)
            SELECT ?,?,?,?,0,?,? WHERE changes() > 0`)
            .bind(user.id, deleted.id, next, parsed.categoryId, now, now),
        ]);
        const restored = await getLibraryModule(env, user.id, deleted.id);
        if (!restored) throw new ModuleValidationError('Module could not be restored. Reload and try again.', 409, 'RESTORE_CONFLICT');
        return json({ module: fromRow(restored) }, 201);
      }
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO modules
          (id, owner_id, title, description, content_hash, content_version, questions_json, byte_size, question_count,
           created_at, updated_at, visibility, share_token, share_code, latest_version, client_mutation_id)
          SELECT ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?
          WHERE (SELECT COUNT(*) FROM module_library WHERE user_id = ?) < ?
          AND (SELECT COALESCE(SUM(byte_size),0) FROM modules WHERE owner_id = ? AND deleted_at IS NULL) + ? <= ?`)
          .bind(id, user.id, parsed.title, parsed.description, parsed.contentHash, parsed.questionsJson, parsed.byteSize,
            parsed.questionCount, now, now, visibility, token, shareCode, body.clientMutationId ?? null,
            user.id, limitsFor(user.tier).modules, user.id, parsed.byteSize, limitsFor(user.tier).storageBytes),
        env.DB.prepare(`INSERT INTO module_versions SELECT ?, 1, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`)
          .bind(id, parsed.title, parsed.description, parsed.contentHash, parsed.questionsJson, parsed.byteSize, parsed.questionCount, now),
        env.DB.prepare(`INSERT INTO module_library SELECT ?, ?, 1, ?, 0, ?, ? WHERE changes() > 0`)
          .bind(user.id, id, parsed.categoryId, now, now),
      ]);
      const row = await getLibraryModule(env, user.id, id);
      if (!row) { assertWithinQuota(user.tier, await usage(env, user.id), parsed.byteSize); throw new ModuleValidationError('Module could not be created.', 409, 'MODULE_QUOTA_REACHED'); }
      return json({ module: fromRow(row) }, 201);
    }

    if (path[0] === 'shared' && path[1]) {
      const shareIdentifier = path[1].toUpperCase();
      const source = await env.DB.prepare(`SELECT m.id, m.owner_id, m.visibility, m.latest_version current_version,
        m.latest_version available_version, 0 subscribed, 0 is_owner, 0 frozen, NULL library_category,
        m.share_code, v.title, v.description, v.content_hash, v.questions_json
        FROM modules m JOIN module_versions v ON v.module_id = m.id AND v.version = m.latest_version
        WHERE (m.share_token = ? OR m.share_code = ?) AND m.visibility = 'live' AND m.deleted_at IS NULL`).bind(path[1], shareIdentifier).first<Record<string, unknown>>();
      if (!source) throw new ModuleValidationError('Share link is invalid or no longer active.', 404, 'SHARE_NOT_FOUND');
      if (request.method === 'GET' && path.length === 2) return json({ module: fromRow(source) });
      if (request.method === 'POST' && path[2] === 'subscribe') {
        if (source.owner_id === user.id) throw new ModuleValidationError('You already own this module.', 409, 'ALREADY_OWNED');
        const now = new Date().toISOString();
        let inserted;
        try { inserted = await env.DB.prepare(`INSERT INTO module_library
          (user_id,module_id,current_version,subscribed,created_at,updated_at)
          SELECT ?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM module_library WHERE user_id = ?) < ?`)
          .bind(user.id, source.id, source.current_version, now, now, user.id, limitsFor(user.tier).modules).run(); }
        catch (error) { if (error instanceof Error && error.message.includes('UNIQUE')) throw new ModuleValidationError('Already subscribed.', 409, 'ALREADY_SUBSCRIBED'); throw error; }
        if (!inserted.meta.changes) throw new ModuleValidationError('Module count quota reached.', 409, 'MODULE_QUOTA_REACHED');
        return json({ module: fromRow((await getLibraryModule(env, user.id, String(source.id)))!) }, 201);
      }
    }

    const moduleId = path[0];
    if (!moduleId) throw new ModuleValidationError('Not found.', 404, 'NOT_FOUND');
    if (request.method === 'GET' && path.length === 1) {
      const row = await getLibraryModule(env, user.id, moduleId);
      return row ? json({ module: fromRow(row) }) : json({ error: { code: 'NOT_FOUND', message: 'Module not found.' } }, 404);
    }
    if (request.method === 'PATCH' && path.length === 1) {
      const body = await readBody(request);
      await assertExpectedRevision(env, user.id, moduleId, body.expectedRevision);
      if (body.categoryId !== undefined || body.category_id !== undefined) {
        const category = body.categoryId ?? body.category_id;
        if (category !== null && typeof category !== 'string') throw new ModuleValidationError('Category must be text.');
        if (typeof category === 'string' && category.length > MODULE_LIMITS.categoryLength) throw new ModuleValidationError('Category is too long.');
        const result = await env.DB.prepare('UPDATE module_library SET category_id = ?, updated_at = ? WHERE user_id = ? AND module_id = ?')
          .bind(category, new Date().toISOString(), user.id, moduleId).run();
        if (!result.meta.changes) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
      }
      const contentChange = body.title !== undefined || body.description !== undefined || body.questions !== undefined || body.hash !== undefined;
      const module = contentChange ? await publish(env, user, moduleId, body) : fromRow((await getLibraryModule(env, user.id, moduleId))!);
      return json({ module });
    }
    if (request.method === 'POST' && path[1] === 'publish') return json({ module: await publish(env, user, moduleId, await readBody(request)) });
    if (request.method === 'POST' && path[1] === 'share') {
      const body = await readBody(request); const enabled = body.enabled === true; const token = enabled ? crypto.randomUUID().replaceAll('-', '') : null;
      if (enabled && !limitsFor(user.tier).liveModules) {
        throw new ModuleValidationError('Live module creation requires VIP, VIP+, or MVP.', 403, 'PREMIUM_REQUIRED');
      }
      const shareCode = enabled ? await createShareCode(env) : null;
      const result = await env.DB.prepare(`UPDATE modules SET visibility = ?, share_token = ?, share_code = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`).bind(enabled ? 'live' : 'private', token, shareCode, new Date().toISOString(), moduleId, user.id).run();
      if (!result.meta.changes) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
      return json({ module: fromRow((await getLibraryModule(env, user.id, moduleId))!) });
    }
    if (request.method === 'POST' && path[1] === 'sync') {
      const result = await env.DB.prepare(`UPDATE module_library SET current_version =
        (SELECT latest_version FROM modules WHERE id = module_library.module_id), updated_at = ?
        WHERE user_id = ? AND module_id = ? AND subscribed = 1 AND EXISTS
        (SELECT 1 FROM modules WHERE id = ? AND visibility = 'live' AND deleted_at IS NULL)`)
        .bind(new Date().toISOString(), user.id, moduleId, moduleId).run();
      const row = await getLibraryModule(env, user.id, moduleId);
      if (!row) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
      return json({ module: fromRow(row), updated: result.meta.changes > 0 });
    }
    if (request.method === 'POST' && moduleId === 'sync' && path.length === 1) {
      const before = await listModules(env, user.id, false); const modules = await listModules(env, user.id, true);
      const versions = new Map(before.map(item => [item.id, item.currentVersion]));
      return json({ modules, updated: modules.filter(item => versions.get(item.id) !== item.currentVersion).length });
    }
    if (request.method === 'DELETE' && path.length === 1) {
      const body = await readBody(request);
      await assertExpectedRevision(env, user.id, moduleId, body.expectedRevision);
      const row = await getLibraryModule(env, user.id, moduleId);
      if (!row) throw new ModuleValidationError('Module not found.', 404, 'NOT_FOUND');
      if (row.owner_id === user.id) await env.DB.batch([
        env.DB.prepare(`UPDATE modules SET visibility='private', share_token=NULL, share_code=NULL, deleted_at=?, updated_at=? WHERE id=? AND owner_id=?`)
          .bind(new Date().toISOString(), new Date().toISOString(), moduleId, user.id),
        env.DB.prepare('DELETE FROM module_library WHERE user_id=? AND module_id=?').bind(user.id, moduleId),
      ]);
      else await env.DB.prepare('DELETE FROM module_library WHERE user_id=? AND module_id=?').bind(user.id, moduleId).run();
      return new Response(null, { status: 204 });
    }
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }, 405);
  } catch (error) {
    if (error instanceof ModuleConflictError) return json({ error: { code: error.code, message: error.message, currentModule: error.currentModule } }, error.status);
    if (error instanceof ModuleValidationError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return json({ error: { code: 'DUPLICATE_MODULE', message: 'This module already exists.' } }, 409);
    console.error(error); return json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } }, 500);
  }
}
