# Jayawijaya - Project Documentation

## Overview

Jayawijaya is a static local quiz application built with React, Vite, and Bun. It allows users to create, manage, and take quizzes with support for multiple question types, quiz modes, and module organization.

## Requirements Implemented

### Home Page (/)
- Big title in the middle
- Start button in the middle

### Start Page (/start)
- Choose between Practice or Exam mode
- Toggle randomize questions
- Upload YAML modules
- Choose which module(s) to use
- Toggle all modules in a category with Select All / Deselect All buttons
- Categorize modules with custom categories
- Name these categories
- Search modules by category or name
- Delete modules
- Mass assign category to selected modules
- Mass delete selected modules

### Running Page (/running)
- Go to next and previous question
- Floating Previous/Next buttons that don't block content
- Question grid showing all questions
- Question states: unseen, unanswered, answered, flagged
- Question grid elements reflect state with colors:
  - Unseen: Gray (#e5e4e7)
  - Unanswered: White (#fff)
  - Answered: Blue (#00d4ff)
  - Flagged: Pink (#ff6b9d)
- Flag questions (button on question card, right-click in grid)
- Confirmation popup before finishing
- Auto-save answers on selection/change
- Practice mode: Submit button to reveal answer
- Exam mode: Answers saved but not submitted until end

### End Page (/end)
- Total score display
- Percentage score
- Per-question breakdown:
  - Question number
  - Correct/Incorrect status
  - Your answer vs Correct answer
  - Points earned
  - Explanation (if available)
- Back to Start button (icon)
- Retry button (icon)

## Technical Implementation

### Frontend Stack
- React 19
- TypeScript
- Vite
- Bun (package manager)
- Tailwind CSS v4

### Styling
- NEU Brutalist Style
- Custom design system with:
  - Thick borders (3px solid #1a1a1a)
  - Box shadows (4px 4px 0px #1a1a1a)
  - High contrast colors
  - Responsive breakpoints

### State Management
- React hooks (useState, useCallback, useEffect)
- localStorage for persistence

### Data Storage (localStorage)
- `jayawijaya-modules`: Array of Module objects
- `jayawijaya-config`: Quiz configuration object

### Question States
1. **unseen**: Initial state, question not visited
2. **unanswered**: Question visited but no answer
3. **answered**: Answer selected and (practice: submitted / exam: saved)
4. **flagged**: Marked for review

### Question Answer States (Multiple Choice)
- **Blue (#00d4ff)**: Correct answer selected
- **Pink (#ff6b9d)**: Incorrect answer selected
- **Orange (#ff9f43)**: Correct answer not selected (missed)

## Key Files

### Core Application
- `src/App.tsx` - Router setup (HashRouter for GitHub Pages)
- `src/main.tsx` - Entry point
- `src/index.css` - Global styles

### Pages
- `src/pages/Home.tsx` - Landing page
- `src/pages/Start.tsx` - Module selection and configuration
- `src/pages/Running.tsx` - Quiz interface
- `src/pages/End.tsx` - Results display

### Components
- `src/components/QuestionCard.tsx` - Question display and answer input
- `src/components/QuizGrid.tsx` - Question navigation grid
- `src/components/ModuleUploader.tsx` - YAML file upload
- `src/components/ModeSelector.tsx` - Practice/Exam toggle

### Hooks
- `src/hooks/useQuiz.ts` - Quiz state management, scoring, navigation
- `src/hooks/useLocalStorage.ts` - localStorage wrapper

### Utilities
- `src/lib/parser.ts` - YAML parsing with SHA-256 hash computation
- `src/types/quiz.ts` - TypeScript type definitions

## Keyboard Shortcuts

### Text Input
- **Short form**: Enter to submit
- **Long form**: Enter for new line, Ctrl+Enter to submit

### Question Grid
- **Right-click**: Toggle flag (exam mode)

## Deployment

### GitHub Pages
- Uses HashRouter for subdirectory compatibility
- Deploy to `gh-pages` branch
- Access via: https://snailsquid.github.io/_jayawijaya/

### Build Commands
```bash
bun install    # Install dependencies
bun run dev   # Development server
bun run build # Production build
bun run deploy # Build and deploy
```

## Module Format

Modules are YAML files with the following structure:

```yaml
title: "Module Name"
description: "Optional description"

questions:
  - type: 1  # Multiple choice
    question: "Question text"
    answers:
      - "Option 1"
      - "Option 2"
    correct_answer: 1  # or [1,2] for multiple
    explanation: "Optional explanation"
    point: 1

  - type: 2  # Text answer
    question: "Question text"
    textbox_type: 1  # 1=short, 2=long
    answer: "Correct answer"
    case_sensitive: false
```

## Test Modules

Included in `test_modules/`:
- `single_choice.yaml` - 5 single-answer MCQ
- `multiple_choice.yaml` - 5 multi-select questions
- `text_answer.yaml` - 5 text input questions
- `points_explanations.yaml` - Various point values
- `edge_cases.yaml` - Case-sensitive, mixed types
- `categories_test.yaml` - For category testing