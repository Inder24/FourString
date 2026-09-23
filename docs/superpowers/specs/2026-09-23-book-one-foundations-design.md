# Book One: Foundations — Design Specification

## Product intent

Add a top-level Lessons experience for true beginners. Book One is a modern method book with eight units and 24 open lessons. It teaches theory visually, leads with Sargam, trains listening and memory, and repeatedly asks the learner to use either the on-screen instrument or a real ukulele.

Every lesson follows **See → Hear → Guess → Play → Check → Recap**. Lessons are never locked. `Completed` records a full attempt; `Secure` records an objective success. Progress is local to the browser.

## Course structure

The eight three-lesson units are: instrument and first sound; Sargam and fretboard; beat, bar and rhythm; right-hand tone, fingerpicking and strumming; chords and harmony; chord changes and accompaniment; melody, memory and playing by ear; dynamics, syncopation and final performance.

The numbered lessons, outcomes, and Secure criteria are exactly those in the user-approved Four Strings — Book One: Foundations plan from 2026-09-23. Course examples are original. C is the exercise Sa, while copy explains that Sa is movable.

## Experience

Lessons appears under Learn. Desktop navigation exposes it directly. Phone navigation is Play, Lessons, Practice, Songs, More; AI Coach and tools live in More. The course home shows Book One, Continue, eight units, 24 open lesson cards, Completed/Secure totals, durations, and activity labels.

The visual language is a modern method book on the existing luthier workbench. The playable ukulele remains visible throughout: full and pinned on larger screens, a playable compact dock with an expandable fretboard on phones. Ear challenges warn that playing may reveal the answer; an answer made after that exploration does not count toward Secure until retried.

## Assessment and trust

Pitch uses the existing tuner/pitch confirmation, chords use Basic Pitch with string-by-string fallback, and rhythm uses onset alignment. Microphone rhythm scoring measures attack timing, never stroke direction. Posture and tone are guided self-checks. Relative amplitude can support accent practice but absolute loudness is never compared across devices.

Reference audio, count-ins, and metronome sounds are excluded from scoring. Uncertain chord or microphone results never claim correctness and never prevent completion.

## AI boundary

Astra is optional remediation. `/api/lesson-coach` receives only lesson identifiers, objectives, activity kinds, and validated numeric result summaries. It returns one concise correction and selects an existing retry activity with bounded tempo and repetition settings. No audio, waveform, name, or saved take leaves the browser.

## Constraints

- Vite, vanilla TypeScript, semantic HTML, CSS, Pointer Events, and Web Audio only; no new UI framework.
- Standard high-G GCEA only.
- No account, cloud sync, leaderboard, camera, or social feature.
- All existing Play, Practice, Songs, AI Coach, Tune, Tempo, and Check chord flows remain functional.
