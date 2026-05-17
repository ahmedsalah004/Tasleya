# Tasleya Question-Loading Performance Investigation (Updated)

## What was implemented
A small safe patch was applied in `script.js` to improve observability and audio loading UX without changing gameplay logic, scoring, no-repeat logic, team logic, online sync rules, or question selection flow.

### 1) Performance debug instrumentation (opt-in)
- Added opt-in timing debug mode:
  - URL flag: `?perfDebug=1`
  - Or localStorage flag: `localStorage.setItem('tasleya_perf_debug', '1')`
- Added lightweight `performance.now()` tracing for question open path stages:
  - `open_tile_start`
  - `question_payload_resolved`
  - `text_rendered`
  - `question_render_pipeline_done`
  - `image_load_complete`
  - `image_error`
  - `audio_element_inserted`
  - `audio_loadedmetadata`
  - `audio_canplay`
  - `audio_canplaythrough`
  - `audio_error`
  - `question_open_failed`
- Timing log payload includes: `type`, `mode`, `category`, `points`, `tileId`, `cacheHit`, `elapsedMs`.
- Logs only appear when debug mode is enabled (no production console spam by default).

### 2) Audio loading UX improvements
- In `renderQuestionAudio`:
  - Added Arabic loading status: `جارٍ تجهيز المقطع الصوتي...`
  - Audio controls are hidden while loading (`controls=false`) then shown once ready (`loadedmetadata/canplay/canplaythrough`).
  - Added Arabic error fallback on failure:
    - `تعذر تحميل المقطع الصوتي. جرّب السؤال التالي أو تحقق من الاتصال.`
- No autoplay was added. Playback remains user-initiated, preserving browser/mobile restrictions.

### 3) Bounded audio warmup
- Extended warmup path to include audio metadata warmup:
  - `warmAudioResource()` added and called from `warmQuestionMedia()` for audio questions.
  - Warmup uses `preload="metadata"` and origin preconnect.
- Added bounded cache eviction to avoid memory bloat:
  - `MAX_AUDIO_WARMUPS = 3`
  - warmup cache keeps only most recent 3 audio URLs.

### 4) Image behavior retained
- Existing image warmup retained.
- Added perf timing marks for image load and image error; loading class behavior remains intact and still clears on both `load` and `error`.

## Exact files/functions changed
- `script.js`
  - Added: `isQuestionPerfDebugEnabled`, `createQuestionPerfTrace`
  - Updated: `openQuestion`
  - Updated: `renderQuestionContent`
  - Updated: `renderQuestionImage`
  - Updated: `renderQuestionAudio`
  - Added: `warmAudioResource`
  - Updated: `warmQuestionMedia`

## Validation scope and limitations
- Code-level verification performed locally (syntax + targeted snippet checks).
- Live remote worker/API timing and full browser interaction tests were not fully executable in this environment due network constraints, so real-world latency values still require in-browser verification against production/staging.
