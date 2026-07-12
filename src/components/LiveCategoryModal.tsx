import { useState, useCallback } from 'react';
import type { LiveCategory, Module } from '../types/quiz';
import { useLiveCategory } from '../hooks/useLiveCategory';

interface LiveCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (liveCategory: LiveCategory, modules: Module[]) => void;
  existingLiveCategories: LiveCategory[];
}

export function LiveCategoryModal({ open, onClose, onAdd, existingLiveCategories }: LiveCategoryModalProps) {
  const { verifyUrl, fetchModules, resolveRawUrl } = useLiveCategory();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('URL is required.');
      return;
    }

    const dup = existingLiveCategories.find(lc => resolveRawUrl(lc.url) === resolveRawUrl(trimmed));
    if (dup) {
      setError('This Live Category has already been added.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { manifest, baseUrl } = await verifyUrl(trimmed);

      const id = `live-${Date.now()}`;
      const liveCategory: LiveCategory = {
        id,
        url: trimmed,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        moduleFiles: manifest.modules,
        lastUpdated: new Date().toISOString(),
      };

      const modules = await fetchModules(baseUrl, manifest.modules, id, manifest.name);

      onAdd(liveCategory, modules);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to add Live Category: ${msg}`);
    }
    setLoading(false);
  }, [url, existingLiveCategories, verifyUrl, resolveRawUrl, fetchModules, onAdd, onClose]);

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
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          border: '4px solid #1a1a1a',
          boxShadow: '4px 4px 0px #1a1a1a',
          padding: '28px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textTransform: 'uppercase' }}>
            Add Live Category
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              fontWeight: 700,
              padding: '0 4px',
              color: '#1a1a1a',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
          Enter a GitHub repo or raw URL that contains a <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '2px' }}>jaya.yaml</code> manifest file.
        </p>

        <div>
          <input
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="https://github.com/user/repo or raw URL"
            className="neu-input"
            style={{ width: '100%' }}
            disabled={loading}
          />
        </div>

        {error && (
          <div style={{
            padding: '12px',
            border: '3px solid #ff6b9d',
            background: '#fff0f3',
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="neu-btn" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleAdd} className="neu-btn neu-btn-primary" disabled={loading || !url.trim()}>
            {loading ? 'Verifying...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
