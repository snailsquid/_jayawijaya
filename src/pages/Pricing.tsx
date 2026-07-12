import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { createInvoice } from '../lib/xendit';

const PREMIUM_PRICE = 15000;

function getXenditApiKey(): string {
  const stored = localStorage.getItem('jayawijaya-xendit-key');
  return stored ? JSON.parse(stored) : '';
}

export function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isPremium, login, logout, setPremium } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(getXenditApiKey);

  useEffect(() => {
    const paidInvoice = searchParams.get('paid');
    if (paidInvoice && paidInvoice === localStorage.getItem('jayawijaya-pending-invoice')) {
      localStorage.removeItem('jayawijaya-pending-invoice');
      setPremium(paidInvoice);
    }
  }, [searchParams, setPremium]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (res) => {
      try {
        const data = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${res.access_token}` },
        }).then((r) => r.json());
        login({
          email: data.email,
          name: data.name,
          picture: data.picture,
        });
      } catch {
        setError('Failed to fetch user info');
      }
    },
    onError: () => setError('Google sign-in failed'),
  });

  const handleSubscribe = async () => {
    if (!user) {
      googleLogin();
      return;
    }

    const key = apiKey.trim();
    if (!key) {
      setShowKeyInput(true);
      setError('Xendit API key required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const externalId = `jayawijaya-premium-${user.email}-${Date.now()}`;
      const invoice = await createInvoice(key, {
        externalId,
        amount: PREMIUM_PRICE,
        payerEmail: user.email,
        description: '_jayawijaya Premium - 1 month',
        successRedirectUrl: `${window.location.origin}/pricing?paid=${externalId}`,
      });

      localStorage.setItem('jayawijaya-xendit-key', JSON.stringify(key));
      localStorage.setItem('jayawijaya-pending-invoice', externalId);
      window.location.href = invoice.invoice_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = () => {
    localStorage.setItem('jayawijaya-xendit-key', JSON.stringify(apiKey.trim()));
    setShowKeyInput(false);
    setError(null);
  };

  const expiryDate = (() => {
    try {
      const sub = localStorage.getItem('jayawijaya-subscription');
      if (!sub) return '';
      return new Date(JSON.parse(sub).expiresAt).toLocaleDateString();
    } catch {
      return '';
    }
  })();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
        gap: '32px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px' }}>
        <button onClick={() => navigate('/')} className="neu-btn">
          ← Back
        </button>
        {user && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{user.email}</span>
            <button onClick={logout} className="neu-btn" style={{ fontSize: '14px', padding: '8px 16px' }}>
              Sign out
            </button>
          </div>
        )}
      </div>

      <h1 style={{ fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 900, margin: 0 }}>
        Pricing
      </h1>

      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '800px',
          width: '100%',
        }}
      >
        {/* Free Tier */}
        <div
          className="neu-box"
          style={{
            flex: '1 1 300px',
            maxWidth: '380px',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>Free</h2>
          <p style={{ fontSize: '14px', opacity: 0.7 }}>With advertisements</p>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <li>All quiz modules</li>
            <li>Practice & exam modes</li>
            <li>Module upload</li>
            <li>Ads displayed</li>
          </ul>
          <button className="neu-btn" style={{ width: '100%' }} onClick={() => navigate('/start')}>
            Get Started Free
          </button>
        </div>

        {/* Premium Tier */}
        <div
          className="neu-box"
          style={{
            flex: '1 1 300px',
            maxWidth: '380px',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            borderColor: 'var(--color-neu-accent-1)',
            borderWidth: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, margin: 0 }}>Premium</h2>
            <span
              style={{
                background: 'var(--color-neu-accent-1)',
                color: '#fff',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 700,
                border: '2px solid var(--color-neu-border)',
              }}
            >
              Rp15k/mo
            </span>
          </div>
          <p style={{ fontSize: '14px', opacity: 0.7 }}>No ads + customizability</p>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <li>Everything in Free</li>
            <li><strong>No advertisements</strong></li>
            <li>Custom themes & colors</li>
            <li>Priority support</li>
          </ul>

          {isPremium ? (
            <button className="neu-btn neu-btn-secondary" style={{ width: '100%' }} disabled>
              Subscribed until {expiryDate}
            </button>
          ) : (
            <>
              {user && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="neu-btn"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    title="Configure Xendit API key"
                  >
                    ⚙
                  </button>
                </div>
              )}

              {showKeyInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    className="neu-input"
                    type="password"
                    placeholder="Xendit API secret key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={{ fontSize: '14px', padding: '8px 12px' }}
                  />
                  <button className="neu-btn neu-btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={handleSaveKey}>
                    Save Key
                  </button>
                </div>
              )}

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="neu-btn neu-btn-primary"
                style={{ width: '100%' }}
              >
                {loading ? 'Processing...' : user ? 'Subscribe Now' : 'Sign in with Google'}
              </button>
            </>
          )}

          {error && (
            <p style={{ color: 'var(--color-neu-accent-1)', fontSize: '14px', margin: 0, fontWeight: 700 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
