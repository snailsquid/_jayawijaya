import { beforeEach, describe, expect, it } from 'vitest';
import { applyD1Migrations, env, reset, SELF, type D1Migration } from 'cloudflare:test';
import { MODULE_LIMITS } from '../../worker/module-policy';

declare module 'cloudflare:test' {
  interface ProvidedEnv { DB: D1Database; TEST_MIGRATIONS: D1Migration[] }
}

async function signUp(identity: string, extra: Record<string, unknown> = {}) {
  const response = await SELF.fetch('http://example.test/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: identity, email: `${identity}@example.test`, password: 'secure-password-123', ...extra }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

const moduleBody = {
  title: 'Liver', hash: 'hash-1',
  questions: [{ question: 'Q?', answers: ['A', 'B'], correct_answer: 1 }],
};

const moduleBytes = (body: typeof moduleBody) => new TextEncoder().encode(JSON.stringify(body.questions)).byteLength;

async function insertModule(ownerId: string, id: string, hash: string, byteSize: number, questions = moduleBody.questions) {
  await env.DB.prepare(`INSERT INTO modules
    (id, owner_id, title, content_hash, questions_json, byte_size, question_count, created_at, updated_at)
    VALUES (?, ?, 'Seed', ?, ?, ?, 1, 'now', 'now')`)
    .bind(id, ownerId, hash, JSON.stringify(questions), byteSize).run();
}

async function api(path: string, cookie?: string, init: RequestInit = {}) {
  return SELF.fetch(`http://example.test${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', origin: 'http://example.test', ...(cookie ? { cookie } : {}), ...init.headers },
  });
}

describe('account-owned module API', () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });

  it('requires authentication', async () => {
    expect((await api('/api/modules')).status).toBe(401);
  });

  it('creates, lists, updates, and deletes an owned module', async () => {
    const alice = await signUp('alice');
    const created = await api('/api/modules', alice, { method: 'POST', body: JSON.stringify(moduleBody) });
    expect(created.status).toBe(201);
    const id = (await created.json() as { module: { id: string } }).module.id;
    const listed = await api('/api/modules', alice);
    expect((await listed.json() as { modules: unknown[] }).modules).toHaveLength(1);
    expect((await api(`/api/modules/${id}`, alice, { method: 'PATCH', body: JSON.stringify({ title: 'Updated' }) })).status).toBe(200);
    expect((await api(`/api/modules/${id}`, alice, { method: 'DELETE' })).status).toBe(204);
  });

  it('prevents cross-account IDOR access and permits the same hash for each owner', async () => {
    const alice = await signUp('alice');
    const bob = await signUp('bob');
    const created = await api('/api/modules', alice, { method: 'POST', body: JSON.stringify(moduleBody) });
    const id = (await created.json() as { module: { id: string } }).module.id;
    expect((await api(`/api/modules/${id}`, bob)).status).toBe(404);
    expect((await api(`/api/modules/${id}`, bob, { method: 'DELETE' })).status).toBe(404);
    expect((await api('/api/modules', bob, { method: 'POST', body: JSON.stringify(moduleBody) })).status).toBe(201);
  });

  it('rejects duplicate and browser-selected owners', async () => {
    const alice = await signUp('alice');
    expect((await api('/api/modules', alice, { method: 'POST', body: JSON.stringify(moduleBody) })).status).toBe(201);
    expect((await api('/api/modules', alice, { method: 'POST', body: JSON.stringify(moduleBody) })).status).toBe(409);
    const forged = await api('/api/modules', alice, { method: 'POST', body: JSON.stringify({ ...moduleBody, hash: 'hash-2', ownerId: 'bob' }) });
    expect(forged.status).toBe(400);
  });

  it('does not allow registration to choose role or tier', async () => {
    const cookie = await signUp('mallory', { role: 'admin', tier: 'pro' });
    const me = await api('/api/me', cookie);
    const body = await me.json() as { user: { role: string; tier: string } };
    expect(body.user).toMatchObject({ role: 'user', tier: 'free' });
  });

  it('enforces the free module count quota', async () => {
    const alice = await signUp('alice');
    const user = await env.DB.prepare("SELECT id FROM user WHERE email = 'alice@example.test'").first<{ id: string }>();
    const statement = env.DB.prepare(`INSERT INTO modules
      (id, owner_id, title, content_hash, questions_json, byte_size, question_count, created_at, updated_at)
      VALUES (?, ?, 'Seed', ?, '[]', 2, 1, 'now', 'now')`);
    await env.DB.batch(Array.from({ length: 100 }, (_, index) => statement.bind(`seed-${index}`, user!.id, `hash-${index}`)));
    const response = await api('/api/modules', alice, { method: 'POST', body: JSON.stringify(moduleBody) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: 'MODULE_QUOTA_REACHED' } });
  });

  it('atomically enforces the module count quota across concurrent creates', async () => {
    const alice = await signUp('alice');
    const user = await env.DB.prepare("SELECT id FROM user WHERE email = 'alice@example.test'").first<{ id: string }>();
    await Promise.all(Array.from({ length: 99 }, (_, index) =>
      insertModule(user!.id, `seed-${index}`, `seed-hash-${index}`, 2)));

    const responses = await Promise.all(['race-a', 'race-b'].map(hash =>
      api('/api/modules', alice, { method: 'POST', body: JSON.stringify({ ...moduleBody, hash }) })));
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const rejected = responses.find(response => response.status === 409)!;
    expect(await rejected.json()).toMatchObject({ error: { code: 'MODULE_QUOTA_REACHED' } });
    const final = await env.DB.prepare('SELECT COUNT(*) AS count FROM modules WHERE owner_id = ?')
      .bind(user!.id).first<{ count: number }>();
    expect(Number(final!.count)).toBe(MODULE_LIMITS.free.modules);
  });

  it('atomically enforces the storage quota across concurrent creates', async () => {
    const alice = await signUp('alice');
    const user = await env.DB.prepare("SELECT id FROM user WHERE email = 'alice@example.test'").first<{ id: string }>();
    const incomingBytes = moduleBytes(moduleBody);
    await insertModule(user!.id, 'storage-seed', 'storage-seed-hash', MODULE_LIMITS.free.storageBytes - incomingBytes);

    const responses = await Promise.all(['storage-a', 'storage-b'].map(hash =>
      api('/api/modules', alice, { method: 'POST', body: JSON.stringify({ ...moduleBody, hash }) })));
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const rejected = responses.find(response => response.status === 409)!;
    expect(await rejected.json()).toMatchObject({ error: { code: 'STORAGE_QUOTA_REACHED' } });
    const final = await env.DB.prepare('SELECT COALESCE(SUM(byte_size), 0) AS bytes FROM modules WHERE owner_id = ?')
      .bind(user!.id).first<{ bytes: number }>();
    expect(Number(final!.bytes)).toBeLessThanOrEqual(MODULE_LIMITS.free.storageBytes);
  });

  it('atomically enforces the storage quota across concurrent updates', async () => {
    const alice = await signUp('alice');
    const user = await env.DB.prepare("SELECT id FROM user WHERE email = 'alice@example.test'").first<{ id: string }>();
    const originalQuestions = moduleBody.questions;
    const expandedQuestions = [{ ...moduleBody.questions[0], question: 'Q'.repeat(200) }];
    const originalBytes = new TextEncoder().encode(JSON.stringify(originalQuestions)).byteLength;
    const expandedBytes = new TextEncoder().encode(JSON.stringify(expandedQuestions)).byteLength;
    await insertModule(user!.id, 'update-a', 'update-hash-a', originalBytes, originalQuestions);
    await insertModule(user!.id, 'update-b', 'update-hash-b', originalBytes, originalQuestions);
    await insertModule(user!.id, 'update-filler', 'update-filler-hash',
      MODULE_LIMITS.free.storageBytes - originalBytes - expandedBytes);

    const responses = await Promise.all(['update-a', 'update-b'].map(id =>
      api(`/api/modules/${id}`, alice, { method: 'PATCH', body: JSON.stringify({ questions: expandedQuestions }) })));
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const rejected = responses.find(response => response.status === 409)!;
    expect(await rejected.json()).toMatchObject({ error: { code: 'STORAGE_QUOTA_REACHED' } });
    const final = await env.DB.prepare('SELECT COALESCE(SUM(byte_size), 0) AS bytes FROM modules WHERE owner_id = ?')
      .bind(user!.id).first<{ bytes: number }>();
    expect(Number(final!.bytes)).toBeLessThanOrEqual(MODULE_LIMITS.free.storageBytes);
  });

  it('keeps not-found failures distinct from quota failures', async () => {
    const alice = await signUp('alice');
    const response = await api('/api/modules/missing', alice, {
      method: 'PATCH', body: JSON.stringify({ title: 'Still missing' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('rejects invalid and oversized request bodies', async () => {
    const alice = await signUp('alice');
    expect((await api('/api/modules', alice, { method: 'POST', body: '{' })).status).toBe(400);
    const response = await api('/api/modules', alice, {
      method: 'POST',
      body: JSON.stringify({ ...moduleBody, description: 'x'.repeat(2 * 1024 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

  it('rejects cross-site mutations and rate limits repeated changes', async () => {
    const alice = await signUp('alice');
    const crossSite = await api('/api/modules', alice, {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: JSON.stringify(moduleBody),
    });
    expect(crossSite.status).toBe(403);

    const user = await env.DB.prepare("SELECT id FROM user WHERE email = 'alice@example.test'").first<{ id: string }>();
    await env.DB.prepare('INSERT INTO request_rate_limits (user_id, window_start, request_count) VALUES (?, ?, 120)')
      .bind(user!.id, Math.floor(Date.now() / 60_000) * 60_000).run();
    const limited = await api('/api/modules', alice, { method: 'POST', body: JSON.stringify({ ...moduleBody, hash: 'new' }) });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});
