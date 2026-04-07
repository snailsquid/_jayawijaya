import { useRef, useState } from 'react';
import type { Module } from '../types/quiz';
import { parseModules } from '../lib/parser';

interface ModuleUploaderProps {
  onUpload: (modules: Module[]) => void;
  existingModules: Module[];
}

export function ModuleUploader({ onUpload, existingModules }: ModuleUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newModules = await parseModules(files);

    const hashDuplicates: string[] = [];
    const titleDuplicates: string[] = [];

    for (const mod of newModules) {
      if (mod.hash) {
        const existingHash = existingModules.find(m => m.hash === mod.hash);
        if (existingHash) {
          hashDuplicates.push(existingHash.title);
        }
      }
      
      const existingTitle = existingModules.find(m => m.title.toLowerCase() === mod.title.toLowerCase());
      if (existingTitle) {
        titleDuplicates.push(mod.title);
      }
    }

    if (hashDuplicates.length > 0 || titleDuplicates.length > 0) {
      const messages: string[] = [];
      if (hashDuplicates.length > 0) {
        messages.push(`File(s) already uploaded: ${hashDuplicates.join(', ')}`);
      }
      if (titleDuplicates.length > 0) {
        messages.push(`Module with same title exists: ${titleDuplicates.join(', ')}. Please rename.`);
      }
      setDuplicateMessage(messages.join('\n'));
      setShowDuplicateWarning(true);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    onUpload(newModules);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button onClick={handleClick} className="neu-btn neu-btn-secondary">
        Upload Modules
      </button>
      {showDuplicateWarning && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: '#ff6b9d',
            border: '2px solid #1a1a1a',
            fontWeight: 600,
            whiteSpace: 'pre-line',
          }}
        >
          {duplicateMessage}
          <button
            onClick={() => setShowDuplicateWarning(false)}
            style={{
              marginLeft: '12px',
              padding: '4px 8px',
              border: '2px solid #1a1a1a',
              background: 'white',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}