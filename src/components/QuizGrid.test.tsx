import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizGrid } from './QuizGrid';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('QuizGrid', () => {
  it('uses the destructive color treatment for flagged questions', () => {
    render(
      <TooltipProvider>
        <QuizGrid
          totalQuestions={1}
          currentIndex={0}
          questionStates={['unanswered']}
          flaggedQuestions={[0]}
          mode="exam"
          onSelectQuestion={vi.fn()}
          onToggleFlag={vi.fn()}
        />
      </TooltipProvider>,
    );

    const flaggedQuestion = screen.getByRole('button', { name: 'Question 1, flagged, current' });
    expect(flaggedQuestion).toHaveAttribute('data-variant', 'destructive');
    expect(flaggedQuestion).toHaveClass('bg-destructive', 'text-white', 'dark:bg-destructive/60');
  });
});
