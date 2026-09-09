import { ArrowLeft, Check, RotateCcw, X } from "lucide-react"
import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import type { Module, Question, QuizResult } from "@/types/quiz"
import { PageHeader, PageShell } from "@/components/app-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { removeQuizSnapshot, type RunningState } from "@/lib/quiz-snapshot"
import { authClient } from "@/lib/auth-client"

interface EndState { results: QuizResult; mode: 'practice' | 'exam'; questions: Question[]; answers: (number | number[] | string | null)[]; modules?: Module[]; ownerId?: string; randomize?: boolean; questionLimit?: number; distributionMode?: 'equal' | 'proportional'; timerDuration?: number }
function answerText(q: Question, answer: EndState['answers'][number]) { if (answer === null) return 'No answer'; if (q.type === 2 || q.answer) return String(answer); const values = (Array.isArray(answer) ? answer : [answer]) as number[]; return values.map(i => q.answers?.[i - 1]).filter(Boolean).join(', ') || 'No answer' }
function correctText(q: Question) { if (q.type === 2 || q.answer) return q.answer ?? ''; const values = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer]; return values.map(i => q.answers?.[i - 1]).filter(Boolean).join(', ') }
export function End() { const navigate = useNavigate(); const location = useLocation(); const state = location.state as EndState | null
  const { data: session, isPending } = authClient.useSession()
  const authenticatedUserId = session?.user?.id
  useEffect(() => {
    const denied = !isPending && (!authenticatedUserId || !state?.ownerId || state.ownerId !== authenticatedUserId)
    if (denied && state) navigate('/end', { replace: true })
  }, [authenticatedUserId, isPending, navigate, state])
  if (isPending) return <main className="grid min-h-screen place-items-center p-6 font-semibold">Loading account…</main>
  if (!session?.user) return <main className="grid min-h-screen place-content-center gap-4 p-6 text-center"><p>Sign in to view your results.</p><Button onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/end' })}>Sign in again</Button></main>
  if (!state?.ownerId || state.ownerId !== session.user.id) return <main className="grid min-h-screen place-content-center gap-4 p-6 text-center"><p>These results are not available for this account.</p><Button onClick={() => navigate('/start', { replace: true })}>Go to my modules</Button></main>
  if (!state.results) return <main className="grid min-h-screen place-content-center gap-4 text-center"><p>No results available.</p><Button onClick={() => navigate('/start', { replace: true })}>Go to setup</Button></main>
  const ownerId = state.ownerId
  const { results, mode, questions, answers, modules } = state; const percentage = results.maxScore ? Math.round(results.totalScore / results.maxScore * 100) : 0
  const retry = () => { if (!modules?.length) { removeQuizSnapshot(ownerId); sessionStorage.removeItem('jayawijaya-active-owner'); navigate('/start', { replace: true }); return } const runningState: RunningState = { ownerId, modules, mode, randomize: state.randomize ?? false, questionLimit: state.questionLimit, distributionMode: state.distributionMode, timerDuration: state.timerDuration, timerStart: (state.timerDuration ?? 0) > 0 ? Date.now() : undefined }; navigate('/running', { state: runningState, replace: true }) }
  return <PageShell className="max-w-4xl"><PageHeader title="Results" actions={<><Button variant="outline" onClick={() => navigate('/start', { replace: true })}><ArrowLeft /> Setup</Button><Button onClick={retry}><RotateCcw /> Retry</Button></>} />
    <Card><CardHeader><div className="flex items-center justify-between"><Badge variant="secondary" className="capitalize">{mode}</Badge><span className="text-sm text-muted-foreground">{results.answeredCorrectly}/{results.totalQuestions} correct</span></div><CardTitle className="pt-4 text-center text-5xl">{results.totalScore}/{results.maxScore}</CardTitle></CardHeader><CardContent className="space-y-2"><Progress value={percentage} /><p className="text-center text-lg font-semibold">{percentage}%</p></CardContent></Card>
    <section className="space-y-4"><h2 className="text-xl font-semibold">All questions</h2>{questions.map((q, index) => { const result = results.results[index]; const correct = result?.correct ?? false; return <Card key={index} className={cn(correct ? 'border-quiz-correct' : 'border-quiz-incorrect')}><CardHeader><div className="flex flex-wrap justify-between gap-2"><Badge className={cn(correct ? 'bg-quiz-correct text-foreground' : 'bg-quiz-incorrect text-foreground')}>{correct ? <Check /> : <X />} Question {index + 1}: {correct ? 'Correct' : 'Incorrect'}</Badge><Badge variant="outline">{result?.point ?? 0}/{result?.maxPoint ?? q.point ?? 1} pts</Badge></div><CardTitle className="text-lg leading-relaxed">{q.question}</CardTitle></CardHeader><CardContent className="space-y-3"><Alert className={cn(correct ? 'border-quiz-correct' : 'border-quiz-incorrect')}><AlertTitle>Your answer</AlertTitle><AlertDescription>{answerText(q, answers[index])}</AlertDescription></Alert><Alert className="border-quiz-correct"><AlertTitle>Correct answer</AlertTitle><AlertDescription>{correctText(q)}</AlertDescription></Alert>{q.explanation && <Alert><AlertTitle>Explanation</AlertTitle><AlertDescription>{q.explanation}</AlertDescription></Alert>}</CardContent></Card> })}</section>
    <div className="flex gap-3"><Button className="flex-1" variant="outline" onClick={() => navigate('/start', { replace: true })}><ArrowLeft /> Setup</Button><Button className="flex-1" onClick={retry}><RotateCcw /> Retry</Button></div>
  </PageShell>
}
