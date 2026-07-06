import { useState } from 'react';
import type { Module } from '../types/quiz';
import { ModuleUploadModal } from './ModuleUploadModal';

interface ModuleUploaderProps {
  onUpload: (modules: Module[]) => void;
  existingModules: Module[];
}

export function ModuleUploader({ onUpload, existingModules }: ModuleUploaderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  const handleOpen = () => {
    setModalKey(k => k + 1);
    setModalOpen(true);
  };

  return (
    <>
      <button onClick={handleOpen} className="neu-btn neu-btn-secondary">
        Upload Modules
      </button>
      <ModuleUploadModal
        key={modalKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpload={onUpload}
        existingModules={existingModules}
      />
    </>
  );
}
