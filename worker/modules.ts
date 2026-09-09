import type { Auth } from './auth';
import type { Env } from './env';
import { assertWithinQuota, ModuleValidationError, validateModuleInput, type ModuleInput } from './module-policy';

interface AuthUser { id: string; role?: string; tier?: string }

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

// A full-account bulk category/delete operation can legitimately issue 100 mutations.
const MUTATIONS_PER_MINUTE = 120;

async function enforceMutationRateLimit(env: Env, userId: string) {
  const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
  const row = await env.DB.prepare(`INSERT INTO request_rate_limits (user_id, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET
      request_count = CASE WHEN window_start < ? THEN 1 ELSE request_count + 1 END,
      window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END
    RETURNING request_count`)
    .bind(userId, windowStart, windowStart, windowStart).first<{ request_count: number }>();
  if (Number(row?.request_count ?? 1) > MUTATIONS_PER_MINUTE) {
    throw new ModuleValidationError('Too many changes. Try again in a minute.', 429, 'RATE_LIMITED');
  }
}

async function currentUser(auth: Auth, request: Request): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user as AuthUser | null;
}

async function usage(env: Env, ownerId: string) {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS module_count, COALESCE(SUM(byte_size), 0) AS used_bytes FROM modules WHERE owner_id = ?',
  ).bind(ownerId).first<{ module_count: number; used_bytes: number }>();
  return { moduleCount: Number(row?.module_count ?? 0), usedBytes: Number(row?.used_bytes ?? 0) };
}

function fromRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    categoryId: row.category_id ?? undefined,
    hash: row.content_hash,
    questions: JSON.parse(String(row.questions_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readBody(request: Request): Promise<ModuleInput> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > 2 * 1024 * 1024) {
    throw new ModuleValidationError('Request exceeds the 2 MB upload limit.', 413, 'MODULE_TOO_LARGE');
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2 * 1024 * 1024) {
      throw new ModuleValidationError('Request exceeds the 2 MB upload limit.', 413, 'MODULE_TOO_LARGE');
    }
    return JSON.parse(raw) as ModuleInput;
  } catch (error) {
    if (error instanceof ModuleValidationError) throw error;
    throw new ModuleValidationError('Request body must be valid JSON.', 400, 'INVALID_JSON');
  }
}

export async function handleModules(request: Request, env: Env, auth: Auth): Promise<Response> {
  const user = await currentUser(auth, request);
  if (!user) return json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, 401);

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/modules(?:\/([^/]+))?$/);
  if (!match) return json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);
  const moduleId = match[1] ? decodeURIComponent(match[1]) : null;

  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (request.headers.get('origin') !== url.origin) {
        throw new ModuleValidationError('Invalid request origin.', 403, 'INVALID_ORIGIN');
      }
      await enforceMutationRateLimit(env, user.id);
    }

    if (request.method === 'GET' && !moduleId) {
      const result = await env.DB.prepare('SELECT * FROM modules WHERE owner_id = ? ORDER BY created_at DESC')
        .bind(user.id).all<Record<string, unknown>>();
      return json({ modules: result.results.map(fromRow), usage: await usage(env, user.id) });
    }

    if (request.method === 'GET' && moduleId) {
      const row = await env.DB.prepare('SELECT * FROM modules WHERE id = ? AND owner_id = ?')
        .bind(moduleId, user.id).first<Record<string, unknown>>();
      return row ? json({ module: fromRow(row) }) : json({ error: { code: 'NOT_FOUND', message: 'Module not found.' } }, 404);
    }

    if (request.method === 'POST' && !moduleId) {
      const parsed = validateModuleInput(await readBody(request));
      if (!parsed.contentHash) throw new ModuleValidationError('Module content hash is required.');
      assertWithinQuota(user.tier, await usage(env, user.id), parsed.byteSize);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO modules
        (id, owner_id, title, description, category_id, content_hash, content_version, questions_json, byte_size, question_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`)
        .bind(id, user.id, parsed.title, parsed.description, parsed.categoryId, parsed.contentHash,
          parsed.questionsJson, parsed.byteSize, parsed.questionCount, now, now).run();
      const row = await env.DB.prepare('SELECT * FROM modules WHERE id = ? AND owner_id = ?').bind(id, user.id).first<Record<string, unknown>>();
      return json({ module: fromRow(row!) }, 201);
    }

    if (request.method === 'PATCH' && moduleId) {
      const existing = await env.DB.prepare('SELECT * FROM modules WHERE id = ? AND owner_id = ?')
        .bind(moduleId, user.id).first<Record<string, unknown>>();
      if (!existing) return json({ error: { code: 'NOT_FOUND', message: 'Module not found.' } }, 404);
      const original = fromRow(existing);
      const body = await readBody(request);
      const parsed = validateModuleInput({ ...original, ...body, ownerId: undefined, owner_id: undefined });
      if (!parsed.contentHash) parsed.contentHash = String(existing.content_hash);
      assertWithinQuota(user.tier, await usage(env, user.id), parsed.byteSize, Number(existing.byte_size));
      await env.DB.prepare(`UPDATE modules SET title = ?, description = ?, category_id = ?, content_hash = ?,
        questions_json = ?, byte_size = ?, question_count = ?, updated_at = ? WHERE id = ? AND owner_id = ?`)
        .bind(parsed.title, parsed.description, parsed.categoryId, parsed.contentHash, parsed.questionsJson,
          parsed.byteSize, parsed.questionCount, new Date().toISOString(), moduleId, user.id).run();
      const row = await env.DB.prepare('SELECT * FROM modules WHERE id = ? AND owner_id = ?').bind(moduleId, user.id).first<Record<string, unknown>>();
      return json({ module: fromRow(row!) });
    }

    if (request.method === 'DELETE' && moduleId) {
      const result = await env.DB.prepare('DELETE FROM modules WHERE id = ? AND owner_id = ?').bind(moduleId, user.id).run();
      return result.meta.changes > 0 ? new Response(null, { status: 204 }) : json({ error: { code: 'NOT_FOUND', message: 'Module not found.' } }, 404);
    }

    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }, 405);
  } catch (error) {
    if (error instanceof ModuleValidationError) {
      return json({ error: { code: error.code, message: error.message } }, error.status);
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return json({ error: { code: 'DUPLICATE_MODULE', message: 'This module has already been uploaded.' } }, 409);
    }
    console.error(error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } }, 500);
  }
}
