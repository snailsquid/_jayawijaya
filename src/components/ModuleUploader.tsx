import { useState } from 'react';
import type { Module } from '../types/quiz';
import { ModuleUploadModal } from './ModuleUploadModal';
import { ModuleCodeModal } from './ModuleCodeModal';
import { ChevronDown, FileUp, KeyRound, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ModuleUploaderProps {
  onUpload: (modules: Module[]) => void | Promise<void>;
  existingModules: Module[];
  onImportCode: (code: string) => Promise<void>;
}

export function ModuleUploader({ onUpload, existingModules, onImportCode }: ModuleUploaderProps) {
  const [mode, setMode] = useState<'file' | 'share-code' | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const handleOpen = (nextMode: 'file' | 'share-code') => {
    setModalKey(k => k + 1);
    setMode(nextMode);
  };

  return (
    <>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Upload /> New module <ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpen('share-code')}><KeyRound /> Add from 4-letter code</DropdownMenuItem><DropdownMenuItem onSelect={() => handleOpen('file')}><FileUp /> Upload YAML file</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      {mode === 'share-code' && <ModuleCodeModal open onClose={() => setMode(null)} onSubscribe={onImportCode} />}
      {mode === 'file' && <ModuleUploadModal
        key={modalKey}
        open
        mode={mode}
        onClose={() => setMode(null)}
        onUpload={onUpload}
        existingModules={existingModules}
      />}
    </>
  );
}
