import { beforeEach, describe, expect, it } from 'vitest';
import { emptyWorkspace, readWorkspace, updateWorkspace, writeWorkspace } from '../../src/lib/offline-db';

describe('offline workspace repository', () => {
  const accountId = `account-${crypto.randomUUID()}`;
  const guestId = `guest-${crypto.randomUUID()}`;

  beforeEach(async () => {
    await writeWorkspace(emptyWorkspace(accountId));
    await writeWorkspace(emptyWorkspace(guestId));
  });

  it('persists data and isolates guest and account workspaces', async () => {
    await updateWorkspace(guestId, workspace => ({
      ...workspace,
      modules: [{ id: 'local', title: 'Offline module', questions: [{ question: 'Works?', answers: ['Yes', 'No'], correct_answer: 1 }] }],
    }));

    expect((await readWorkspace(guestId)).modules[0].title).toBe('Offline module');
    expect((await readWorkspace(accountId)).modules).toEqual([]);
  });

  it('updates a workspace atomically without dropping queued work', async () => {
    await updateWorkspace(accountId, workspace => ({
      ...workspace,
      queue: [{ id: 'queued', kind: 'delete', moduleId: 'server-module', baseRevision: '1:a', createdAt: 1 }],
    }));
    await updateWorkspace(accountId, workspace => ({ ...workspace, lastSyncedAt: 2 }));

    const stored = await readWorkspace(accountId);
    expect(stored.queue).toHaveLength(1);
    expect(stored.lastSyncedAt).toBe(2);
  });

  it('uses the server free-tier quota for accounts and a separate guest quota', () => {
    expect(emptyWorkspace('account').limits.modules).toBe(10);
    expect(emptyWorkspace('guest').limits.modules).toBe(100);
  });

  it('normalizes the legacy guest quota stored on an account workspace', async () => {
    await writeWorkspace({ ...emptyWorkspace(accountId), limits: { modules: 100, storageBytes: 25 * 1024 * 1024, liveModules: false } });

    expect((await readWorkspace(accountId)).limits.modules).toBe(10);
  });
});
