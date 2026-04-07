import { load } from 'js-yaml';
import type { Module, Question } from '../types/quiz';

export async function computeFileHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface YAMLModule {
  title: string;
  description?: string;
  questions: YAMLQuestion[];
}

interface YAMLQuestion {
  type?: number;
  question: string;
  answers?: string[];
  correct_answer: number | number[];
  explanation?: string;
  point?: number;
  textbox_type?: number;
  case_sensitive?: boolean;
  answer?: string;
}

function parseQuestions(questions: YAMLQuestion[]): Question[] {
  return questions.map((q) => ({
    type: q.type as Question['type'],
    question: q.question,
    answers: q.answers,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    point: q.point ?? 1,
    textbox_type: q.textbox_type as Question['textbox_type'],
    case_sensitive: q.case_sensitive,
    answer: q.answer,
  }));
}

export function parseModule(yamlContent: string, id: string): Module {
  const parsed = load(yamlContent) as YAMLModule;
  return {
    id,
    title: parsed.title,
    description: parsed.description,
    questions: parseQuestions(parsed.questions),
  };
}

export async function parseModules(files: File[]): Promise<Module[]> {
  return Promise.all(
    files.map(async (file, index) => {
      const content = await file.text();
      const hash = await computeFileHash(content);
      const id = `${file.name}-${Date.now()}-${index}`;
      const module = parseModule(content, id);
      module.hash = hash;
      return module;
    })
  );
}

export function validateModule(module: unknown): module is Module {
  if (!module || typeof module !== 'object') return false;
  const m = module as Record<string, unknown>;
  if (typeof m.title !== 'string') return false;
  if (!Array.isArray(m.questions)) return false;
  for (const q of m.questions) {
    if (typeof (q as Record<string, unknown>).question !== 'string') return false;
  }
  return true;
}