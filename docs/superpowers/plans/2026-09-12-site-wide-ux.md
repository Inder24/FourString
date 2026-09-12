# Four Strings Site-wide UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after design approval. Steps use checkbox (`- [ ]`) syntax for tracking. Use subagent-driven-development only if delegated execution is selected or explicitly authorised.

**Goal:** Make every existing destination immediately understandable, comfortable on a phone, and focused on playing, hearing and improving.

**Architecture:** Keep the existing vanilla TypeScript application and its audio, microphone and lesson controllers. Introduce small presentation modules around existing state rather than a competing application state machine. Deliver the shared workspace, library journey and AI presentation as separately reviewable increments, not a one-shot rewrite of `main.ts`.

**Tech Stack:** Vite, vanilla TypeScript, semantic HTML, CSS tokens, native Web Audio/Pointer Events, Vitest and existing Playwright fixtures. No new runtime framework or dependency is required.

**Spec:** [Guided-workbench design proposal](../specs/2026-09-12-site-wide-ux-design.md)

**Evidence:** [13 current-run browser captures and findings](../../design/audits/2026-09-12-site-ux/audit.md)

**Status:** Proposed; not implemented. This document records the requested plan. Approve the design direction and select a visual target before implementation. No commit, push, deployment, microphone capture or paid API call is authorised by this plan alone.

## Global constraints

- Keep Play / Practice / AI Coach / Tune. Keep normal Coach inside Practice → Quick drills.
- Practice secondary destinations are 10-minute session / Songs & lessons / Quick drills.
- Use **On-screen ukulele / My ukulele** wherever both are supported. Choosing My ukulele never forces a tuner detour.
- Preserve one-hand latching and two-hand held frets; keep all four GCEA strings, twelve frets and the 30-note phrase limit.
- String clarity has no tempo requirement. Say **Pluck once and let it ring**, not play continuously or seven times.
- Preserve existing pitch-gap tolerance, pulse-gap grading, sound scheduling, microphone ownership and capture cleanup.
- Melody, accompaniment and original exercise are distinct promises. Unverified arrangements are not playable defaults or named session finishers.
- Astra gets structured measurements, not audio. Do not add API calls merely to demonstrate the interface. Keep the key server-side.
- Keep Fraunces/Manrope and the koa, rosewood, cream and coral identity. Use the existing instrument assets, not a new decorative illustration system.
- Current target and primary action must fit together at 390 × 844 and 1280 × 720. Check 844 × 390, 1024 × 768 and 1440 × 900 too.
- Primary touch actions and frets target 44 × 44 CSS pixels. Intentional neck scrolling is allowed; unintended page overflow is not.
- Keep physical-instrument and provider limitations visible at relevant decisions. Never imply microphone chord recognition or that a configured key proves service availability.
- Do not add accounts, streaks, persistent progress, a teacher-review badge, more courses, chat or a framework migration to this redesign.
- The existing worktree contains unrelated/prior changes. Inventory them first; preserve them. Do not overwrite or stage the entire tree.

## Rollout and decision gates

| Increment | Outcome | Release gate |
|---|---|---|
| 0 · Select the design | One approved shared active-practice screen, desktop and phone | User chooses a visual target |
| 1 · Fix trust and state | No blocked source choice across destinations, misleading finisher or irrelevant Continue action | Targeted regressions pass |
| 2 · Make playing the focal point | Compact shell, Now/Next, reachable transport, consistent source choice | Target/action fit on desktop and phone |
| 3 · Make lessons discoverable | Browse → overview → player → summary; available starters first | Search/back/chapter/source flows pass |
| 4 · Simplify AI teaching | Clear stages, one correction, actual tempo and readable comparison | Entire mocked baseline/retry/error flow passes |
| 5 · Verify the experience | Accessible layouts and no functional regression | Automated checks plus real-instrument acceptance |

## File boundaries

Current entry points are `index.html`, `src/main.ts` (approximately 3,600 lines), `src/style.css` (approximately 6,700 lines) and `src/adaptive-coach-controller.ts` (approximately 1,100 lines). Avoid enlarging those files with another standalone UI system.

| File | Responsibility in this plan |
|---|---|
| `src/ui/workspace.ts` — new | Task header, source/readiness and Now/Next presentation contracts; DOM text/attributes only |
| `src/ui/workspace.css` — new | Scoped compact shell, shared transport, responsive insets and focus styles |
| `src/ui/lesson-browser.ts` — new | Library/overview/player/summary presentation state and outcome metadata, without owning lesson timing |
| `src/ui/ai-phase-view.ts` — new | Pure mapping from existing AI phases to learner stage/action visibility |
| `src/main.ts`, `index.html` | Integrate these views with current controllers; retain one authority for each exercise cursor |
| `src/guidance.ts` | Existing note/chord/gesture copy reused by every Now/Next presentation |
| `src/lesson-trust.ts`, `src/lesson-trust-ui.ts` | Existing provenance and playable policy, including exercise filtering |
| `src/adaptive-coach-controller.ts` | Existing scheduling/capture authority; only phase presentation and approved transition policy change |
| `src/take-traces.ts`, `src/mistake-panel.ts` | Reuse real timing comparison and explanation; do not manufacture waveform data |
| `tests/ux-state.spec.ts` — new | Cross-destination and phase-visibility regressions |
| `tests/workspace-layout.spec.ts` — new | Target/action visibility, input layouts and safe-area behavior |
| `tests/lesson-journey.spec.ts` — new | Library/overview/player/back/summary journey |

Keep new modules small. Do not move unrelated application logic just to achieve an arbitrary file-length target. Commit boundaries, if separately requested, should match these reviewable increments; never stage all existing changes.

---

## Task 0: Approve one visual target

**Files:** this plan, the linked spec, and new selected-design images under `docs/design/2026-09-12-guided-workbench/`.

**Consumes:** current-run screenshots 04 active practice, 07 lesson, 12 mobile AI and 13 mobile Play; existing CSS tokens and instrument assets.

**Produces:** an approved desktop/phone shared practice layout, plus decisions on density and optional auto-continue. No app changes.

- [ ] Read the spec and audit together; confirm the guided-workbench direction and the proposed manual-Continue default for AI feedback.
- [ ] Use Product Design Ideate, following its full skill, to generate three source-grounded alternatives for the **same active-practice state**: instrument-led, balanced target/instrument, and compact lesson-led. Keep the same content and warm identity in all three.
- [ ] Include the current screenshot in generation input. Use the existing instrument asset; do not invent decorative controls or fake learning results. Produce desktop and phone views of the preferred direction.
- [ ] Compare target visibility, playable area, main action, mic state and one/two-hand support. Select with the user; record the chosen images and decisions in the spec.
- [ ] Only after selection, begin Task 1. Do not scaffold a replacement project or install a design tool to fulfil this task.

**Acceptance:** a learner can point to “what to play” and “what to do next” on both selected views. An attractive mock without reachable controls is not accepted.

## Task 1: Repair confusing availability and navigation states

**Modify:** `src/main.ts`, `src/style.css`, `index.html`; named musical-finish copy currently rendered from session setup.

**Test:** new `tests/ux-state.spec.ts`, existing `tests/quick-drills.spec.ts`, `tests/animated-coach.spec.ts`, `tests/lesson-trust.spec.ts`.

**Consumes:** `setView`, `setPracticeInput`, `renderInstrumentSource`, active/paused session state and existing AI phase attributes.

**Produces:** trustworthy action visibility and a paused session with an explicit retained input context.

- [ ] Add a failing cross-view test using the real screen-instrument flow:

```ts
test('a paused session does not lock Quick drills input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Quick drills', exact: true }).click();
  await expect(page.getByRole('button', { name: 'My ukulele', exact: true })).toBeEnabled();
});
```

- [ ] Add the observed phase-visibility regression with the existing fake audio/provider helper:

```ts
import { installTeachingFixture } from './helpers/ai-fixture';

test('demo has Stop, not an unrelated Continue shortcut', async ({ page }) => {
  await installTeachingFixture(page);
  await page.locator('#ai-demo').click();
  await expect(page.locator('#ai-coach-workbench')).toHaveAttribute('data-phase', 'demo');
  await expect(page.locator('#ai-skip-wait')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Stop example', exact: true })).toBeVisible();
});
```

- [ ] Run `npm run test:e2e -- tests/ux-state.spec.ts`; verify failures are the specific observed defects, not fixture/setup failures.
- [ ] Scope source locks to the current active activity. Retain the paused session's source separately from the newly selected source. On returning with a mismatch, show **Resume with previous instrument** and **Restart with this instrument**; neither option silently discards progress or starts a mic before activation.
- [ ] Check computed styles for hidden elements. Preserve the controller's phase decisions; fix selectors that override the HTML `hidden` attribute. Do not simply disable a visible irrelevant Continue button.
- [ ] Replace Lathe/Khaab choices in the generic session finisher with **Original chord-flow exercise**. Keep the encoded original exercise, but remove the unsupported song promise. Existing guarded song playback remains guarded.
- [ ] Rename the local drill action to **Start drill** and update only the corresponding accessible-name assertions. Preserve all timing and acceptance assertions.
- [ ] Run the four targeted suites listed above. Manually inspect pause → drills → source switch → return → resume/restart, including cancellation and microphone release with fixtures.

**Acceptance:** another destination never inherits an unexplained source lock; no unverified song is advertised as a named playable finisher; each AI phase shows only relevant actions.

## Task 2: Introduce the shared, compact practice workspace

**Create:** `src/ui/workspace.ts`, `src/ui/workspace.css`, `tests/workspace-layout.spec.ts`.

**Modify:** `src/main.ts`, `index.html`, `src/style.css`; reuse `src/guidance.ts`.

**Consumes:** active controller target, next target, current source, capture/readiness state and existing guidance strings.

**Produces:** one shared presentation contract; it does not schedule sound or advance lessons.

```ts
export type WorkspaceCue = {
  activity: string;
  current: string;
  detail: string;
  next: string | null;
  acknowledgement: string | null;
};

export function renderWorkspaceCue(root: HTMLElement, cue: WorkspaceCue): void {
  for (const key of ['activity', 'current', 'detail', 'next', 'acknowledgement'] as const) {
    const node = root.querySelector<HTMLElement>(`[data-cue="${key}"]`);
    if (!node) throw new Error(`Missing workspace cue: ${key}`);
    node.textContent = cue[key] ?? '';
    node.hidden = cue[key] === null;
  }
}
```

- [ ] Add layout tests before integration. The selected mock must expose `[data-current-target]` and `[data-primary-action]` in each active workspace so layout checks are explicit rather than based on arbitrary card dimensions:

```ts
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  test(`active practice is reachable at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Practice', exact: true }).click();
    await page.getByRole('button', { name: 'Start session', exact: true }).click();
    await expect(page.locator('[data-current-target]:visible')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('[data-primary-action]:visible')).toBeInViewport({ ratio: 1 });
  });
}
```

- [ ] Run `npm run test:e2e -- tests/workspace-layout.spec.ts`; require a failing pre-change layout assertion.
- [ ] Implement the approved layout in the ten-minute active session first: compact TaskHeader → one Now/Next strip → instrument or live-input stage → transport. Remove duplicated full-size target/intro presentations from this state.
- [ ] Render note and chord content through the existing `stringHint`, `gestureHint`, `chordNoteNames` and controller event cursor. Display each acceptance once with a polite live announcement; do not announce every animation frame.
- [ ] Render one labelled source choice, current BPM and capture state. Put future stages, helper prose and sources in separately labelled details; errors and recovery remain outside details.
- [ ] Reserve mobile space for navigation plus transport, including `env(safe-area-inset-bottom)`. Add scroll padding and focused-control scroll margins. Keep transport next to the stage on desktop.
- [ ] Migrate Quick drills and the shared top-level navigation to this shell, then run `npm run test:e2e -- tests/workspace-layout.spec.ts tests/quick-drills.spec.ts tests/ux-state.spec.ts`.

**Acceptance:** targets, actions and mic state are visible together; sound timing and pitch confirmation stay owned by their existing controllers. Verify screen G acceptance and real-input fixture acceptance both update the same presentation.

## Task 3: Make Play and Tune task-first

**Modify:** `src/main.ts`, `index.html`, `src/ui/workspace.css`, existing Play/Tune styles. Do not change `src/audio.ts` or YIN analysis for layout reasons.

**Test:** `tests/app.spec.ts`, `tests/workspace-layout.spec.ts`, existing tuner lifecycle and state unit tests.

**Consumes:** existing Play/Explore, one/two-hand, sequence, tuner status and selected-string state.

**Produces:** immediate instrument access, explicit phrase-building mode and a truthful waiting tuner.

- [ ] Add a browser regression asserting **Build a pattern** activates note collection while **Just play** previews without changing sequence length. Retain the existing 30-note/repeat/tempo test assertions rather than replacing them with a screenshot-only check.
- [ ] Add the unset-reading contract:

```ts
test('Tune does not present a successful reading before listening', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tune', exact: true }).click();
  await expect(page.locator('[data-tuning-reading]')).toHaveText('—');
  await expect(page.getByRole('button', { name: 'Start listening', exact: true })).toBeEnabled();
});
```

- [ ] Run the new tests and confirm the missing presentation is the failure.
- [ ] Replace the required Play welcome gate with contextual sound enablement and optional **What can I do here?** help. Real-instrument discovery links open Practice, AI Coach or Tune intentionally; no implicit microphone capture.
- [ ] Give Fingerpick **Just play / Build a pattern** modes; initially collapse the empty sequence. When building, show 0/30, numbered string/fret entries, existing Undo/Clear, current BPM and Play/Stop together.
- [ ] Preserve neck scrolling and 44px targets in phone portrait; keep the strum deck reachable. In landscape, reduce explanatory chrome before reducing playable space. Test both hand modes with simultaneous pointers.
- [ ] Give Tune one target/heard/adjustment group with `data-tuning-reading`, explicit unset/stale state and nearby Start/Stop/Hear target. Optional **Tune first** from an activity records a return destination; **Back to lesson** restores it without auto-starting capture.
- [ ] Run `npm run test -- src/state.test.ts src/tuner.test.ts src/tuner-lifecycle.test.ts` and `npm run test:e2e -- tests/app.spec.ts tests/workspace-layout.spec.ts`.

**Acceptance:** a phone user can play without dismissing a tutorial; preview/build semantics are unambiguous; an idle tuner cannot be mistaken for an in-tune result.

## Task 4: Separate lesson discovery from lesson performance

**Create:** `src/ui/lesson-browser.ts`, `tests/lesson-journey.spec.ts`.

**Modify:** `src/main.ts`, `index.html`, `src/lesson-trust.ts`, `src/lesson-trust-ui.ts`, `src/ui/workspace.css`.

**Test:** `src/lesson-trust.test.ts`, `tests/lesson-trust.spec.ts`, `tests/songs-real.spec.ts`, `tests/app.spec.ts`.

**Consumes:** `LESSON_SONGS`, `LessonSong`, `canPracticeLessonSong`, `filterLessonLibrary`, existing chapter/phase/cursor and take recording controls.

**Produces:** `LessonBrowserView = 'library' | 'overview' | 'player' | 'summary'`; this view changes presentation only. Search/filter state survives Back to lessons during the current page session.

- [ ] Extend the filter unit test to cover exercise material before changing the union:

```ts
expect(filterLessonLibrary(LESSON_SONGS, '', { status: 'all', type: 'exercise' })
  .map(song => song.id)).toContain('sargam');
```

- [ ] Add a browser test for the new journey and preserved search:

```ts
test('browse context is restored after a lesson overview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Songs & lessons', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search lessons' }).fill('Twinkle');
  await page.getByRole('button', { name: 'Open Twinkle Twinkle', exact: true }).click();
  await expect(page.locator('[data-lesson-view="overview"]')).toBeVisible();
  await expect(page.locator('[data-lesson-view="library"]')).toBeHidden();
  await page.getByRole('button', { name: 'Back to lessons', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search lessons' })).toHaveValue('Twinkle');
});
```

- [ ] Run the targeted unit/browser tests; confirm failures before implementing the views.
- [ ] Change `LessonLibraryFilters.type` to `'all' | LessonMaterialType`. Present All / First notes / Melody / Chord accompaniment; map First notes to exercise. Keep source filters under More filters.
- [ ] Order available starters as Sargam, Twinkle, Yellow, I'm Yours, still applying `canPracticeLessonSong` at render and action time. Put unavailable entries in a separate expandable group; do not auto-select one or remove its evidence.
- [ ] Render outcome-led cards and an overview with technique, scope, prerequisites and chapter choices before Start. Distinguish accompaniment from the melody the learner may expect to hear.
- [ ] Hide the library in player view. Bind Now/Next, highlighted phrase, chord/fret diagram and hints to the same current event for both demo and practice. Use the shared source labels and transport; reference scope is Note / Phrase / Full demo with BPM visible.
- [ ] Put saved-take controls in an optional **My take** drawer. Keep the exact supported recording type visible. Back/chapter/source changes stop previews and recordings using existing lifecycle hooks; returning does not resume sound automatically.
- [ ] Render a completion summary from actual session completion, not persistent mastery. Offer Repeat chapter / Next chapter / Back to lessons, with unavailable actions omitted.
- [ ] Run `npm run test -- src/lesson.test.ts src/lesson-trust.test.ts src/song-input.test.ts` and `npm run test:e2e -- tests/lesson-journey.spec.ts tests/lesson-trust.spec.ts tests/songs-real.spec.ts tests/app.spec.ts`.

**Acceptance:** search → choose chapter → demo → screen/real practice → completion → back works without stacked browsing chrome. Unverified main and secondary playback stays blocked.

## Task 5: Make the AI loop understandable at every phase

**Create:** `src/ui/ai-phase-view.ts`, `src/ui/ai-phase-view.test.ts`.

**Modify:** `src/adaptive-coach-controller.ts`, `index.html`, `src/ui/workspace.css`; presentation of `src/take-traces.ts` and `src/mistake-panel.ts` only where needed.

**Test:** `tests/animated-coach.spec.ts`, `tests/ai-confidence.spec.ts`, `tests/ai-explanation.spec.ts`, `tests/ux-state.spec.ts`.

**Consumes:** the existing controller's `AdaptiveCoachPhase`, `RhythmAttempt['kind']`, current BPM, decision, capture quality, attempts, focused region and playback selection. Export the existing phase type from `src/adaptive-coach-controller.ts` and import it with `import type`; do not maintain a duplicate phase list or invent an `AdaptiveCoachState` object that this controller does not use.

**Produces:** a pure presentation function with the following contract. Error UI retains the last meaningful stage alongside its recovery action.

```ts
import type { AdaptiveCoachPhase } from '../adaptive-coach-controller';
import type { RhythmAttempt } from '../adaptive-coach';

export type AiStage = 'listen' | 'check-mic' | 'play' | 'feedback'
  | 'slow-practice' | 'retry' | 'compare';

export function aiStageForPhase(
  phase: AdaptiveCoachPhase,
  attemptKind: RhythmAttempt['kind'],
  lastStage: AiStage,
): AiStage {
  switch (phase) {
    case 'setup': case 'demo': return 'listen';
    case 'calibrating': case 'quality-check': return 'check-mic';
    case 'preparing': case 'count-in': case 'recording':
      return attemptKind === 'retry' ? 'retry' : 'play';
    case 'analysing': case 'correction': case 'retry-count-in': return 'feedback';
    case 'focused-demo': case 'mistake-demo': return 'slow-practice';
    case 'comparison': return 'compare';
    case 'error': return lastStage;
  }
}
```

| Existing phase/context | Learner stage | Primary presentation |
|---|---|---|
| setup, demo | Listen | Hear example / Stop example, then Check microphone |
| calibrating, quality-check | Check mic | Quiet check/test pluck; Continue only when ready |
| preparing, count-in, recording with no retry | Play | 5-second preparation, 4/3/2/1/PLAY, take lane, Cancel |
| analysing, correction, retry-count-in awaiting review | Feedback | Analysing state or one correction; Continue/optional timed pause |
| focused-demo, mistake-demo | Slow practice | Current BPM, exact focus/loop, Stop; classify replay purpose in the label |
| preparing, count-in, recording with a retry attempt | Retry | Same timing cues, actual retry BPM, Cancel |
| comparison | Compare | Expected/First/Retry, one conclusion and next action |

The existing retry-attempt context differentiates Play from Retry. Do not derive timing or capture eligibility from the rail.

- [ ] Write pure mapping tests before implementing the presentation function:

```ts
expect(aiStageForPhase('demo', 'baseline', 'listen')).toBe('listen');
expect(aiStageForPhase('quality-check', 'baseline', 'listen')).toBe('check-mic');
expect(aiStageForPhase('focused-demo', 'retry', 'feedback')).toBe('slow-practice');
expect(aiStageForPhase('recording', 'retry', 'slow-practice')).toBe('retry');
expect(aiStageForPhase('comparison', 'retry', 'retry')).toBe('compare');
expect(aiStageForPhase('error', 'retry', 'feedback')).toBe('feedback');
```

- [ ] Add a table-driven browser assertion for phase-appropriate action visibility; no hidden Continue leaks during demos or recording.
- [ ] Add a manual-review regression using `installTeachingFixture`, `completeCalibration` and `captureStrums`: complete a baseline, advance the fake clock by 15 seconds, assert the correction remains visible and no automatic new capture starts when Auto-continue is off.
- [ ] Run the targeted tests and confirm the intended new manual-review behavior fails on the old default. Treat it as an approved behavior change, not an accidental regression to hide.
- [ ] Implement the stage rail and one main task header. Put Hear/Start or Stop/Cancel next to the actual BPM and teaching stage in the first viewport. Remove the empty full-height explanation sidebar.
- [ ] Keep provider configuration, microphone permission and capture quality distinct. Local measurements remain local-labelled; use **Powered by GPT-6 Astra** only at entry and on actual generated responses.
- [ ] Implement the approved manual-Continue default after feedback. Optional Auto-continue has a visible ten-second minimum review countdown and Pause; retain five-second preparation plus four audible/visible counts before a take. No examples run while recording.
- [ ] Keep Steady downs instructions down-only. Use actual scheduled tempo for guide movement, labels, focused demo and retry; do not rescale only the animation. Preserve whole-loop spacing across repetition boundaries.
- [ ] Present Expected / First take / Retry on one axis with comparable focused ranges. Label these timing marks, not a waveform. Preserve original-vs-retry tempo context and replay choice; never imply “improved” if capture quality makes comparison invalid.
- [ ] Keep one focused correction, error/on-time/miss/extra summary, and existing selected-mistake explanation. Put additional metrics/evidence in a drawer; no new free-form AI chat.
- [ ] Run `npm run test -- src/adaptive-coach.test.ts src/take-traces.test.ts src/mistake-explanation.test.ts src/capture-quality.test.ts` and `npm run test:e2e -- tests/animated-coach.spec.ts tests/ai-confidence.spec.ts tests/ai-explanation.spec.ts tests/ux-state.spec.ts`.

**Acceptance:** mocked flow reaches comparison for all three patterns; 60 BPM is visible and actually scheduled; a result can be read without time pressure; recordings remain distinct and cleanup survives navigation/reset/error.

## Task 6: Verify visual consistency, accessibility and complete journeys

**Modify:** only scoped presentation fixes discovered by verification; store selected-mock comparisons and new captured states beside the design artifacts.

**Consumes:** all prior increments, existing unit/browser suites and the approved visual target.

**Produces:** a dated verification report separating automated evidence, real-device checks, usability observations and remaining limitations.

- [ ] Add overflow and target-size assertions to `tests/workspace-layout.spec.ts`:

```ts
expect(await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth
)).toBe(true);
const action = page.locator('[data-primary-action]:visible');
const box = await action.boundingBox();
expect(box).not.toBeNull();
expect(box!.width).toBeGreaterThanOrEqual(44);
expect(box!.height).toBeGreaterThanOrEqual(44);
```

- [ ] Capture Play, built phrase, active session, Quick drills, library, overview, player, Tune waiting/live/error and every AI learner stage at 390 × 844, 844 × 390, 1024 × 768 and 1440 × 900. Use fixture-driven mic/AI states for repeatability and label them as simulated.
- [ ] Compare the approved design with fresh implementation screenshots at matching size/state. Correct title scale, target/transport placement, contrast, safe-area overlap and clipped controls before accepting each view.
- [ ] Check keyboard traversal, visible focus at 200% zoom, reduced motion, target labels and status announcements. Use text/icons as well as colour for accepted/early/late/missed; never announce the playhead every frame.
- [ ] Run `npm run build`, `npm run test`, and `npm run test:e2e`. Reuse the existing local server if suitable. When the active browser skill requires explicit approval for the Playwright CLI, get that approval before running the CLI; browser-skill inspection itself can continue.
- [ ] Preserve these musical regressions: all 52 notes; simultaneous pointer holds; latch/clear/blur cleanup; 30-note repeat playback and tempo; numeric keys after focused lesson buttons; no reference-audio scoring; pulse pause restart; pitch brief-gap acceptance; real-song progression; synced demo/lesson cues; unverified playback blocking; replay distinction; AI late/miss/extra/latency fixtures.
- [ ] Check actual API error UI with mocked missing key, timeout, rate limit and malformed result. Scan build output for accidental secret inclusion without printing any secret. A live Astra request requires separate explicit approval if not already authorised for that verification run.
- [ ] With the user and a real ukulele, verify pitch acceptance, tuner hold, noisy-room recovery, full lesson progression and one complete AI attempt/retry using speakers and headphones. Repeat Chrome/Firefox/Safari before claiming cross-browser physical-instrument readiness. Do not count synthetic fixtures as this validation.
- [ ] Observe five beginner trials: start screen play; find a first-notes lesson; start real-instrument practice without visiting Tune; understand one AI correction and retry; tune and return. Aim for at least four of five unaided per task, record misunderstandings, and do not treat five participants as a population estimate.
- [ ] Write the verification report and list any failing/untested states explicitly. Do not say “no regression” based on screenshots alone. Offer the completed preview for inspection; commit/push only if requested separately.

## Spec coverage check

| Design requirement | Delivery |
|---|---|
| Existing identity, visual selection, coherent tokens | Tasks 0, 2, 6 |
| Navigation, source ownership, honest availability | Tasks 1, 2, 4 |
| One target, nearby instrument, shared hints/transport | Tasks 2, 4 |
| One/two hands, 30-note builder, no forced onboarding | Task 3 |
| Tuner readiness, retained readings, return route | Task 3 |
| Library outcomes, first-notes filter, provenance | Task 4 |
| Synced song demo/practice cues and take scope | Task 4 |
| AI stages, manual result review, tempo and comparison | Task 5 |
| Phone, keyboard, motion, regression and real-device checks | Task 6 |

## Handoff

Next decision: approve the **guided-workbench** direction and create three visual options for the shared active-practice screen. No new app feature is needed to demonstrate the value: the redesign should make existing playing, picking, lessons, tuning and evidence-backed coaching visible through a clear first action and a tangible result.
