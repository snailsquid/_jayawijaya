import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { QuestionCard } from "@/components/QuestionCard"

describe('QuestionCard', () => { it('reports a one-based single-choice answer', async () => { const onAnswer = vi.fn(); render(<QuestionCard question={{ question: 'Pick one', answers: ['A', 'B'], correct_answer: 2 }} questionIndex={0} state="unanswered" userAnswer={null} mode="practice" submitted={false} isFlagged={false} onAnswer={onAnswer} onSubmit={vi.fn()} onToggleFlag={vi.fn()} />); await userEvent.click(screen.getByText('B')); expect(onAnswer).toHaveBeenCalledWith(2) }); it('renders non-color correctness feedback', () => { render(<QuestionCard question={{ question: 'Pick one', answers: ['A', 'B'], correct_answer: 2 }} questionIndex={0} state="answered" userAnswer={2} mode="practice" submitted isFlagged={false} onAnswer={vi.fn()} onSubmit={vi.fn()} onToggleFlag={vi.fn()} />); expect(screen.getByText('Correct')).toBeInTheDocument() }) })
