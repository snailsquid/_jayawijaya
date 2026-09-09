import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/hooks/useQuiz.ts', 'src/lib/parser.ts', 'src/lib/quiz-snapshot.ts', 'worker/module-policy.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});

