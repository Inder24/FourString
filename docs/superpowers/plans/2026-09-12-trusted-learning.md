# Trusted Learning Implementation Plan

> Execute with subagent-driven-development; dependent AI integration is root-owned, independent lesson work delegated. Preserve the existing dirty feature checkout.

**Goal:** Source-backed lesson provenance, capture-quality-aware rhythm coaching, and explanation of a measured mistake with an exact slower demonstration.

**Approved amendment:** The user excluded formal musician review/sign-off and requested internet sources. Source-backed is not musician-approved. Real-device benchmark claims are excluded; simulated tests verify software behavior only.

**Architecture:** Existing vanilla TypeScript/Vite/Web Audio. Separate pure lesson trust, capture quality, and selected-mistake modules; native DOM components; existing server-only OpenAI key. No added runtime dependencies.

## Global constraints

- Preserve Play, Practice, Songs, Quick drills, Tune and AI Coach flows.
- No raw audio, waveform, recording URL, key or unrelated state in provider payloads.
- No fabricated musician review or accurate-song claim. Lathe/Khaab stay blocked absent adequate sources.
- No commit, push or publish in this task. Keep the existing approved key configuration.
- Retain warm workbench tokens, visible focus, touch-friendly native controls and reduced motion.

## Task 1: Source-backed lesson library

Files: lesson-trust.ts, lesson-trust-ui.ts, lesson-trust.css, lesson.ts, lesson-facing main.ts/index.html, unit/browser tests, docs/lesson-sources.md.

- [x] Research ukulele teaching sources and describe exactly what each supports.
- [x] Source-backed/original/unverified metadata, tuning/key/version, safe HTTPS links and source/material search filters.
- [x] Download actual expanded note/chord/beat/fret/MIDI JSON; validate data and include Twinkle backing events using the player's shared schedule.
- [x] Keep Lathe/Khaab playback and export unavailable; no review badges/sign-off registry.
- [x] RED/GREEN tests and task review; fix blocked exports, backing data, array-index assumptions.

## Task 2: Capture quality

Files: capture-quality.ts/tests, tuner signal DTO, adaptive-coach summary/controller/API, AI markup/styles, confidence tests and AI fixtures.

- [x] Silent 1.5-second room check, one test pluck and explicit continue/cancel/recheck.
- [x] POC gates: signal contrast >=4× noise, clipping >1%, noisy room, fewer than max(2,40% expected) attacks, sampling gap >500ms, missing calibration.
- [x] Aggregate numeric evidence including start/interior/end frame gaps. Poor rhythm alone is not poor recording quality.
- [x] Keep unusable takes replayable without provider request/comparison/retry count. Clear calibration and streams on reset/navigation.
- [x] Independent server projection/gating and RED/GREEN unit/API/browser tests; review approved after frame-gap fix.

## Task 3: Explain a measured mistake

Files: mistake-explanation.ts/tests, mistake-panel.ts, server/mistake-explanation-api.ts/tests, take-traces.ts, adaptive controller, Vite middleware, AI markup/styles/browser tests.

- [x] Select measured early/late/missed event from correction focus or comparison trace; show local beat/cycle/offset.
- [x] Explicit Astra request, bounded event/recipe/text/slower-BPM validation, retryable errors and stale-response guards.
- [x] Existing clock demonstrates exact 2–4-slot passage with original strokes/rests/chord cycle; never capture microphone during demonstration.
- [x] Replay selected original-recording interval; stop/reset/navigation and mutually exclusive replay controls.
- [x] RED/GREEN pure/API/browser tests; review approved after island-boundary and replay-overlap fixes.

## Task 4: Final audit

- [x] Full unit/build and desktop/mobile browser regression, live layout inspection, secret scan.
- [x] Final integration review; resolve important findings and document evidence/limitations.
- [x] Leave local app available, no commit/push. Report source-backed boundary and untested physical/provider conditions.

Evidence: [verification and real-ukulele checklist](../../trusted-learning-verification.md). Final checks: 112 unit tests, successful build, 159 browser tests plus one intentional skip; scoped review approved.
