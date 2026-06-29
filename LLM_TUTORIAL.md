# _jayawijaya LLM Module Authoring Tutorial
You are an LLM generating a quiz module for the **_jayawijaya** app. Follow these
steps in order. This document is the spec for *you*, not the user.
## Step 1 — Greet the user
Begin your reply with a short, warm greeting to the user (one sentence). Then
proceed silently through the remaining steps — do not narrate the process beyond
that greeting and the final deliverable.
## Step 2 — Learn the format
Fetch and read these two files:

1. Example module (the canonical reference, every field is commented inline):
   https://raw.githubusercontent.com/snailsquid/_jayawijaya/master/example_module.yaml
2. Project documentation (format overview, "Module Format" section):
   https://raw.githubusercontent.com/snailsquid/_jayawijaya/master/documentation.md

## Step 3 — Format specification

A module is a single YAML file with this shape:

```yaml
title: "Module Name"          # required, string
description: "Optional text"  # optional, string

questions:                    # required, list (length >= 1)
  - type: 1                   # optional, default 1. 1 = choice, 2 = text answer
    question: "Question text" # required, string
    answers:                  # required when type == 1, list of strings
      - "Option A"
      - "Option B"
    correct_answer: 1         # required when type == 1. 1-based index, OR a list
                               # of 1-based indices for multiple-answer: [1, 2, 3]
    explanation: "Optional"   # optional, string
    point: 1                  # optional, default 1, positive number

  - type: 2                   # text answer
    question: "Question text" # required, string
    textbox_type: 1           # optional, default 1. 1 = short, 2 = long
    answer: "H2O"             # required when type == 2, string
    case_sensitive: false     # optional, default false, boolean
    explanation: "Optional"   # optional, string
    point: 1                  # optional, default 1, positive number
```

Hard rules (the app's parser enforces these or will reject the module):

- `title` is a non-empty string.
- `questions` is a non-empty list.
- Every question has a non-empty `question` string.
- `type` is `1` or `2` (omit = `1`).
- For `type: 1`: `answers` is a list of `>= 2` non-empty strings; `correct_answer`
  is a positive integer (single choice) or a non-empty list of positive integers
  (multiple choice). Every index must be `>= 1` and `<= len(answers)`. No duplicates.
- For `type: 2`: `answer` is a non-empty string. `answers` must be absent.
  `textbox_type` is `1` or `2` if present. `case_sensitive` is a boolean if present.
- `point`, if present, is a positive number.
- Duplicate `answers` entries are not allowed (parser deduplicates by hash and the
  uploader rejects identical modules — keep answer strings distinct within a question).

Soft rules (good authoring):

- 1-based indexing — `correct_answer: 1` means the **first** entry of `answers`.
- Prefer 4–6 options for choice questions.
- Provide an `explanation` for every question; it is shown after answering.
- Keep one module to a coherent topic.

## Step 4 — Generate

Ask the user for a topic (and optional count / difficulty) only if they have not
already given one in their message. Otherwise generate a module matching the topic.
Produce the YAML as your final answer in a single fenced ```yaml block.

## Step 5 — Self-validate with code (REQUIRED)

Before showing the YAML, you MUST validate it by running code. Do not skip this
step and do not validate by eye. Run a validator script against the exact YAML you
are about to output.

### Option A — Python (use if a Python runtime is available)

Install PyYAML if needed: `pip install pyyaml`, then run:

```python
import sys, yaml

YAML_TEXT = """\
(paste your YAML here)
"""

def fail(msg): raise SystemExit(f"INVALID: {msg}")
doc = yaml.safe_load(YAML_TEXT)
if not isinstance(doc, dict): fail("top-level must be a mapping")
if not isinstance(doc.get("title"), str) or not doc["title"].strip(): fail("title missing/empty")
qs = doc.get("questions")
if not isinstance(qs, list) or len(qs) == 0: fail("questions must be a non-empty list")
for i, q in enumerate(qs, 1):
    if not isinstance(q, dict): fail(f"q{i}: not a mapping")
    if not isinstance(q.get("question"), str) or not q["question"].strip(): fail(f"q{i}: question missing/empty")
    t = q.get("type", 1)
    if t not in (1, 2): fail(f"q{i}: type must be 1 or 2, got {t!r}")
    point = q.get("point", 1)
    if not isinstance(point, (int, float)) or point <= 0: fail(f"q{i}: point must be positive number")
    if t == 1:
        ans = q.get("answers")
        if not isinstance(ans, list) or len(ans) < 2 or any(not isinstance(a, str) or not a.strip() for a in ans):
            fail(f"q{i}: answers must be a list of >=2 non-empty strings")
        if len(set(ans)) != len(ans): fail(f"q{i}: duplicate answer strings")
        ca = q.get("correct_answer")
        ca_list = ca if isinstance(ca, list) else [ca] if isinstance(ca, int) else None
        if ca_list is None: fail(f"q{i}: correct_answer must be int or list of ints")
        if len(ca_list) != len(set(ca_list)): fail(f"q{i}: duplicate correct_answer indices")
        if any(not isinstance(x, int) for x in ca_list): fail(f"q{i}: correct_answer entries must be ints")
        if any(x < 1 or x > len(ans) for x in ca_list): fail(f"q{i}: correct_answer index out of range")
    else:  # type 2
        if "answers" in q: fail(f"q{i}: type 2 must not have answers")
        if not isinstance(q.get("answer"), str) or not q["answer"].strip(): fail(f"q{i}: answer missing/empty")
        tb = q.get("textbox_type", 1)
        if tb not in (1, 2): fail(f"q{i}: textbox_type must be 1 or 2")
        if "case_sensitive" in q and not isinstance(q["case_sensitive"], bool):
            fail(f"q{i}: case_sensitive must be boolean")
print("VALID")
```

### Option B — Node/Bun (use if a JS runtime is available; js-yaml is the app's parser)

```bash
bunx tsx - <<'SCRIPT'
import { load } from 'js-yaml';
const YAML_TEXT = `
(paste your YAML here)
`;
const fail = (m: string) => { throw new Error(`INVALID: ${m}`); };
const doc = load(YAML_TEXT) as any;
if (typeof doc !== 'object' || doc === null) fail('top-level must be a mapping');
if (typeof doc.title !== 'string' || !doc.title.trim()) fail('title missing/empty');
const qs = doc.questions;
if (!Array.isArray(qs) || qs.length === 0) fail('questions must be a non-empty list');
qs.forEach((q: any, i: number) => {
  const n = `q${i + 1}`;
  if (typeof q?.question !== 'string' || !q.question.trim()) fail(`${n}: question missing/empty`);
  const t = q.type ?? 1;
  if (t !== 1 && t !== 2) fail(`${n}: type must be 1 or 2`);
  const point = q.point ?? 1;
  if (typeof point !== 'number' || point <= 0) fail(`${n}: point must be positive number`);
  if (t === 1) {
    const ans = q.answers;
    if (!Array.isArray(ans) || ans.length < 2 || ans.some((a: any) => typeof a !== 'string' || !a.trim()))
      fail(`${n}: answers must be a list of >=2 non-empty strings`);
    if (new Set(ans).size !== ans.length) fail(`${n}: duplicate answer strings`);
    const ca = q.correct_answer;
    const list = Array.isArray(ca) ? ca : typeof ca === 'number' ? [ca] : null;
    if (!list) fail(`${n}: correct_answer must be int or list of ints`);
    if (new Set(list).size !== list.length) fail(`${n}: duplicate correct_answer indices`);
    if (!list.every((x: any) => typeof x === 'number' && Number.isInteger(x))) fail(`${n}: correct_answer entries must be ints`);
    if (!list.every((x: number) => x >= 1 && x <= ans.length)) fail(`${n}: correct_answer index out of range`);
  } else {
    if ('answers' in q) fail(`${n}: type 2 must not have answers`);
    if (typeof q.answer !== 'string' || !q.answer.trim()) fail(`${n}: answer missing/empty`);
    const tb = q.textbox_type ?? 1;
    if (tb !== 1 && tb !== 2) fail(`${n}: textbox_type must be 1 or 2`);
    if ('case_sensitive' in q && typeof q.case_sensitive !== 'boolean') fail(`${n}: case_sensitive must be boolean`);
  }
});
console.log('VALID');
SCRIPT
```

## Step 6 — Fix and finish

- If the validator prints `INVALID: ...`, fix the named error and re-run. Loop until
  you see `VALID`.
- Only after the validator prints `VALID` do you show the YAML to the user, in one
  fenced ```yaml block.
- End with a one-line offer to generate another module on a different topic.