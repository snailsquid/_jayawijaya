import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Module, QuizMode, QuizState, Question } from '../types/quiz';
import { useQuiz } from '../hooks/useQuiz';
import { QuizGrid } from '../components/QuizGrid';
import { QuestionCard } from '../components/QuestionCard';

interface RunningState {
  modules: Module[];
  mode: QuizMode;
  randomize: boolean;
}

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
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          border: '4px solid #000',
          padding: '24px',
          maxWidth: '400px',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button onClick={onClose} className="neu-btn">
            Cancel
          </button>
          <button onClick={onConfirm} className="neu-btn neu-btn-primary">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function Running() {
  const navigate = useNavigate();
  const location = useLocation();
  const { initializeQuiz, calculateResults, getQuestionState } = useQuiz();
  
  const initialState = location.state as RunningState | null;
  const [quizState, setQuizState] = useState<{ questions: Question[]; state: QuizState }>(() => {
    if (!initialState?.modules) {
      return { questions: [], state: {} as QuizState };
    }
    const { questions, state } = initializeQuiz(
      initialState.modules,
      initialState.mode,
      initialState.randomize
    );
    return { questions, state };
  });

  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'next' | 'finish' | null>(null);

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
    navigate('/end', { state: { results, mode, questions, answers: state.answers, modules: selectedModules, randomize } });
  }, [calculateResults, questions, state.answers, navigate, mode, initialState]);

  if (!currentQuestion) {
    return (
      <div style={{ padding: '24px' }}>
        <p>No questions loaded.</p>
        <button onClick={() => navigate('/start')} className="neu-btn">
          Go Back
        </button>
      </div>
    );
  }

  const questionStates = questions.map((_, i) => getQuestionState(state, i, mode));
  const showResult = mode === 'practice' && practiceSubmitted;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        paddingBottom: '100px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/start')} className="neu-btn">
          ← Exit
        </button>
        <div style={{ fontWeight: 700, fontSize: '18px' }}>
          {state.currentQuestionIndex + 1} / {questions.length}
        </div>
        <div style={{ width: '80px' }} />
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px', minWidth: '0' }}>
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

        <div style={{ flex: '0 0 200px', width: '200px' }} className="quiz-grid-mobile">
          <QuizGrid
            totalQuestions={questions.length}
            currentIndex={state.currentQuestionIndex}
            questionStates={questionStates}
            flaggedQuestions={state.flaggedQuestions}
            mode={mode}
            onSelectQuestion={goToQuestion}
            onToggleFlag={handleToggleFlag}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          right: '24px',
        }}
      >
        <button
          onClick={handlePrev}
          disabled={state.currentQuestionIndex === 0}
          className="neu-btn"
          style={{
            opacity: state.currentQuestionIndex === 0 ? 0.5 : 1,
          }}
        >
          ← Previous
        </button>
        <button
          onClick={() => {
            if (state.currentQuestionIndex === questions.length - 1) {
              setConfirmAction('finish');
              setShowConfirm(true);
            } else {
              handleNext();
            }
          }}
          className="neu-btn neu-btn-primary"
          style={{ fontSize: '18px', padding: '16px 32px' }}
        >
          {state.currentQuestionIndex === questions.length - 1 ? 'FINISH' : 'NEXT →'}
        </button>
      </div>

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
    </div>
  );
}