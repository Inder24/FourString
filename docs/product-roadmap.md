# FourString: next six improvements

Research date: 12 September 2026. This is a proposed roadmap, not a claim that these features are implemented. Estimates are engineering working days for a small POC, excluding musician review, rights clearance and user recruitment.

## Overall product: top three, in priority order

### 1. A verified ukulele lesson library

**Outcome:** Learners can trust that a lesson matches its named song and know whether they are hearing melody or accompaniment.

**Build (4–6 days + musician review):** Extend lesson metadata with recording/version, source, key, high-G tuning, melody versus accompaniment, beat-level chord changes, review status and rights status. Validate every note against GCEA fret mapping. Have a ukulele player compare the rendered exercise to the named recording before publication. Start with Sargam and Twinkle, then verify Lathe Di Chadar and Khaab before re-enabling them; do not replace uncertainty with a generic progression. Add three short beginner courses only after this gate works.

**Dependencies:** A trusted ukulele arrangement or musician, permission where required, reference version chosen. A guitar chord name can transfer harmonically, but guitar fingerings and unverified song charts are not a validated ukulele lesson.

**Acceptance:** Every published lesson has a reviewed playable score, correct fingering, source/version and an explicitly labelled demonstration type. Run MIDI/timing fixture tests and a musician listening check per release.

### 2. A single focused practice player

**Outcome:** One place to see the current note/chord, hear it, practise a difficult section and control when to move on.

**Build (4–5 days):** Combine duplicate guidance into a sticky current/next cue; add selectable A–B phrase loops, one shared speed control, optional tablature, and explicit “Wait for my note” versus “Keep the beat” modes. Preserve the same phrase and speed when switching real/on-screen ukulele. Give each replay a lead-in and pause at phrase boundaries. Never label chord shapes as microphone-verified until there is a separate validated detector.

**Why:** Yousician documents ukulele tempo, looping, notation and practice/play controls; Moises combines section loops with speed controls. These are useful interaction precedents, not evidence that their detectors or content can be copied. [Yousician practice modes](https://support.yousician.com/hc/en-us/articles/207313725-Practice-and-Play-modes-in-ukulele), [Moises sections](https://help.moises.ai/hc/en-us/articles/10138829000988-How-do-I-use-Sections).

**Acceptance:** In a five-person beginner test, at least four can replay a difficult phrase, slow it down and resume without guidance. No conflicting current-note highlights; no tempo reset between repetitions.

### 3. A resumable beginner path

**Outcome:** “What should I practise next?” has a useful answer without adding a large dashboard.

**Build (3–5 days):** Offer 5/10/15-minute paths: open strings → Sargam → Twinkle melody → C/F/G changes → rhythm. Store opt-in lesson completion and skill measurements locally with versioning and a clear reset/export control. Recommend the next exercise from demonstrated weaknesses, and re-check a learned skill on a later day rather than equating one good take with mastery. No microphone recordings saved by default.

**Acceptance:** Reload resumes the correct lesson and instrument preference; clearing data removes it. Track next-session return and successful delayed skill checks during an opt-in pilot, not streaks alone.

## Astra AI Coach: top three, in priority order

### 1. Confidence-aware coaching before more intelligence

**Outcome:** The coach distinguishes “your timing needs work” from “I could not hear reliably.”

**Build (5–8 days + real-device testing):** Add a short quiet-room/pluck calibration, signal-quality indicator and onset-confidence summary. Benchmark RMS detection with consented ukulele fixtures: soft/loud strums, ringing, handling noise, laptop/phone microphones, speakers/headphones. Gate grading and the Astra request when coverage is too low. Send numeric quality flags alongside timing evidence; never ask Astra to infer missing audio facts.

**Acceptance:** Proposed benchmark targets: onset precision ≥95%, recall ≥90% on the agreed fixture set; silence/noise-only fixtures never get an improvement claim. Report device-specific limitations and permit manual retry. This is not a current accuracy claim.

### 2. “Explain this mistake” with an exact demonstration

**Outcome:** Selecting a late hit shows why it was late and plays the exact corrected passage at the learner’s chosen tempo.

**Build (4–6 days):** Extend the existing constrained tool contract with reviewed example IDs, tempo and focus bounds. Let Astra choose one explanation and one demonstration from measured evidence; the app schedules all sound and animation locally. Add “Show slower,” “Hear my take” and “Compare that beat” actions. Validate evidence references against the actual attempt, not only JSON shape. Add teacher-reviewed cases and mocked API regressions for wrong ranges, unsupported examples and unsupported claims.

**Dependencies:** The current timing traces, reliable onset measurements and a small curated example library. Use function calling for app actions and schema-constrained output; schema validity alone does not guarantee a correct teaching decision. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

**Acceptance:** Every correction references a real measured region; every demo uses the displayed tempo; invalid responses do not change the exercise. Learner always starts microphone capture explicitly.

### 3. A coach that checks retention and transfers skills

**Outcome:** Astra helps the learner get better beyond repeating one tiny loop.

**Build (5–7 days):** With opt-in local history, summarise rhythm skills over sessions (not raw audio). Have Astra select an approved short plan: revisit a weakness, practise it, then test the same rhythm at a new tempo or with C→F→G changes. App-side limits enforce session duration, difficulty, retry count and tempo bounds. Show a short evidence-based progress story, distinguishing a slower assisted retry from an unassisted full-pattern check.

**Dependencies:** Confidence gating, a verified exercise catalogue and the local progress store. Keep API keys server-side and send only the relevant numeric summary.

**Acceptance:** Plans fit the selected time; no unexplained difficulty jumps; summaries cite actual attempts. Measure improvement on a later unassisted full-pattern check, not only the immediately coached retry.

## Suggested delivery order

1. Content verification + confidence benchmark (trust).
2. Focused player + explain-and-demonstrate (learning).
3. Resumable path + retention coach (continuity).

Do not add a larger song catalogue or polyphonic chord scoring until the relevant verification gates pass.
