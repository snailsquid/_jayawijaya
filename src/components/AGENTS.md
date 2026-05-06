# /src/components

## OVERVIEW
UI layer for quiz interaction, module management, and navigation.

## WHERE TO LOOK
| File | Responsibility |
|------|----------------|
| `QuestionCard.tsx` | MCQ/text input rendering, answer submission, flagging, explanation display |
| `ModuleUploader.tsx` | YAML file input, duplicate detection via hash + title |
| `CategoryManager.tsx` | Category CRUD, module selection, expand/collapse |
| `QuizGrid.tsx` | Question nav grid with color-coded states (unseen/answered/flagged) |
| `ModeSelector.tsx` | Practice/Exam toggle buttons |

## CONVENTIONS
- Inline styles with NEU Brutalist: `box-shadow: 3px 3px 0px #1a1a1a`, `border: 3px solid #000`
- Colors: Correct=`#00d4ff`, Incorrect=`#ff6b9d`, Correct miss=`#ff9f43`, Flag=`#ffd93d`
- No Tailwind classes in components (inline styles only)
- Props interfaces defined at top of each file