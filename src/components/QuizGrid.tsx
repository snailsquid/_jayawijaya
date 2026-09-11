import { Flag } from "lucide-react"
import type { QuestionState } from "@/types/quiz"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Props { totalQuestions: number; currentIndex: number; questionStates: QuestionState[]; flaggedQuestions: number[]; mode: 'practice' | 'exam'; onSelectQuestion: (index: number) => void; onToggleFlag: (index: number) => void }
const colors: Record<QuestionState, string> = {
  unseen: 'bg-quiz-unseen dark:bg-quiz-unseen dark:hover:bg-quiz-unseen',
  unanswered: 'bg-background dark:bg-background dark:hover:bg-background',
  answered: 'bg-quiz-answered dark:bg-quiz-answered dark:hover:bg-quiz-answered',
  flagged: 'bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60',
}
export function QuizGrid({ totalQuestions, currentIndex, questionStates, flaggedQuestions, mode, onSelectQuestion, onToggleFlag }: Props) {
  const stateAt = (i: number): QuestionState => flaggedQuestions.includes(i) ? 'flagged' : questionStates[i] === 'answered' ? 'answered' : questionStates[i] === 'unseen' ? 'unseen' : 'unanswered'
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Questions</CardTitle></CardHeader><CardContent><div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">{Array.from({ length: totalQuestions }, (_, i) => { const state = stateAt(i); return <Tooltip key={i}><TooltipTrigger asChild><Button variant={state === 'flagged' ? 'destructive' : 'outline'} size="icon" aria-current={i === currentIndex ? 'step' : undefined} aria-label={`Question ${i + 1}, ${state}${i === currentIndex ? ', current' : ''}`} className={cn(colors[state], i === currentIndex && 'ring-2 ring-primary')} onClick={() => onSelectQuestion(i)} onContextMenu={e => { e.preventDefault(); if (mode === 'exam') onToggleFlag(i) }}>{state === 'flagged' ? <Flag /> : i + 1}</Button></TooltipTrigger><TooltipContent>{`Question ${i + 1}: ${state}`}</TooltipContent></Tooltip> })}</div><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">{Object.entries(colors).map(([state, color]) => <span key={state} className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border", color)} />{state}</span>)}</div></CardContent></Card>
}
