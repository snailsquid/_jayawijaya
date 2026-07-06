import { useNavigate } from 'react-router-dom';
import { InstallPrompt } from '../components/InstallPrompt';

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
        gap: '24px',
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
      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', justifyContent: 'center', flexDirection: "column" }}>
        <button
          onClick={() => navigate('/start')}
          className="neu-btn neu-btn-primary"
          style={{ fontSize: '24px', padding: '16px 48px'}}
        >
          START
        </button>
        <button
          onClick={() => navigate('/how-to-create-modules')}
          className="neu-btn neu-btn-secondary"
          style={{ fontSize: '14px', padding: '10px 30px', width:'100%', alignSelf: 'center', maxWidth: '200px', textAlign: 'center', lineHeight: 1.2 }}
        >
          How to create<br />modules?
        </button>
      </div>
      <InstallPrompt />
    </div>
  );
}