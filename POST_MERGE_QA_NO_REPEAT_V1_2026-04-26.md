# Post-merge QA — No Repeat v1 (2026-04-26)

## Scope covered
- games/shared/recent-history.js
- games/guess-from-hint/runtime-loader.js
- games/emoji-movies/runtime.js
- games/auction/runtime-loader.js
- workers/sheets-proxy/src/index.js
- Route templates:
  - /
  - /games/
  - /games/guess-from-hint/
  - /games/emoji-movies/
  - /games/auction/
- Worker endpoints:
  - /guess-from-hint/questions
  - /emoji-movies/cards
  - /mazad/questions
  - /question

## Environment limitation
Live deployed/preview HTTP checks and browser runtime checks were blocked in this environment by outbound tunnel policy (`CONNECT tunnel failed, response 403`).

Because of that, this QA run validated:
1) merged source wiring and response-shape compatibility in-repo,
2) script ordering and helper loading strategy,
3) no obvious merge-time breakage in the targeted files.

It could **not** perform full live-console/gameplay/localStorage-on-deployed verification.

## Findings (static/in-repo validation)

### 1) Deployment freshness prerequisites in source
- `guess-from-hint` runtime loader dependency list includes `/games/shared/recent-history.js` before game data/runtime flow.
- `emoji-movies` page explicitly loads `/games/shared/recent-history.js` before `/games/emoji-movies/runtime.js` when missing.
- `auction` page includes `/games/shared/recent-history.js` before `/games/auction/runtime-loader.js`.

### 2) Runtime/No-Repeat integration
- Shared helper exposes `window.TasleyaRecentHistory` with:
  - `getRecentIds`
  - `markRecentId`
  - `clearRecentIds`
  - `buildScopeKey`
- No-repeat notice text is the expected Arabic message and is shown only through explicit exhaustion paths in:
  - guess-from-hint loader
  - emoji-movies runtime
  - auction runtime

### 3) localStorage design and PII risk (code-level)
- Storage key is `tasleya_recent_history_v1`.
- Stored values are per-scope arrays of normalized IDs/tokens.
- No code path in shared helper stores names/emails/IPs; it only stores IDs passed in by game runtimes.
- Scope construction:
  - guess-from-hint: `guess-from-hint` + `{ mode: "default" }`
  - emoji-movies: `emoji-movies` + `{ level: "all" }`
  - auction: `auction` + `{ category, difficulty }`

### 4) Worker/API compatibility (code-level)
- Endpoints remain present:
  - `/guess-from-hint/questions` → `{ questions, diagnostics }`
  - `/emoji-movies/cards` → `{ cards, diagnostics }`
  - `/mazad/questions` → `{ questions, diagnostics }`
  - `/question` supports `exclude_ids` and preserves exhaustion pattern with `QUESTION_POOL_EXHAUSTED` + 404 + additive `meta`.
- Additive diagnostics/meta fields are present without removing core arrays consumed by frontends.

## Verdict for this run
- **PARTIAL PASS** (static compatibility checks passed; live deployed execution checks blocked by environment).

## Recommended next step
Run the same checklist from a network-permitted browser environment (or CI browser runner with egress) to confirm:
- actual deployed freshness,
- runtime console clean state,
- 2-round gameplay smoke per target game,
- actual localStorage payloads after play,
- no-repeat notice behavior during real exhaustion.
