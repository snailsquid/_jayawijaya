import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { QuizState, Question } from '../types/quiz';
import { useQuiz } from '../hooks/useQuiz';
import { QuizGrid } from '../components/QuizGrid';
import { QuestionCard } from '../components/QuestionCard';
import { ArrowLeft, ArrowRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { authClient } from '../lib/auth-client';
import { activeWorkspace } from '../lib/workspace';
import { activeOwnerKey, clearActiveQuizSnapshot, loadQuizSnapshot, removeQuizSnapshot, saveQuizSnapshot, type RunningState } from '../lib/quiz-snapshot';

function ConfirmPopup({
  open,
  onClose,
  onConfirm,
  message,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={value => !value && onClose()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Finish quiz?</AlertDialogTitle><AlertDialogDescription>{message}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Finish quiz</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  );
}

export function Running() {
  const navigate = useNavigate();
  const location = useLocation();
  const { initializeQuiz, calculateResults, getQuestionState } = useQuiz();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  
  const locationState = location.state as RunningState | null;
  const workspace = activeWorkspace();
  const ownerHint = locationState?.ownerId ?? localStorage.getItem(activeOwnerKey) ?? '';
  const initialSnapshot = useMemo(() => ownerHint ? loadQuizSnapshot(ownerHint) : null, [ownerHint]);
  const initialState = useMemo(() => {
    if (locationState?.modules) return locationState;
    return initialSnapshot?.running ?? null;
  }, [locationState, initialSnapshot]);

  const [quizState, setQuizState] = useState<{ questions: Question[]; state: QuizState }>(() => {
    if (!initialState?.modules) {
      return { questions: [], state: {} as QuizState };
    }
    if (initialSnapshot?.quiz) return initialSnapshot.quiz;
    const { questions, state } = initializeQuiz(
      initialState.modules,
      initialState.mode,
      initialState.randomize,
      initialState.questionLimit,
      initialState.distributionMode
    );
    return { questions, state };
  });

  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'next' | 'finish' | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const dur = initialState?.timerDuration;
    const start = initialState?.timerStart;
    if (!dur || dur <= 0) return 0;
    if (start) {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      return Math.max(0, dur - elapsed);
    }
    return dur;
  });
  const timerFinished = useRef(false);
  const confirmFinishRef = useRef<() => void>(() => {});
  const authenticatedUserId = session?.user?.id;
  const effectiveOwnerId = authenticatedUserId ?? ((!navigator.onLine || workspace.kind === 'guest') ? workspace.id : undefined);
  const isOwner = Boolean(initialState?.ownerId && initialState.ownerId === effectiveOwnerId);

  useEffect(() => {
    const denied = !sessionPending && Boolean(initialState?.ownerId && initialState.ownerId !== effectiveOwnerId);
    if (denied && locationState) navigate('/running', { replace: true });
  }, [effectiveOwnerId, initialState?.ownerId, locationState, navigate, sessionPending]);

  useEffect(() => {
    const dur = initialState?.timerDuration;
    if (!isOwner || !dur || dur <= 0) return;
    timerFinished.current = false;

    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          timerFinished.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [initialState?.timerDuration, isOwner]);

  useEffect(() => {
    if (timerFinished.current) {
      confirmFinishRef.current();
    }
  }, [timeLeft]);

  useEffect(() => {
    if (!isOwner || !initialState?.ownerId || !quizState.questions.length) return;
    localStorage.setItem(activeOwnerKey, initialState.ownerId);
    saveQuizSnapshot({ ownerId: initialState.ownerId, running: initialState, quiz: quizState });
  }, [quizState, initialState, isOwner]);

  const { questions, state } = quizState;
  const currentQuestion = questions[state.currentQuestionIndex];
  const mode = initialState?.mode || 'practice';

  const goToQuestion = useCallback((index: number) => {
    setPracticeSubmitted(false);
    setQuizState((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        currentQuestionIndex: index,
        questionStates: prev.state.questionStates.map((s, i) =>
          i === index && s === 'unseen' ? 'unanswered' : s
        ),
      },
    }));
  }, []);

  const handleAnswer = useCallback((answer: number | number[] | string | null) => {
    setQuizState((prev) => {
      const newAnswers = [...prev.state.answers];
      newAnswers[prev.state.currentQuestionIndex] = answer;
      
      return {
        ...prev,
        state: {
          ...prev.state,
          answers: newAnswers,
        },
      };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    setPracticeSubmitted(true);
    setQuizState((prev) => {
      const newStates = [...prev.state.questionStates];
      newStates[prev.state.currentQuestionIndex] = 'answered';
      return {
        ...prev,
        state: {
          ...prev.state,
          questionStates: newStates,
        },
      };
    });
  }, []);

  const handlePrev = useCallback(() => {
    if (state.currentQuestionIndex > 0) {
      goToQuestion(state.currentQuestionIndex - 1);
    }
  }, [state.currentQuestionIndex, goToQuestion]);

  const handleToggleFlag = useCallback((index: number) => {
    setQuizState((prev) => {
      const flagged = prev.state.flaggedQuestions.includes(index)
        ? prev.state.flaggedQuestions.filter((i) => i !== index)
        : [...prev.state.flaggedQuestions, index];
      return {
        ...prev,
        state: {
          ...prev.state,
          flaggedQuestions: flagged,
        },
      };
    });
  }, []);

  const handleNext = useCallback(() => {
    if (state.currentQuestionIndex < questions.length - 1) {
      goToQuestion(state.currentQuestionIndex + 1);
    }
  }, [state.currentQuestionIndex, questions.length, goToQuestion]);

  const confirmFinish = useCallback(() => {
    const results = calculateResults(questions, state.answers);
    const selectedModules = initialState?.modules || [];
    const randomize = initialState?.randomize ?? false;
    const questionLimit = initialState?.questionLimit;
    const distributionMode = initialState?.distributionMode;
    const timerDuration = initialState?.timerDuration;
    if (initialState?.ownerId) removeQuizSnapshot(initialState.ownerId);
    localStorage.removeItem(activeOwnerKey);
    navigate('/end', { state: { results, mode, questions, answers: state.answers, modules: selectedModules, ownerId: initialState?.ownerId, randomize, questionLimit, distributionMode, timerDuration } });
  }, [calculateResults, questions, state.answers, navigate, mode, initialState]);

  useEffect(() => {
    confirmFinishRef.current = confirmFinish;
  });

  if (sessionPending && navigator.onLine && workspace.kind !== 'guest') return <main className="grid min-h-screen place-items-center p-6 font-semibold">Loading account…</main>;
  if (!session?.user && workspace.kind === 'account' && navigator.onLine) return <main className="grid min-h-screen place-content-center gap-4 p-6 text-center"><p>Your quiz is safe on this device. Sign in again to continue.</p><Button onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/running' })}>Sign in again</Button></main>;
  const accountMismatch = Boolean(initialState?.ownerId && effectiveOwnerId !== initialState.ownerId);
  if (accountMismatch) return <main className="grid min-h-screen place-content-center gap-4 p-6 text-center"><p>This quiz belongs to another account.</p><Button onClick={() => navigate('/start', { replace: true })}>Go to my modules</Button></main>;

  if (!currentQuestion) {
    return (
      <main className="grid min-h-screen place-content-center gap-4 p-6 text-center">
        <p>No questions loaded.</p>
        <Button onClick={() => navigate('/start', { replace: true })}>Go back</Button>
      </main>
    );
  }

  const questionStates = questions.map((_, i) => getQuestionState(state, i, mode));
  const showResult = mode === 'practice' && practiceSubmitted;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-4 pb-28 sm:p-6 sm:pb-28">
      <header className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => { clearActiveQuizSnapshot(); navigate('/start', { replace: true }); }}><LogOut /> Exit</Button><span className="font-semibold">{state.currentQuestionIndex + 1} / {questions.length}</span><span className="min-w-20 text-right font-mono font-semibold tabular-nums">{timeLeft > 0 ? `${Math.floor(timeLeft / 3600)}:${String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}` : ''}</span></header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <QuestionCard
            question={currentQuestion}
            questionIndex={state.currentQuestionIndex}
            state={questionStates[state.currentQuestionIndex]}
            userAnswer={state.answers[state.currentQuestionIndex]}
            mode={mode}
            submitted={showResult}
            isFlagged={state.flaggedQuestions.includes(state.currentQuestionIndex)}
            onAnswer={handleAnswer}
            onSubmit={handleSubmit}
            onToggleFlag={() => handleToggleFlag(state.currentQuestionIndex)}
          />
        </div>

        <aside className="w-full">
          <QuizGrid
            totalQuestions={questions.length}
            currentIndex={state.currentQuestionIndex}
            questionStates={questionStates}
            flaggedQuestions={state.flaggedQuestions}
            mode={mode}
            onSelectQuestion={goToQuestion}
            onToggleFlag={handleToggleFlag}
          />
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur"><div className="mx-auto flex max-w-6xl justify-between">
        <Button variant="outline"
          onClick={handlePrev}
          disabled={state.currentQuestionIndex === 0}
        ><ArrowLeft /> Previous</Button>
        <Button size="lg"
          onClick={() => {
            if (state.currentQuestionIndex === questions.length - 1) {
              setConfirmAction('finish');
              setShowConfirm(true);
            } else {
              handleNext();
            }
          }}
        >
          {state.currentQuestionIndex === questions.length - 1 ? 'Finish' : <>Next <ArrowRight /></>}
        </Button>
      </div></div>

      <ConfirmPopup
        open={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setConfirmAction(null);
        }}
        onConfirm={() => {
          setShowConfirm(false);
          if (confirmAction === 'finish') {
            confirmFinish();
          }
        }}
        message={
          confirmAction === 'finish'
            ? 'Are you sure you want to finish the quiz?'
            : 'Continue to next question?'
        }
      />
    </main>
  );
}
