import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Running } from './Running';
import { activeOwnerKey, snapshotKey, type RunningState } from '../lib/quiz-snapshot';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'user-1' } }, isPending: false }),
    signIn: { social: vi.fn() },
  },
}));

const runningState: RunningState = {
  ownerId: 'user-1',
  modules: [{
    id: 'module-1',
    title: 'Test module',
    questions: [{ question: 'Question?', answers: ['Yes', 'No'], correct_answer: 1 }],
  }],
  mode: 'exam',
  randomize: false,
};

function renderRunning() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/running', state: runningState }]}>
      <TooltipProvider>
        <Routes>
          <Route path="/running" element={<Running />} />
          <Route path="/start" element={<p>Quiz setup</p>} />
          <Route path="/end" element={<p>Quiz results</p>} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe('Running', () => {
  beforeEach(() => localStorage.clear());

  it('confirms before exiting and only discards progress after confirmation', async () => {
    const user = userEvent.setup();
    renderRunning();

    await waitFor(() => expect(localStorage.getItem(snapshotKey('user-1'))).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Exit' }));

    expect(screen.getByRole('alertdialog', { name: 'Exit quiz?' })).toBeInTheDocument();
    expect(screen.getByText(/current progress will be discarded/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument();
    expect(localStorage.getItem(snapshotKey('user-1'))).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Exit' }));
    await user.click(screen.getByRole('button', { name: 'Exit quiz' }));

    expect(await screen.findByText('Quiz setup')).toBeInTheDocument();
    expect(localStorage.getItem(snapshotKey('user-1'))).toBeNull();
    expect(localStorage.getItem(activeOwnerKey)).toBeNull();
  });

  it('keeps the existing finish confirmation and completion flow', async () => {
    const user = userEvent.setup();
    renderRunning();

    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('alertdialog', { name: 'Finish quiz?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Finish quiz' }));
    expect(await screen.findByText('Quiz results')).toBeInTheDocument();
  });
});
