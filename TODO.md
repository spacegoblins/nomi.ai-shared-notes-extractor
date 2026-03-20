# Version 1.2 — TODO

## 1. Fix innerHTML Warning (Mozilla Review Blocker)

The Mozilla addon scanner flags `content.innerHTML = html` in popup.js (line 6) as an unsafe assignment. All dynamic values (`nomiName`, `nomiId`, `error` messages) are interpolated directly into HTML strings, which is an XSS vector.

**Fix:** Replace all `innerHTML` usage in popup.js with DOM construction using `createElement` / `textContent`. The static HTML structure can stay as template strings, but every dynamic value must be inserted via `textContent` on a discrete element — never concatenated into markup.

- [x] Rewrite `render()` in popup.js — replace `innerHTML` with a helper that builds DOM nodes
- [x] Each popup state (ready, navigate, warning, working) builds its UI via `createElement`
- [x] All dynamic values (`nomiName`, `nomiId`, error strings) set via `textContent` only
- [ ] Verify the addon scanner no longer flags the warning

## 2. Replace Hardcoded Timers with Polling + Timeouts

Three places use arbitrary `sleep()` delays that are either too long, too short, or can hang:

| Location | Current Behavior | Problem |
|---|---|---|
| background.js `waitForTabLoad` | Listener-based, no timeout | Hangs forever if tab loads before listener attaches |
| background.js `sleep(1500)` | Fixed wait for React render | Too short on slow connections, too long on fast ones |
| popup.js `setTimeout(1800)` | Closes popup on a timer | Closes before extraction finishes, or waits needlessly |

**Fixes:**

- [x] `waitForTabLoad`: Wrap in `Promise.race` with a 15-second timeout. If it times out, send an error message rather than hanging silently
- [x] Replace the 1500ms React sleep in background.js with a polling loop: inject a small check that queries for `textarea` elements, retry every 500ms, give up after 10 seconds
- [x] Remove the fixed `setTimeout(1800)` in popup.js — instead, keep the popup open and close it (or update the UI) only when the `extractResult` message arrives. Add a 15-second safety timeout so it doesn't sit in "Extracting..." forever

## 3. Add Basic Fail Protection

Currently, errors in background.js are silently swallowed and the user gets no feedback.

- [x] Wrap the entire `navigateAndExtract` handler in background.js in a try/catch — on failure, send an `extractResult` message with `success: false` and the error, so the popup (or a notification) can display it
- [x] In content.js, if `readTextareas()` returns fewer textareas than `FIELD_DEFINITIONS.length`, still export what was found but prepend a warning line to the output noting the mismatch (e.g., "Warning: Expected 10 fields, found 7 — some labels may be misaligned")
- [x] In content.js `scrollToRevealAll`, re-measure `scrollHeight` after each scroll pass so it handles pages that grow as virtualized content renders

## 4. Senior-Developer Polish

- [x] Remove redundant `isChatPage` regex — `/\/nomis\/\d+\/?$/` already covers the case without `$`, consolidate to one pattern
- [x] Clean up the duplicate `sleep()` definitions (one in background.js, one in content.js) — content.js needs its own since it runs in page context, but add a brief comment explaining why to prevent future confusion
- [x] Add a brief comment block at the top of each file stating its role (one line, not JSDoc novels)
- [x] Bump manifest.json version to `1.2`
- [ ] Update README.md changelog or version reference if applicable

## 5. Add Timestamp to Export Filename

Currently the exported file is named `NomiName_Shared_Notes.txt`. Add a `.MM-DD-YYYY-HHmm` suffix before the extension so users can visually identify export dates in file explorer.

Example: `Dalia_Shared_Notes.03-20-2026-1435.txt`

- [x] In content.js, generate a timestamp string from `new Date()` in `MM-DD-YYYY-HHmm` format
- [x] Append it to the filename: `${sanitizedName}_Shared_Notes.${timestamp}.txt`

## Order of Operations

1. Do all popup.js innerHTML rewrites first (item 1) — this is the review blocker
2. Refactor background.js timers and error handling (items 2 + 3)
3. Refactor content.js scroll logic and field validation (items 2 + 3)
4. Polish pass across all files (item 4)
5. Test end-to-end: chat page → navigate → extract → download
6. Test edge cases: slow load, wrong page, missing textareas.
