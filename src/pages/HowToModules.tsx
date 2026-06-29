import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LLM_PROMPT = `Follow the instructions below step by step: https://raw.githubusercontent.com/snailsquid/_jayawijaya/master/LLM_TUTORIAL.md`;


const headingStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 700,
  fontSize: '20px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

export function HowToModules() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(LLM_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure origin); fall back to select-on-focus
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '720px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, lineHeight: 1.1 }}>
          How to create modules?
        </h1>
        <button onClick={() => navigate('/')} className="neu-btn" style={{ flexShrink: 0 }}>
          ← Back
        </button>
      </div>

      {/* LLM prompt section */}
      <section className="neu-box" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={headingStyle}>
          <span style={{ background: '#ff6b9d', border: '2px solid #1a1a1a', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0, fontSize: '14px' }}>1</span>
          LLM prompt
        </h2>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
          Copy and paste into an LLM.
        </p>
        <textarea
          readOnly
          value={LLM_PROMPT}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            width: '100%',
            minHeight: '64px',
            border: '3px solid #1a1a1a',
            background: '#f5f5f5',
            padding: '12px 14px',
            fontSize: '14px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleCopy} className="neu-btn neu-btn-primary">
            {copied ? 'Copied ✓' : 'Copy prompt'}
          </button>
          {copied && (
            <span style={{ fontSize: '13px', color: '#666' }}>
              Paste it into your LLM now.
            </span>
          )}
        </div>
      </section>

      {/* Manual section */}
      <section className="neu-box" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={headingStyle}>
          <span style={{ background: '#00d4ff', border: '2px solid #1a1a1a', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0, fontSize: '14px' }}>2</span>
          Manual
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/example_module.yaml"
            target="_blank"
            rel="noopener noreferrer"
            className="neu-btn neu-btn-secondary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            example_module.yaml ↗
          </a>
          <a
            href="https://github.com/snailsquid/_jayawijaya/blob/master/example_module.yaml"
            target="_blank"
            rel="noopener noreferrer"
            className="neu-btn"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            View on GitHub ↗
          </a>
        </div>
      </section>
    </div>
  );
}