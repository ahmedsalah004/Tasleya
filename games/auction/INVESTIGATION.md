# Auction investigation pass (bugs / flow / logic)

Date: 2026-04-17 (UTC)
Scope: `games/auction/index.html`, `games/auction/data.js`, `games/shared/game-rooms.js`

## Runtime status
- Browser runtime automation was not available in this environment, so this pass is a static logic review plus command-line validation.
- I validated inline JS syntax by extracting it and running `node --check`.

## Intended flow from current code
1. Load question bank from `/mazad/questions` via `data.js`.
2. Player picks mode:
   - local same-device mode, or
   - online room mode (Firebase room + action queue).
3. For each round:
   - each team chooses answerer (`selectedAnswerers` / `roles`),
   - reveal question,
   - start bidding,
   - bidding ends and one team attempts,
   - judge awards one point,
   - next question.
4. After 10 questions, show final winner text.
5. Local mode persists state in `localStorage` and supports resume.

## Key issues found

### 1) Data-load failure UI can be invisible before mode selection
- Severity: **critical**
- Root cause: `setDataState()` only changes in-game phases, but `initializeQuestions()` does not switch to `gameScreen` when load fails.
- User symptom: On first load failure, user can remain on mode screen without seeing the actual failure card.
- Minimal fix: Ensure loading/error states also call `showScreen("game")` (or block mode screen until data source is ready).

### 2) Local resume can be accidentally erased by same-device button
- Severity: **high**
- Root cause: `singleDeviceModeBtn` always calls `clearLocalResume()` before reset.
- User symptom: A user with pending resume can lose progress by tapping “اللعب على نفس الجهاز” instead of resume button.
- Minimal fix: If `pendingLocalResume` exists, ask for confirmation or force explicit “ابدأ لعبة جديدة” path before clearing.

### 3) Host-only online actions appear usable to all players but are ignored silently
- Severity: **high**
- Root cause: buttons submit actions from any client; host reducer rejects non-host for reveal/start/judge/next/reset.
- User symptom: Non-host taps button and nothing happens, perceived broken flow.
- Minimal fix: Disable/hide host-only controls in UI when `!isHost()`.

### 4) Local resume restoration is under-validated (stale/malformed state risk)
- Severity: **medium**
- Root cause: `readLocalResume()` validates only version/mode/questions existence.
- User symptom: malformed `localStorage` can produce undefined labels or invalid round state.
- Minimal fix: sanitize and clamp `questionIndex`, `roles`, `bid.turnTeam`, `bid.leadingTeam`, `attempt.team`, and phase.

### 5) Resume into judge/between phases loses contextual text
- Severity: **medium**
- Root cause: `applyLocalResume()` sets `judge`/`between` phase without rebuilding `judgeHint` / `betweenText`.
- User symptom: blank status text after refresh; confusing decision context.
- Minimal fix: rebuild those text blocks from saved state before showing phase.

### 6) Bidding rule inconsistency between local and online
- Severity: **medium**
- Root cause: local bid input allows jumps to any value >= min; online BID is fixed +1 and hides numeric input.
- User symptom: same game behaves differently by mode.
- Minimal fix: unify rule in both modes (either +1 only or explicit chosen value in both).

### 7) Online bidding helper copy references hidden control
- Severity: **low**
- Root cause: helper note says press “إيقاف المزاد”, while online hides stop button and uses timeout.
- User symptom: UX confusion and perceived missing button.
- Minimal fix: conditional helper text for online vs local.

### 8) Fragile dual state-machine design (local vs online phases)
- Severity: **low** (architecture risk)
- Root cause: duplicated phase logic with different phase names (`attemptReady` local-only, `question_reveal` online-only, etc.).
- User symptom: future regressions likely when changing round flow.
- Minimal fix: centralize transition map / invariants and convert adapters at boundary.

## Prioritized action plan

### Must fix before merge
1. Data-load failure visibility issue.
2. Host-only controls silently failing for non-host.
3. Resume-loss hazard on same-device mode button.

### Should fix soon
1. Resume validation hardening.
2. Restore judge/between context text after resume.
3. Align local/online bidding rule behavior.

### Nice to improve later
1. Online/local helper copy mismatch.
2. Refactor brittle dual state machine to reduce regression risk.
