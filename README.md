# Jayawijaya - Account-Synced Quiz Application

A modular questionnaire/quiz application built with React, Vite, Cloudflare Workers, D1, and Better Auth. Google accounts own private module collections; active quizzes survive session expiry in account-scoped browser storage.

## Live Demo

Deploy the Worker to a Cloudflare-managed hostname or custom domain by following the deployment section below.

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
- Account-scoped auto-save (persists after refresh and passive session expiry)
- Confirmation popup before finishing

## Installation

```bash
# Install dependencies
bun install

# Apply the local D1 schema first
bun run db:migrate:local

# Start development server
bun run dev

# Build for production
bun run build

# Run all non-browser tests
bun test

# Run browser tests
bun run test:e2e
```

## Midtrans payments

Payments use Midtrans Snap through the Cloudflare Worker. Store both Midtrans keys as Worker
secrets so no credential-shaped values are committed. The client key is exposed to Snap in the
browser by design; storing it this way only keeps repository secret scanners clean:

```bash
bunx wrangler secret put MIDTRANS_CLIENT_KEY
bunx wrangler secret put MIDTRANS_SERVER_KEY
```

Set the Midtrans notification URL to
`https://<your-worker-domain>/api/payments/midtrans/notification`. Sandbox is used unless
`MIDTRANS_IS_PRODUCTION` is explicitly set to `"true"`; production must use matching production
client and server keys. Server-owned plans are VIP (Rp30,000/month), VIP+ (Rp40,000/6 months),
and MVP (Rp100,000/lifetime). Verified payments activate the corresponding entitlement; Basic
accounts can store 10 modules, while paid plans can store 200 and create live modules.

The payment schema is in `migrations/0004_payments.sql`; active, expiring, and lifetime grants
are stored independently in `migrations/0005_entitlements.sql`.

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
- D1 stores Better Auth identities, sessions, roles, tiers, and account-owned modules.
- `jayawijaya-config:<user-id>` stores per-account quiz preferences locally.
- `jayawijaya-running:<user-id>` stores an unfinished quiz in the current browser tab.
- The legacy `jayawijaya-modules` key is offered as a one-time authenticated import.

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

## Authentication and Cloudflare Deployment

1. Create a D1 database and replace `database_id` in `wrangler.jsonc`.
2. In Google Cloud Console, create an OAuth web client. Add
   `https://YOUR_HOST/api/auth/callback/google` as an authorized redirect URI.
3. Set `BETTER_AUTH_URL` in `wrangler.jsonc` to the exact public origin.
4. For authenticated custom domains and preview deployments, set `OAUTH_PROXY_TRUSTED_ORIGINS` to a comma-separated list of exact origins or narrowly scoped wildcard patterns. The checked-in Wrangler configuration trusts `acromion.org`, its subdomains, and Cloudflare version previews matching `https://*-jayawijaya.arkk.workers.dev`; do not broaden this to a shared hosting provider's entire domain.
5. Store secrets in Cloudflare; do not add them to `wrangler.jsonc`:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put OAUTH_PROXY_SECRET
```

6. Generate both auth secrets with at least 32 random characters. `OAUTH_PROXY_SECRET` must have the same value in production and every preview environment.
7. Apply the schema and deploy:

```bash
wrangler d1 migrations apply jayawijaya --remote
bun run build
wrangler deploy
```

Google only needs the production callback, `https://YOUR_HOST/api/auth/callback/google`, even when previews use the OAuth proxy. The production callback securely returns a short-lived encrypted profile to `/api/auth/oauth-proxy-callback` on the originating trusted preview, which creates that preview's own session cookie.

Better Auth derives its effective base URL from the incoming request after validating the hostname against the configured allowlist. This lets a login started on `acromion.org` or an Acromion subdomain finish on that same origin, while Google continues to use the single callback registered for `BETTER_AUTH_URL`.

For local Google OAuth, create an ignored `.dev.vars` containing the same secrets, `BETTER_AUTH_URL` set to the production origin, and `OAUTH_PROXY_TRUSTED_ORIGINS=http://localhost:5173`. The shared `OAUTH_PROXY_SECRET` lets production return the OAuth result to localhost without registering a localhost callback with Google.

## Verification

- `bun run lint` checks source and test code.
- `bun run build` type-checks and builds the Worker plus SPA.
- `bun run test:coverage` runs unit tests with 80% line/function/statement and 75% branch gates.
- `bun run test:integration` runs the Worker against isolated, migrated local D1 databases.
- `bun run test:e2e` runs account/module and session-expiry flows in Chromium without Google secrets.
- Before production releases, manually verify Google consent, callback, persistence, logout, same-account reauthentication, and two-account module isolation on a staging hostname.

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

## UI development

The frontend uses shadcn/ui's New York style with Tailwind CSS v4. Reusable primitives live in `src/components/ui`; application compositions live directly under `src/components`. Prefer semantic theme tokens, component variants, and Tailwind utilities.

Themes support light, dark, and system modes and persist under `jayawijaya-theme`.

Run `bun run check:ui` alongside the lint, build, unit, integration, and browser checks when changing the interface.
