import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallPrompt() {
  const { showHint, canInstall, install, dismiss } = usePWAInstall();

  if (!showHint) return null;

  return (
    <div
      className="neu-box"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        maxWidth: '420px',
        margin: '0 auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
          Install this app for offline access
        </p>
        <button
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 700,
            padding: '0 4px',
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      {canInstall ? (
        <button
          onClick={install}
          className="neu-btn neu-btn-primary"
          style={{ fontSize: '14px', padding: '8px 20px', alignSelf: 'flex-start' }}
        >
          Add to Home Screen
        </button>
      ) : (
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
          Open browser menu → &ldquo;Add to Home Screen&rdquo;
        </p>
      )}
    </div>
  );
}
