# src/pages

## OVERVIEW
Page flow: Home → Start → Running → End. All routes use HashRouter (`#/` prefix).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Landing | `Home.tsx` | Single button navigates to `/start` |
| Module selection | `Start.tsx` | Search, category grouping, mode/randomize toggle |
| Quiz interface | `Running.tsx` | Navigation, submit, flag, ConfirmPopup |
| Results | `End.tsx` | Score summary, per-question breakdown |

## PAGE FLOW
```
Home → navigate('/start')
Start → navigate('/running', { state: { modules, mode, randomize } })
Running → navigate('/end', { state: { results, mode, questions, answers, modules, randomize } })
End → navigate('/start') or navigate('/running', { state: { modules, mode, randomize } })
```

## ROUTING CONVENTIONS
- **State passing**: Pages receive data via `location.state` from previous page
- **Running.tsx guard**: Redirects to `/start` if `!location.state?.modules`
- **End.tsx guard**: Shows fallback UI if `!state?.results`
- **Back navigation**: Each page has back/exit button pointing to `/start`

## START.PTX CONVENTIONS
- `QuizConfig` interface stored in `jayawijaya-config` localStorage key
- Module selection persists across sessions
- Mass assign/delete operates on `selectedModuleIds`
- Category filter via `categoryId` field on Module objects

## RUNNING.PTX CONVENTIONS
- `practiceSubmitted` local state (not quiz state) controls per-question reveal
- `ConfirmPopup` handles both "next question" and "finish" confirmation
- `questionStates` derived per-question via `getQuestionState(state, i, mode)`
- Last question button shows "FINISH" instead of "NEXT →"

## END.PTX CONVENTIONS
- Color coding: >=70% cyan, >=50% yellow, <50% pink
- `getUserAnswerText` / `getCorrectAnswerText` handle MCQ and text answers
- Retry re-navigates to Running with same modules/mode/randomize
