# Jayawijaya - Local Quiz Application

A modular questionnaire/quiz application built with React, Vite, and Bun. Supports multiple choice, text answer questions with practice and exam modes, persisted via localStorage.

## Live Demo

**URL**: https://snailsquid.github.io/_jayawijaya/

## Features

### Quiz Modes
- **Practice Mode**: Reveals answer after each submission
- **Exam Mode**: Reveals all answers at the end

### Question Types
1. **Multiple Choice / Multiple Answer** (`type: 1`)
   - Single answer: `correct_answer: 1`
   - Multiple answers: `correct_answer: [1, 2, 3]`
2. **Text Answer** (`type: 2`)
   - Short form: Single line input, Enter to submit
   - Long form: Textarea, Ctrl+Enter to submit, Enter for new line

### Module Management
- Upload YAML modules via file upload
- Organize modules into categories
- Search/filter modules by name or category
- Select all / Deselect all per category
- Duplicate detection via file hash and title

### Quiz Interface
- Question navigation (Previous/Next)
- Question grid for quick jumping
- Question states: unseen, unanswered, answered, flagged
- Flag questions for review
- Auto-save answers (persists even after page refresh)
- Confirmation popup before finishing

## Installation

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Deploy to GitHub Pages
bun run deploy
```

## YAML Module Format

Create quiz modules in YAML format:

```yaml
title: Module Title
description: Optional description

questions:
  # Multiple Choice (Single Answer)
  - type: 1
    question: What is 1+1?
    answers:
      - 2
      - 4
      - 6
    correct_answer: 1  # Index starts from 1
    explanation: Because 1+1=2
    point: 1

  # Multiple Choice (Multiple Answers)
  - question: Which are fruits?
    answers:
      - Apple
      - Carrot
      - Banana
    correct_answer: [1, 3]  # Multiple correct

  # Text Answer (Short Form)
  - type: 2
    question: What is H2O?
    answer: H2O
    case_sensitive: false

  # Text Answer (Long Form)
  - type: 2
    question: Explain photosynthesis
    textbox_type: 2  # 1=short, 2=long
    answer: Process by which plants...
    case_sensitive: false
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Module title |
| `description` | string | No | Module description |
| `questions` | array | Yes | Array of questions |
| `type` | number | No | 1=multiple choice, 2=text answer (default: 1) |
| `question` | string | Yes | Question text |
| `answers` | array | If type=1 | Answer options |
| `correct_answer` | number/array | If type=1 | Correct answer index(es) |
| `answer` | string | If type=2 | Correct text answer |
| `textbox_type` | number | If type=2 | 1=short, 2=long form |
| `case_sensitive` | boolean | If type=2 | Text matching case sensitivity |
| `explanation` | string | No | Explanation shown after answer |
| `point` | number | No | Points for this question (default: 1) |

## Project Structure

```
_jayawijaya/
├── src/
│   ├── components/
│   │   ├── QuestionCard.tsx    # Question display and interaction
│   │   ├── QuizGrid.tsx        # Question navigation grid
│   │   ├── ModuleUploader.tsx   # YAML file upload
│   │   ├── ModeSelector.tsx     # Practice/Exam mode toggle
│   │   └── CategoryManager.tsx # Category management UI
│   ├── pages/
│   │   ├── Home.tsx             # Landing page
│   │   ├── Start.tsx            # Module selection
│   │   ├── Running.tsx          # Quiz interface
│   │   └── End.tsx              # Results page
│   ├── hooks/
│   │   ├── useQuiz.ts           # Quiz logic (state, scoring)
│   │   └── useLocalStorage.ts   # localStorage persistence
│   ├── lib/
│   │   └── parser.ts            # YAML parser with hash computation
│   ├── types/
│   │   └── quiz.ts              # TypeScript interfaces
│   ├── index.css                # Global styles (NEU brutalist)
│   ├── App.tsx                  # Router setup
│   └── main.tsx                 # Entry point
├── test_modules/                # Sample modules for testing
├── example_module.yaml          # Example module format
├── documentation.md             # Original requirements doc
└── package.json
```

## Technical Details

### State Management
- **localStorage Keys**:
  - `jayawijaya-modules`: Uploaded quiz modules
  - `jayawijaya-config`: Quiz configuration (mode, selected modules, randomize)

### Router
- Uses `HashRouter` for GitHub Pages compatibility
- Routes: `/`, `/start`, `/running`, `/end`

### Question States
- `unseen`: Question not yet visited
- `unanswered`: Question visited but no answer selected
- `answered`: Answer selected (practice: submitted, exam: saved)
- `flagged`: Question marked for review

### Styling
- NEU Brutalist design system
- Custom CSS with Tailwind CSS
- Responsive layout (desktop/mobile)

## Deployment

### GitHub Pages
1. Set `base` in `vite.config.ts` to `/<repo-name>/`
2. Use `HashRouter` in `App.tsx`
3. Build and deploy to `gh-pages` branch:

```bash
bun run build
npx gh-pages -d dist -b gh-pages
```

### Custom Domain
Configure in GitHub repository Settings → Pages

## Development

### Adding New Features
1. Create component in `src/components/`
2. Add page in `src/pages/`
3. Update router in `src/App.tsx`
4. Add types in `src/types/quiz.ts`

### Testing
Upload test modules from `test_modules/`:
- `single_choice.yaml` - Single answer MCQs
- `multiple_choice.yaml` - Multi-select questions
- `text_answer.yaml` - Text input questions
- `points_explanations.yaml` - Various point values
- `edge_cases.yaml` - Case-sensitive, mixed types
- `categories_test.yaml` - Category testing

## License

MIT