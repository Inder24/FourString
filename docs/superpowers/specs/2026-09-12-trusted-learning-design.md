# Trusted learning design

Approved scope, as amended by the user: source-backed lesson library in Practice; confidence-aware Astra coaching; explain a measured mistake with an exact slower demonstration. Continue the existing vanilla TypeScript/Vite/Web Audio app and previous local-key reuse approval. No new dependencies, commits, publishing, raw-audio uploads, invented reviews or claims of physical-device validation.

## Scope amendment (user clarification)

The user explicitly removed formal musician review from implementation and requested internet research for the lesson library. Replace review badges/sign-off/import workflow with source-backed metadata and links. Do not claim musician approval. Human sign-off is no longer a completion gate for this revised objective. Device benchmark numbers remain unclaimed; implement and test the signal-quality heuristics with transparent limitations.

## Lesson trust (amended)

Every course gets explicit provenance: arrangement identity/version, melody or accompaniment, tuning/key and checked source URLs. Display Source-backed study / Original exercise / Unverified labels rather than musician-approved. A tutorial link is evidence for the described chord/melody material, not an endorsement of the app. Keep original exercises playable with honest labels; Lathe and Khaab stay blocked unless research supplies an actual usable ukulele arrangement. Add source/type filters, provenance details, external lesson links and downloadable actual note/chord/beat/fret practice score. Validate score ranges. No formal reviewer registry or import/sign-off UI.

## Signal confidence

Before a first AI take, explicitly check room noise then a test pluck. Quiet calibration is silent, separate from the audible count-in; capture no saved recording here. Show level/quality and a retryable setup message. After calibration, the existing 5-second preparation and four-count remain. Reuse calibration during coached retries; allow recheck and clear it on reset/navigation.

Each attempt collects only in-memory aggregate signal measurements and detected onsets. Separate usable capture from silence/too few attacks, sustained noise, clipping and an unavailable calibration. Low-quality takes remain replayable, are not compared, do not consume a coached retry and do not call Astra; show concrete recording advice and a re-record action. Poor timing alone never makes a capture invalid. Server sanitization independently enforces the quality gate and strips unrelated fields. Only numeric quality/attempt summaries go to Astra. No exact detection-accuracy claim without real-device benchmarks.

## Explain this mistake

The learner selects an early/late/missed hit from the comparison trace, or the current correction's focus. Show the actual beat/cycle, expected/detected offset and a local evidence line immediately. An explicit Explain button asks Astra for one short explanation using only that evidence. Use a constrained tool with allowed reviewed demonstration recipes (steady spacing / unhurried return / preserve rest), selected event identifier and slower allowed BPM; validate event/range/tempo and evidence reference on both ends. The app, not Astra, schedules sound and graphics.

Show an exact 2–4-slot passage surrounding that hit with down/up/rest cues from the existing pattern. Play it at the chosen slower tempo with count-in, full loop rests and matching chord timeline; never automatically record. Separate stop, hear slower and hear my passage controls; replay seeks to the matching raw recording time (accounting for alignment offset), and unavailable recordings are clearly disabled. Keep errors retryable without losing the take. Selecting another hit or navigating aborts explanations/playback; stale responses cannot replace the selection. Label generated explanation Powered by GPT-6 Astra; local evidence remains labelled Local timing analysis.

## UX contract

Intent: beginner holding a real ukulele needs a trustworthy next action, not more dashboard metrics. Hierarchy: current capture instruction or selected beat leads; provenance and numeric details are expandable. Existing koa/rosewood/binding/coral tokens, layered warm surfaces, Manrope controls/Fraunces headings. Four-pixel spacing rhythm; 16px compact panels, 44px controls, visible keyboard focus; native buttons/details/selects. Preserve existing mobile navigation and reduced-motion behaviour.

## Verification

Unit tests: provenance/source/score validation; quiet/pluck calibration, silence/noise/clipping, usable-but-poor timing; request data minimisation and quality enforcement; selected event and demonstration bounds; cancellation and replay boundary logic. Browser tests: lesson filters/details/download, complete calibration→take→quality retry, good capture→Astra correction, selected mistake→explanation→slower audio/animation→stop/replay on desktop/mobile. Re-run all existing tests/build, inspect screenshots, scan bundle for secrets. Document physical-device and live-provider validation honestly as unperformed checks, not green simulated tests. Formal musician review is excluded by the user's amendment.
