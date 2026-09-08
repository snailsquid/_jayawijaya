import { Check, Flag, X } from "lucide-react"
import type { Question, QuestionState } from "@/types/quiz"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface Props { question: Question; questionIndex: number; state: QuestionState; userAnswer: number | number[] | string | null; mode: 'practice' | 'exam'; submitted: boolean; isFlagged: boolean; onAnswer: (answer: number | number[] | string | null) => void; onSubmit: () => void; onToggleFlag: () => void }
function isCorrect(question: Question, answer: Props['userAnswer']) { if (answer === null) return false; if (question.type === 2 || question.answer) return question.case_sensitive ? String(answer).trim() === question.answer?.trim() : String(answer).trim().toLowerCase() === question.answer?.trim().toLowerCase(); const correct = question.correct_answer; if (Array.isArray(correct)) return Array.isArray(answer) && answer.length === correct.length && [...answer].sort().every((a, i) => a === [...correct].sort()[i]); return answer === correct }
function correctText(question: Question) { if (question.type === 2 || question.answer) return question.answer ?? ''; const values = Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer]; return values.map(i => question.answers?.[i - 1]).filter(Boolean).join(', ') }

export function QuestionCard({ question, questionIndex, userAnswer, mode, submitted, isFlagged, onAnswer, onSubmit, onToggleFlag }: Props) {
  const textQuestion = question.type === 2 || Boolean(question.answer); const text = typeof userAnswer === 'string' ? userAnswer : ''; const correct = submitted && isCorrect(question, userAnswer); const multiple = Array.isArray(question.correct_answer); const hasAnswer = textQuestion ? Boolean(text.trim()) : userAnswer !== null
  const optionClass = (selected: boolean, right: boolean) => cn("flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors", !submitted && selected && "border-primary bg-accent", submitted && right && selected && "border-quiz-correct bg-quiz-correct/30", submitted && selected && !right && "border-quiz-incorrect bg-quiz-incorrect/30", submitted && right && !selected && "border-quiz-missed bg-quiz-missed/30")
  return <Card><CardHeader className="gap-4"><div className="flex flex-wrap items-center gap-2"><Badge>Question {questionIndex + 1}</Badge><Badge variant="outline">{question.point ?? 1} point{question.point === 1 ? '' : 's'}</Badge><Button className="ml-auto" variant={isFlagged ? 'destructive' : 'outline'} size="sm" onClick={onToggleFlag}><Flag /> {isFlagged ? 'Flagged' : 'Flag'}</Button></div><CardTitle className="text-xl leading-relaxed">{question.question}</CardTitle></CardHeader><CardContent className="space-y-4">
    {textQuestion ? (question.textbox_type === 2 ? <Textarea value={text} disabled={submitted} placeholder="Type your answer…" className="min-h-28" onChange={e => onAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit() } }} /> : <Input value={text} disabled={submitted} placeholder="Type your answer…" onChange={e => onAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }} />) : multiple ?
      <fieldset className="space-y-2"><legend className="sr-only">Select all correct answers</legend>{question.answers?.map((answer, i) => { const value = i + 1; const selected = Array.isArray(userAnswer) && userAnswer.includes(value); const right = (question.correct_answer as number[]).includes(value); return <Label key={value} className={optionClass(selected, right)}><Checkbox checked={selected} disabled={submitted} onCheckedChange={() => { const current = Array.isArray(userAnswer) ? userAnswer : []; const next = selected ? current.filter(v => v !== value) : [...current, value]; onAnswer(next.length ? next : null) }} /><span>{answer}{submitted && right && <span className="sr-only"> — correct answer</span>}</span></Label> })}</fieldset> :
      <RadioGroup value={typeof userAnswer === 'number' ? String(userAnswer) : ''} onValueChange={value => onAnswer(Number(value))} disabled={submitted}>{question.answers?.map((answer, i) => { const value = i + 1; const selected = userAnswer === value; const right = question.correct_answer === value; return <Label key={value} className={optionClass(selected, right)}><RadioGroupItem value={String(value)} /><span>{answer}{submitted && right && <span className="sr-only"> — correct answer</span>}</span></Label> })}</RadioGroup>}
    {mode === 'practice' && hasAnswer && !submitted && <Button className="w-full" onClick={onSubmit}>Submit answer</Button>}
    {submitted && <Alert className={correct ? "border-quiz-correct bg-quiz-correct/20" : "border-quiz-incorrect bg-quiz-incorrect/20"}>{correct ? <Check /> : <X />}<AlertTitle>{correct ? 'Correct' : 'Incorrect'}</AlertTitle><AlertDescription>The answer is: {correctText(question)}</AlertDescription></Alert>}
    {submitted && question.explanation && <Alert><AlertTitle>Explanation</AlertTitle><AlertDescription>{question.explanation}</AlertDescription></Alert>}
  </CardContent></Card>
}
