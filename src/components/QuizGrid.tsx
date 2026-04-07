import type { QuestionState } from '../types/quiz';

interface QuizGridProps {
  totalQuestions: number;
  currentIndex: number;
  questionStates: QuestionState[];
  flaggedQuestions: number[];
  mode: 'practice' | 'exam';
  onSelectQuestion: (index: number) => void;
  onToggleFlag: (index: number) => void;
}

const stateColors: Record<QuestionState, string> = {
  unseen: '#e5e4e7',
  unanswered: '#fff',
  answered: '#00d4ff',
  flagged: '#ff6b9d',
};

export function QuizGrid({
  totalQuestions,
  currentIndex,
  questionStates,
  flaggedQuestions,
  mode,
  onSelectQuestion,
  onToggleFlag,
}: QuizGridProps) {
  const getState = (index: number): QuestionState => {
    if (flaggedQuestions.includes(index)) return 'flagged';
    if (questionStates[index] === 'answered') return 'answered';
    if (questionStates[index] === 'unseen') return 'unseen';
    return 'unanswered';
  };

  return (
    <div className="neu-box" style={{ padding: '12px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
          gap: '8px',
        }}
      >
        {Array.from({ length: totalQuestions }, (_, i) => {
          const state = getState(i);
          const isCurrent = i === currentIndex;
          return (
            <button
              key={i}
              onClick={() => onSelectQuestion(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (mode === 'exam') onToggleFlag(i);
              }}
              style={{
                width: '40px',
                height: '40px',
                border: `3px solid #1a1a1a`,
                background: stateColors[state],
                boxShadow: isCurrent ? 'none' : '2px 2px 0px #1a1a1a',
                transform: isCurrent ? 'translate(2px, 2px)' : undefined,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                color: '#1a1a1a',
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          gap: '16px',
          fontSize: '12px',
          flexWrap: 'wrap',
        }}
      >
        {Object.entries(stateColors).map(([state, color]) => (
          <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid #1a1a1a',
                background: color,
              }}
            />
            <span>{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}