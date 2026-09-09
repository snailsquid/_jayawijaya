import { describe, expect, it, vi } from 'vitest';
import { computeFileHash, parseModule, parseModules, validateModule } from '../../src/lib/parser';

const yaml = `title: Test
description: Desc
questions:
  - type: 1
    question: Q?
    answers: [A, B]
    correct_answer: 1
    explanation: Because
    point: 2`;

describe('module parser', () => {
  it('computes stable hashes and parses YAML', async () => {
    expect(await computeFileHash('same')).toBe(await computeFileHash('same'));
    const module = parseModule(yaml, 'id');
    expect(module).toMatchObject({ id: 'id', title: 'Test', description: 'Desc' });
    expect(module.questions[0]).toMatchObject({ question: 'Q?', point: 2 });
  });

  it('parses uploaded files with hashes', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const [module] = await parseModules([new File([yaml], 'test.yaml')]);
    expect(module.id).toBe('test.yaml-123-0');
    expect(module.hash).toHaveLength(64);
    vi.restoreAllMocks();
  });

  it('validates minimum module structure', () => {
    expect(validateModule({ title: 'A', questions: [{ question: 'Q' }] })).toBe(true);
    expect(validateModule(null)).toBe(false);
    expect(validateModule({ title: 1, questions: [] })).toBe(false);
    expect(validateModule({ title: 'A', questions: 'no' })).toBe(false);
    expect(validateModule({ title: 'A', questions: [{}] })).toBe(false);
  });

  it('rejects aliases and oversized input before parsing', () => {
    expect(() => parseModule('title: A\nquestions: &items []\ncopy: *items', 'id')).toThrow('anchors and aliases');
    expect(() => parseModule(`title: ${'x'.repeat(2 * 1024 * 1024)}\nquestions: []`, 'id')).toThrow('2 MB');
  });
});
