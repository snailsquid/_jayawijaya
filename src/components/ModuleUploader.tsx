import { useState } from 'react';
import type { Module } from '../types/quiz';
import { ModuleUploadModal } from './ModuleUploadModal';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button variant="outline" onClick={handleOpen}><Upload /> Upload modules</Button>
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
