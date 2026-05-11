import { useNavigate, useLocation } from 'react-router-dom';
import type { QuizResult, Question, Module } from '../types/quiz';

interface EndState {
  results: QuizResult;
  mode: 'practice' | 'exam';
  questions: Question[];
  answers: (number | number[] | string | null)[];
  modules?: Module[];
  randomize?: boolean;
  questionLimit?: number;
  distributionMode?: 'equal' | 'proportional';
}

function getUserAnswerText(question: Question, userAnswer: number | number[] | string | null): string {
  if (userAnswer === null) return 'No answer';
  
  if (question.type === 2 || question.answer) {
    return String(userAnswer);
  }

  if (Array.isArray(userAnswer)) {
    return userAnswer.map(i => question.answers?.[i - 1]).filter(Boolean).join(', ');
  }

  return question.answers?.[(userAnswer as number) - 1] ?? 'No answer';
}

function getCorrectAnswerText(question: Question): string {
  if (question.type === 2 || question.answer) {
    return question.answer ?? '';
  }

  const correctAnswers = question.correct_answer;
  if (Array.isArray(correctAnswers)) {
    return correctAnswers.map(i => question.answers?.[i - 1]).filter(Boolean).join(', ');
  }

  return question.answers?.[correctAnswers - 1] ?? '';
}

export function End() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as EndState | null;

  if (!state?.results) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '24px',
        }}
      >
        <p>No results available.</p>
        <button onClick={() => navigate('/start')} className="neu-btn">
          Go to Start
        </button>
      </div>
    );
  }

  const { results, mode, questions, answers, modules } = state;
  const percentage = Math.round((results.totalScore / results.maxScore) * 100);

  const handleRetry = () => {
    if (!modules || modules.length === 0) {
      navigate('/start');
      return;
    }
    const endState = location.state as EndState;
    const randomize = endState?.randomize ?? false;
    const questionLimit = endState?.questionLimit;
    const distributionMode = endState?.distributionMode;
    navigate('/running', { state: { modules, mode, randomize, questionLimit, distributionMode } });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={() => navigate('/start')} className="neu-btn" style={{ padding: '12px' }}>
          ←
        </button>
        <h1 style={{ fontSize: '32px', fontWeight: 900, margin: '0 auto' }}>RESULTS</h1>
        <button
          onClick={handleRetry}
          className="neu-btn neu-btn-primary"
          style={{ padding: '12px' }}
        >
          ↻
        </button>
      </div>

      <div className="neu-box" style={{ padding: '32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: 700 }}>Mode: {mode}</span>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>
            {results.answeredCorrectly}/{results.totalQuestions} correct
          </span>
        </div>

        <div
          style={{
            fontSize: '72px',
            fontWeight: 900,
            textAlign: 'center',
            padding: '24px',
            border: '4px solid #1a1a1a',
            background: percentage >= 70 ? '#00d4ff' : percentage >= 50 ? '#ffd93d' : '#ff6b9d',
            boxShadow: '4px 4px 0px #1a1a1a',
          }}
        >
          {results.totalScore}/{results.maxScore}
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '24px', fontWeight: 700 }}>
          {percentage}%
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontWeight: 700, fontSize: '24px' }}>All Questions</h2>
        
        {questions.map((question, index) => {
          const userAnswer = answers[index];
          const result = results.results[index];
          const isCorrect = result?.correct ?? false;

          return (
            <div key={index} className="neu-box" style={{ padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    padding: '4px 12px',
                    border: '3px solid #1a1a1a',
                    background: isCorrect ? '#00d4ff' : '#ff6b9d',
                  }}
                >
                  Q{index + 1}: {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '14px',
                    padding: '4px 12px',
                    border: '3px solid #1a1a1a',
                    background: '#ffd93d',
                  }}
                >
                  {result?.point ?? 0}/{result?.maxPoint ?? question.point ?? 1} pts
                </span>
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                {question.question}
              </h3>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Your answer:</div>
                <div
                  style={{
                    padding: '12px',
                    border: '2px solid #1a1a1a',
                    background: isCorrect ? '#00d4ff' : '#ff6b9d',
                  }}
                >
                  {getUserAnswerText(question, userAnswer)}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Correct answer:</div>
                <div
                  style={{
                    padding: '12px',
                    border: '2px solid #1a1a1a',
                    background: '#00d4ff',
                  }}
                >
                  {getCorrectAnswerText(question)}
                </div>
              </div>

              {question.explanation && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Explanation:</div>
                  <div
                    style={{
                      padding: '12px',
                      border: '2px solid #1a1a1a',
                      background: '#ffd93d',
                    }}
                  >
                    {question.explanation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <button onClick={() => navigate('/start')} className="neu-btn" style={{ flex: 1, padding: '16px' }}>
          ←
        </button>
        <button
          onClick={handleRetry}
          className="neu-btn neu-btn-primary"
          style={{ flex: 1, padding: '16px' }}
        >
          ↻
        </button>
      </div>
    </div>
  );
}