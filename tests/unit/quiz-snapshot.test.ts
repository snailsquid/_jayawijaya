import { beforeEach, describe, expect, it } from 'vitest';
import { loadQuizSnapshot, removeQuizSnapshot, saveQuizSnapshot, snapshotKey, type QuizSnapshot } from '../../src/lib/quiz-snapshot';

const snapshot: QuizSnapshot = {
  ownerId: 'alice',
  running: { ownerId: 'alice', modules: [], mode: 'practice', randomize: false },
  quiz: { questions: [], state: { mode: 'practice', randomize: false, currentQuestionIndex: 0, answers: [], questionStates: [], flaggedQuestions: [], submitted: false } },
};

describe('quiz snapshots', () => {
  beforeEach(() => sessionStorage.clear());

  it('stores and restores data only for the owner', () => {
    saveQuizSnapshot(snapshot);
    expect(loadQuizSnapshot('alice')).toEqual(snapshot);
    expect(loadQuizSnapshot('bob')).toBeNull();
  });

  it('rejects a snapshot with mismatched embedded ownership', () => {
    sessionStorage.setItem(snapshotKey('alice'), JSON.stringify({ ...snapshot, ownerId: 'bob' }));
    expect(loadQuizSnapshot('alice')).toBeNull();
  });

  it('handles corrupt data and removal', () => {
    sessionStorage.setItem(snapshotKey('alice'), '{');
    expect(loadQuizSnapshot('alice')).toBeNull();
    saveQuizSnapshot(snapshot);
    removeQuizSnapshot('alice');
    expect(loadQuizSnapshot('alice')).toBeNull();
  });
});

