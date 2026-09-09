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
- Use shadcn/ui primitives from `components/ui` for interactive controls.
- Use Tailwind utilities for layout and semantic theme tokens for colors.
- Quiz result states use the centralized `quiz-*` theme tokens and text/icons, never color alone.
- Avoid presentation-oriented inline styles and raw color values.
