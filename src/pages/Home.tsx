import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '32px',
        padding: '24px',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(48px, 10vw, 96px)',
          fontWeight: 900,
          textAlign: 'center',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '-2px',
        }}
      >
        _jayawijaya
      </h1>
      <p style={{ textAlign: 'center', maxWidth: '400px', fontSize: '16px' }}>
        A modular quiz app with practice/exam modes, multiple choice & text answers, localStorage persistence
      </p>
      <p>by <a className=" font-bold underline" href="https://www.linkedin.com/in/arkandhiya-ibrahim-dewantara-576059235/">ark</a>, <a href="https://jambee.games" className=' italic'>Jambee</a> cofounder</p>
      <button
        onClick={() => navigate('/start')}
        className="neu-btn neu-btn-primary"
        style={{
          fontSize: '24px',
          padding: '24px 48px',
        }}
      >
        START
      </button>
    </div>
  );
}