import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeOwnerKey, clearActiveQuizSnapshot, loadQuizSnapshot, removeQuizSnapshot, saveQuizSnapshot, snapshotKey, type QuizSnapshot } from '../../src/lib/quiz-snapshot';

const snapshot: QuizSnapshot = {
  ownerId: 'alice',
  running: { ownerId: 'alice', modules: [], mode: 'practice', randomize: false },
  quiz: { questions: [], state: { mode: 'practice', randomize: false, currentQuestionIndex: 0, answers: [], questionStates: [], flaggedQuestions: [], submitted: false } },
};

describe('quiz snapshots', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([removeQuizSnapshot('alice'), removeQuizSnapshot('bob')]);
  });

  it('stores and restores data only for the owner', async () => {
    await saveQuizSnapshot(snapshot);
    expect(await loadQuizSnapshot('alice')).toEqual(snapshot);
    expect(await loadQuizSnapshot('bob')).toBeNull();
  });

  it('still saves and restores from IndexedDB when localStorage is full', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await saveQuizSnapshot(snapshot);
    setItem.mockRestore();

    expect(await loadQuizSnapshot('alice')).toEqual(snapshot);
  });

  it('falls back to localStorage when IndexedDB cannot be opened', async () => {
    const open = vi.spyOn(IDBFactory.prototype, 'open').mockImplementation(() => {
      throw new DOMException('IndexedDB unavailable', 'InvalidStateError');
    });

    await expect(saveQuizSnapshot(snapshot)).resolves.toBeUndefined();
    open.mockRestore();

    expect(await loadQuizSnapshot('alice')).toEqual(snapshot);
  });

  it('rejects a snapshot with mismatched embedded ownership', async () => {
    localStorage.setItem(snapshotKey('alice'), JSON.stringify({ ...snapshot, ownerId: 'bob' }));
    expect(await loadQuizSnapshot('alice')).toBeNull();
  });

  it('handles corrupt data and removal', async () => {
    localStorage.setItem(snapshotKey('alice'), '{');
    expect(await loadQuizSnapshot('alice')).toBeNull();
    await saveQuizSnapshot(snapshot);
    await removeQuizSnapshot('alice');
    expect(await loadQuizSnapshot('alice')).toBeNull();
  });

  it('clears the active owner and only that owner snapshot', async () => {
    await saveQuizSnapshot(snapshot);
    const bobSnapshot = { ...snapshot, ownerId: 'bob', running: { ...snapshot.running, ownerId: 'bob' } };
    await saveQuizSnapshot(bobSnapshot);
    localStorage.setItem(activeOwnerKey, 'alice');

    await clearActiveQuizSnapshot();

    expect(localStorage.getItem(activeOwnerKey)).toBeNull();
    expect(await loadQuizSnapshot('alice')).toBeNull();
    expect(await loadQuizSnapshot('bob')).toEqual(bobSnapshot);
  });

  it('serializes question content so later live-module mutations cannot alter a running quiz', async () => {
    const live = { ...snapshot, running: { ...snapshot.running, modules: [{ id: 'live', title: 'Live', currentVersion: 1, questions: [{ question: 'Original?', correct_answer: 1 }] }] } };
    await saveQuizSnapshot(live);
    live.running.modules[0].questions[0].question = 'Published later?';
    expect((await loadQuizSnapshot('alice'))?.running.modules[0].questions[0].question).toBe('Original?');
    expect((await loadQuizSnapshot('alice'))?.running.modules[0].currentVersion).toBe(1);
  });
});
