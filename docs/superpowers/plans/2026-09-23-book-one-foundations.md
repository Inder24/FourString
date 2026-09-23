# Book One: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete local-first 24-lesson Book One course with persistent progress, reusable assessment, responsive method-book UI, persistent ukulele, and optional Astra remediation.

**Architecture:** Keep curriculum, progress, evaluation, controller, and Astra serialization in focused modules. Reuse the existing audio, tuner, chord, rhythm, take, and instrument state services. Integrate one new `lessons` app view without moving existing product logic.

**Tech Stack:** Vite, TypeScript, Vitest, Playwright, semantic HTML, CSS, Web Audio, MediaRecorder, Spotify Basic Pitch, OpenAI Responses API.

**Spec:** `docs/superpowers/specs/2026-09-23-book-one-foundations-design.md`

## Global Constraints

- All 24 lessons remain open and work without Astra.
- Sargam is primary; Western note names are translations.
- Completed and Secure are distinct and stored locally in a versioned record.
- Microphone timing never claims to detect strum direction.
- Posture uses visual self-check only; no camera.
- The ukulele stays playable throughout every lesson.
- No raw audio or personal data is sent to Astra.

## Review Focus

- Corrupt or future progress records must not break course entry.
- Reference playback must not contaminate microphone scoring.
- Uncertain real-ukulele chords must offer fallback rather than false certainty.
- Phone navigation and the compact instrument must not cover each other.
- Leaving Lessons must stop microphone, audio schedules, timers, and recordings.

---

### Task 1: Curriculum and progress domain

**Files:** Create `src/course.ts`, `src/course-progress.ts`, `src/course.test.ts`, `src/course-progress.test.ts`.

**Interfaces:** Produces the approved `CourseUnit`, `CourseLesson`, `CourseActivity`, `CourseProgressV1`, `LessonProgress`, and `LessonEvaluation` contracts plus validated load/save/next-lesson functions.

- [ ] Write failing tests for 8×3 curriculum integrity, lesson ordering, Sargam labels, activity references, open access, progress persistence, resume, reset, corrupt input, and future-schema rejection.
- [ ] Run `npm test -- src/course.test.ts src/course-progress.test.ts` and confirm missing-module failures.
- [ ] Implement the minimal catalogue and progress domain.
- [ ] Run the focused tests and full `npm test`.

### Task 2: Lesson evaluation and G7 support

**Files:** Create `src/course-evaluation.ts`, `src/course-evaluation.test.ts`; modify `src/chord-check.ts` and its test.

**Interfaces:** Produces deterministic evaluators for choice, note, chord, rhythm, dynamics, and composite activities.

- [ ] Write failing tests for Secure thresholds, first-answer integrity, G7, uncertain chords, relative accents, and final composite scoring.
- [ ] Run focused tests and confirm failures describe the missing behavior.
- [ ] Implement evaluators by composing existing pitch/chord/rhythm primitives.
- [ ] Run focused tests and full `npm test`.

### Task 3: Optional lesson-coach API

**Files:** Create `src/lesson-coach.ts`, `src/lesson-coach.test.ts`, `server/lesson-coach-api.ts`; modify the server middleware registration and tests.

**Interfaces:** Produces validated `LessonCoachSummary`, `LessonCoachDecision`, `/api/lesson-coach`, and `/api/lesson-coach/status`.

- [ ] Write failing serialization, validation, no-audio, malformed-tool, unsafe-tempo, and unknown-activity tests.
- [ ] Run focused tests and verify RED.
- [ ] Implement a constrained GPT-6 Astra tool call with deterministic fallback behavior.
- [ ] Run focused tests and full `npm test`.

### Task 4: Course controller and method-book UI

**Files:** Create `src/course-controller.ts`, `src/course.css`; modify `index.html` and `src/main.ts`.

**Interfaces:** Consumes curriculum/progress/evaluators and existing `AudioEngine`, `TunerEngine`, instrument callbacks. Produces course home, lesson reader, activity runner, persistent instrument state, and cleanup lifecycle.

- [ ] Write Playwright tests for entry, 24 open lessons, Continue, six-stage flow, Completed/Secure state, input switching, reset, ear reveal warning, and cleanup.
- [ ] Run the new spec and verify RED.
- [ ] Add semantic markup and controller behavior for the course home and lesson reader.
- [ ] Integrate screen and representative real-instrument activities; keep unsupported/uncertain paths honest and recoverable.
- [ ] Run the new spec and full unit suite.

### Task 5: Responsive navigation and persistent instrument

**Files:** Modify `index.html`, `src/main.ts`, `src/studio.css`, `src/course.css`, and navigation Playwright coverage.

**Interfaces:** Produces desktop Lessons navigation and phone Play/Lessons/Practice/Songs/More behavior with a compact expandable instrument.

- [ ] Write failing desktop, phone, tablet, landscape, keyboard, and reduced-motion tests.
- [ ] Run the navigation spec and verify RED.
- [ ] Implement the navigation and responsive course layout without hiding existing tools.
- [ ] Run navigation/course specs and the complete Playwright suite.

### Task 6: Final integration and verification

**Files:** Update screenshot capture and supporting documentation only where required by the finished interface.

- [ ] Run `npm test`.
- [ ] Run `npm run build` and scan output for exposed secrets.
- [ ] Run `npm run test:e2e`.
- [ ] Manually inspect desktop and phone course states, console errors, microphone fallback copy, and all existing primary views.
- [ ] Review the final diff against every specification requirement and record any real-device-only validation gap.
