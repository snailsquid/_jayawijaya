import { useState, useRef, useCallback } from 'react';
import { load } from 'js-yaml';
import type { Module } from '../types/quiz';
import { parseModule, computeFileHash } from '../lib/parser';

interface ModuleUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (modules: Module[]) => void;
  existingModules: Module[];
}

interface YAMLModule {
  title: string;
  description?: string;
  questions: { question: string }[];
}

function validateYAML(content: string): { valid: true; module: YAMLModule } | { valid: false; error: string } {
  if (!content.trim()) {
    return { valid: false, error: 'No content provided.' };
  }
  let parsed: unknown;
  try {
    parsed = load(content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `YAML parse error: ${msg}` };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid YAML: expected an object with title and questions.' };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.title !== 'string' || !obj.title.trim()) {
    return { valid: false, error: 'Module must have a "title" field.' };
  }
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    return { valid: false, error: 'Module must have a non-empty "questions" array.' };
  }
  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i] as Record<string, unknown>;
    if (!q || typeof q.question !== 'string' || !q.question.trim()) {
      return { valid: false, error: `Question #${i + 1} is missing the "question" field.` };
    }
  }
  return { valid: true, module: parsed as unknown as YAMLModule };
}

export function ModuleUploadModal({ open, onClose, onUpload, existingModules }: ModuleUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [yamlText, setYamlText] = useState('');
  const [error, setError] = useState('');
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dupMessage, setDupMessage] = useState('');

  const validate = useCallback((content: string) => {
    const result = validateYAML(content);
    if (result.valid) {
      setError('');
      setValid(true);
      setDupMessage('');
    } else {
      setError(result.error);
      setValid(false);
    }
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setYamlText(value);
    validate(value);
  }, [validate]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const content = await file.text();
      setYamlText(content);
      validate(content);
    } catch {
      setError('Failed to read file.');
      setValid(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validate]);

  const handleFinish = useCallback(async () => {
    setSubmitting(true);
    setDupMessage('');
    try {
      const hash = await computeFileHash(yamlText);
      const id = `pasted-${Date.now()}`;
      const module = parseModule(yamlText, id);
      module.hash = hash;

      const hashDup = existingModules.find(m => m.hash === hash);
      if (hashDup) {
        setDupMessage(`File already uploaded: ${hashDup.title}`);
        setSubmitting(false);
        return;
      }
      const titleDup = existingModules.find(m => m.title.toLowerCase() === module.title.toLowerCase());
      if (titleDup) {
        setDupMessage(`Module with same title exists: ${module.title}. Please rename.`);
        setSubmitting(false);
        return;
      }

      onUpload([module]);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Failed to process module: ${msg}`);
      setValid(false);
    }
    setSubmitting(false);
  }, [yamlText, existingModules, onUpload, onClose]);

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
          maxWidth: '640px',
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
            Upload Module
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

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={handleFileClick}
            className="neu-btn neu-btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3-3 3 3" />
            </svg>
            From File
          </button>
        </div>

        <textarea
          value={yamlText}
          onChange={handleTextChange}
          placeholder="Or paste YAML content here..."
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: '200px',
            border: '3px solid #1a1a1a',
            padding: '14px',
            fontSize: '15px',
            fontFamily: 'monospace',
            outline: 'none',
            resize: 'vertical',
            background: '#fafafa',
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <div
            style={{
              padding: '12px',
              background: '#ff6b9d',
              border: '2px solid #1a1a1a',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {dupMessage && (
          <div
            style={{
              padding: '12px',
              background: '#ffd93d',
              border: '2px solid #1a1a1a',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            {dupMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="neu-btn">
            Cancel
          </button>
          <button
            onClick={handleFinish}
            className="neu-btn neu-btn-primary"
            disabled={!valid || submitting}
            style={{
              opacity: valid && !submitting ? 1 : 0.4,
              cursor: valid && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Processing...' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}
