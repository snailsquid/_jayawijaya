# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-29 15:18:58
**Commit:** 6c7835e
**Branch:** master

## OVERVIEW
Local quiz application for medical education (Gastroenterology). React 19 + TypeScript + Vite + Tailwind CSS. Supports YAML module upload, practice/exam modes, localStorage persistence.

## STRUCTURE
```
./
├── src/
│   ├── components/   # UI components
│   ├── pages/         # Route pages (Home/Start/Running/End)
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities (YAML parser)
│   ├── types/         # TypeScript interfaces
│   ├── data/          # Bundled quiz YAML (k1-k18)
│   └── assets/        # Static images
├── test_modules/      # Sample YAML modules
├── public/            # Favicon, icons
├── index.html         # Entry HTML
└── package.json
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Quiz logic | `src/hooks/useQuiz.ts` | State, scoring, answer checking |
| YAML parsing | `src/lib/parser.ts` | Module parsing, hash computation |
| Question UI | `src/components/QuestionCard.tsx` | MCQ/text input, answer display |
| Quiz flow | `src/pages/Running.tsx` | Navigation, submit, flag |
| Module upload | `src/components/ModuleUploader.tsx` | File upload, duplicate detection |
| Type definitions | `src/types/quiz.ts` | All TypeScript interfaces |
| Routing | `src/App.tsx` | HashRouter (GitHub Pages) |

## CONVENTIONS
- **TypeScript**: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (strict mode)
- **ESLint**: Flat config, extends `react-hooks/recommended`, `react-refresh/vite`
- **Tailwind**: v4 via `@tailwindcss/vite` plugin (not traditional config)
- **Router**: `HashRouter` (required for GitHub Pages deployment at `/_jayawijaya/`)
- **Answer indices**: 1-based (YAML `correct_answer: 1` means index 0 in array)
- **Design**: NEU Brutalist (thick borders, solid shadows, bold colors)

## ANTI-PATTERNS (THIS PROJECT)
- NO explicit anti-pattern comments in code
- No test suite (no Jest/Vitest installed)
- `src/data/` contains 18 bundled YAML modules (not fetched from API)

## UNIQUE STYLES
- NEU Brutalist CSS: `box-shadow: 3px 3px 0px #1a1a1a`, `border: 3-4px solid #000`
- Color coding: Correct=`#00d4ff`, Incorrect=`#ff6b9d`, Correct miss=`#ff9f43`, Flag=`#ffd93d`
- No traditional tests — "testing" is uploading YAML via app UI

## COMMANDS
```bash
bun run dev      # Dev server
bun run build    # Production build (tsc -b && vite build)
bun run lint     # ESLint
bun run preview # Preview build
```

## NOTES
- **HashRouter**: All routes use hash (`#/`, `#/start`, `#/running`, `#/end`)
- **Base path**: `/_jayawijaya/` (configured in vite.config.ts)
- **localStorage keys**: `jayawijaya-modules`, `jayawijaya-config`
- **No backend**: Fully client-side, modules uploaded via UI or bundled in `src/data/`
