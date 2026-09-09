import { useState } from 'react';
import type { Module } from '../types/quiz';
import { ModuleUploadModal } from './ModuleUploadModal';
import { Braces, ChevronDown, FileUp, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ModuleUploaderProps {
  onUpload: (modules: Module[]) => void | Promise<void>;
  existingModules: Module[];
}

export function ModuleUploader({ onUpload, existingModules }: ModuleUploaderProps) {
  const [mode, setMode] = useState<'file' | 'code' | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const handleOpen = (nextMode: 'file' | 'code') => {
    setModalKey(k => k + 1);
    setMode(nextMode);
  };

  return (
    <>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Upload /> New module <ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpen('file')}><FileUp /> Upload YAML file</DropdownMenuItem><DropdownMenuItem onSelect={() => handleOpen('code')}><Braces /> Create from code</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      {mode && <ModuleUploadModal
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
