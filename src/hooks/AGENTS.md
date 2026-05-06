# AGENTS.md — src/hooks

## OVERVIEW
Hooks handle all stateful quiz logic: state initialization, answer validation, scoring, and localStorage persistence.

## WHERE TO LOOK

| Hook | Role | Key Functions |
|------|------|---------------|
| `useQuiz.ts` | Quiz engine | `initializeQuiz`, `checkAnswer`, `calculateResults`, `getQuestionState` |
| `useLocalStorage.ts` | Persistence | Generic `[value, setItem, remove]` tuple |

### Quiz Flow (hooks in order)

1. **`initializeQuiz`** — Called on start, flattens modules into question array, shuffles if needed, initializes `QuizState`
2. **`checkAnswer`** — Validates user answer against `Question.correct_answer` (supports single MCQ, multi-select MCQ, text with case sensitivity)
3. **`calculateResults`** — After submission, computes `totalScore`, `answeredCorrectly`, per-question `QuestionResultItem[]`
4. **`getQuestionState`** — Returns `unseen | unanswered | answered | flagged` for UI rendering

### Answer Types Supported

- MCQ single: `answer === correct_answer` (1-based index)
- MCQ multi: arrays sorted then compared
- Text: trimmed, case-sensitive option

### Persistence (`useLocalStorage`)

- Listens to `storage` event for cross-tab sync
- Used for `jayawijaya-modules` and `jayawijaya-config`

## CONVENTIONS

- All hooks use `useCallback` for stable references
- `useQuiz` exports utility `shuffleArray` for randomization
- No external state management (React useState only)
