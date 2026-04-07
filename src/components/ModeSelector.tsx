import type { QuizMode } from '../types/quiz';

interface ModeSelectorProps {
  mode: QuizMode;
  onChange: (mode: QuizMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {(['practice', 'exam'] as QuizMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`neu-btn ${mode === m ? 'neu-btn-primary' : ''}`}
          style={{
            flex: 1,
            background: mode === m ? '#ff6b9d' : 'white',
          }}
        >
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}