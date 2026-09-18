# Four Strings Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the selected Modern Luthier Studio design to every existing Four Strings destination without regressing playable or microphone behavior.

**Architecture:** Keep `index.html` IDs and the `setView()` state authority in `src/main.ts`. Add desktop/mobile navigation affordances, a final-layer `src/studio.css` stylesheet and locally bundled raster materials. Use existing audio, lesson, coach and tuner modules unchanged unless a regression demands a narrowly tested fix.

**Tech Stack:** Vite, vanilla TypeScript, HTML, CSS, Web Audio, Vitest and Playwright. No new application framework or runtime dependency.

**Spec:** [Selected studio direction](../specs/2026-09-17-studio-redesign-design.md)

## Global Constraints

- Preserve all four GCEA strings, twelve frets, same-string voice replacement, Pointer Events, keyboard controls, one/two-hand layouts and 30-note fingerpick builder.
- Preserve one microphone owner and release it on view exit as `setView()` currently does.
- Preserve every song's existing source/trust label and audio/melody scope; visual design cannot imply an unverified arrangement is authentic.
- Keep AI audio local and only numeric timing evidence sent to Astra. Do not expose API keys in the bundle.
- Desktop navigation groups Play, Learn and Tools; mobile navigation has Play, Practice, Songs, AI Coach and a dismissible Tools menu.
- No uncontrolled page-wide horizontal scroll at 390×844, 844×390, 1024×768 or 1440×900. Instrument-neck scroll is intentional.
- Honor reduced motion and visible keyboard focus. New controls have >=44px touch targets on phone.

---

### Task 1: Navigation contract

**Files:** Modify `index.html`, `src/main.ts`; create `tests/studio-navigation.spec.ts`.

**Interfaces:** Existing `setView(view: AppView): void` remains the route/cleanup authority. New `nav-songs` calls `setView('chapters')`. New `nav-tools` toggles `aria-expanded` and `data-open` on `rail-tools`; its state is independent of `AppView`.

- [ ] Write a Playwright test that uses `nav-songs` from Play and expects `#lesson-workbench` visible and `#nav-songs[aria-pressed=true]`.
- [ ] Run `npm run test:e2e -- tests/studio-navigation.spec.ts` and verify the missing new navigation button is the reason for failure.
- [ ] Add grouped rail markup with Play, Practice, Songs, AI Coach, Tune, Tempo and Check Chord. Preserve every existing button ID and add only `nav-songs`, `nav-tools`, `rail-tools` and decorative group labels.
- [ ] Wire `nav-songs` to `setView('chapters')`; update selected-state bookkeeping so Songs is selected on `chapters`, Practice on `practice`/`coach`, and Tools on tuner/tempo/chord-check. Close the Tools menu on selection, Escape and outside click.
- [ ] Run the targeted test and existing navigation smoke tests. Confirm exiting AI Coach/Tune still invokes current cleanup.

### Task 2: Studio shell and playable instrument

**Files:** Modify `src/main.ts` (stylesheet import and concise Play copy), `index.html` (descriptive labels only); create `src/studio.css`; use `public/studio/workbench-backdrop.png` and `public/studio/wood-textures.png`.

**Interfaces:** CSS stays scoped to existing classes and `body[data-app-view]`; no new music state. `src/studio.css` imports last so it can override existing light-theme styles without changing their behavioral selectors.

- [ ] Add a screenshot/DOM regression asserting the rail is fixed and the instrument + Play action fit at 1440×900. Confirm it fails against the current light layout.
- [ ] Import `studio.css` after `lesson-trust.css`; define dark studio tokens, ambient image background, 248px fixed rail, contextual top status, cream typography and a minimal mode/status strip.
- [ ] Apply the generated koa/rosewood atlas as background material to the existing live `strum-surface`/`fretboard`; preserve touch hit boxes, fret lines, strings, hole and binding.
- [ ] Keep the audio gate prominent but compact, with one clear Play on screen action. Give strum/fingerpick selected state a tactile coral treatment.
- [ ] Add a view-enter opacity/translate transition; preserve audio-clock beat animations and make nonessential animation disappear under reduced motion.
- [ ] Verify the screenshot assertion, then visually compare Play with the selected design at the same viewport.

### Task 3: Responsive navigation and all-view material language

**Files:** Modify `src/studio.css`; extend `tests/studio-navigation.spec.ts` and `tests/app.spec.ts` only for changed navigation expectations.

**Interfaces:** `nav-tools` is only visible under the phone breakpoint. Desktop tool buttons remain direct. Existing practice secondary buttons remain reachable and continue calling `setView()`.

- [ ] Add a failing mobile test: at 390×844, five primary destinations are visible, Tools opens/escapes, Tune can be selected, and no content is obscured by bottom navigation.
- [ ] Implement mobile five-item bottom navigation and anchored Tools sheet; use safe-area padding and a deliberate landscape arrangement. Do not use a horizontally scrolling primary nav.
- [ ] Theme Practice, Songs, Quick drills, AI Coach, Tune, Tempo and Check Chord stages using studio surfaces; retain light text on dark areas, dark text on cream areas, strong current target and primary action.
- [ ] Check hover/focus/selected/loading/error/disabled states; make microphone and AI feedback status readable on the dark background.
- [ ] Run target/mobile test and capture all-view desktop/mobile screenshots.

### Task 4: Design QA and regression

**Files:** Create/update `design-qa.md`, `ui/v1/README.md`, and accepted screenshots in `ui/v1/`; update source only for observed P0–P2 issues.

- [ ] Open `docs/design/studio/selected-direction.png` next to the 1440×900 Play capture. Record fidelity, usability and accessibility findings in `design-qa.md`.
- [ ] Exercise all primary tabs, Practice sub-tabs, one-hand/two-hand Play, a song chapter, AI demo (mocked), tuner, tempo and chord check at desktop and phone sizes.
- [ ] Fix P0–P2 issues with a failing regression test first when behavioral; recapture and repeat until `design-qa.md` says `final result: passed`.
- [ ] Run fresh `npm test`, `npm run build` and `npm run test:e2e`; inspect exit codes and failures. Scan `dist/` for secrets without printing secret values.
- [ ] Commit the verified branch, push `codex/studio-redesign` to GitHub, deploy the same build to the existing Sites project, load the public URL and compare its visible UI with local.

## Self-review

The tasks cover all explicit spec destinations and preserve existing controllers. The main technical risk is CSS specificity in the large legacy stylesheet; importing a final scoped layer makes review and rollback straightforward. The main product risk is mobile navigation covering an active exercise; Task 3's viewport checks are a release gate.
