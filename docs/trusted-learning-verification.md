# Trusted learning — verification and handoff

12 September 2026. Implements the amended scope in [the plan](superpowers/plans/2026-09-12-trusted-learning.md). Formal musician review/sign-off is excluded at the user's request. This document supplements the earlier learning-flow verification.

## Delivered behavior

- **Practice → Songs:** Source and Material filters; source-backed/original/unverified labels; expandable tuning, key, arrangement version, source links and limitations; downloadable practice-score JSON generated from the player's actual note/chord/beat/fret data, including Twinkle backing events. Sources are listed in [lesson-sources.md](lesson-sources.md).
- **AI Coach capture checks:** silent room calibration, a test pluck, a readiness step and retryable recording advice. Silence, insufficient attacks, noise, clipping and interrupted sampling are separated from poor timing. Rejected takes remain replayable but do not call Astra, enter comparisons or consume a coached retry.
- **Explain this mistake:** select a measured early/late/missed strum from the correction or comparison. Local timing facts appear immediately; an explicit request obtains a short Astra explanation. Replay the original recorded passage or hear its exact source strokes and rests at a lower selected tempo. Demonstrations never start microphone capture.

## Verification evidence

- `npm run test`: **112 passed** across 22 files.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run test:e2e`: **159 passed, 1 skipped** across desktop and mobile Chromium. The skip is the desktop invocation of a mobile-only layout assertion, not an unimplemented flow.
- The suite covers Play/Explore, Practice, Songs, Quick drills, Tune, AI calibration/quality retry, correction/comparison, exact slower demonstration, recorded-passage replay, API errors, cancellation, microphone handoff and native-select keyboard isolation.
- Final review found and the fix wave addressed blocked-song secondary reference controls, the audio-initialization selection race, and native-select keyboard leakage. Full regression also caught and resolved button-focused numeric plucking being suppressed by an overbroad guard. Final scoped review approved both findings as addressed, with no new important breakage.
- Desktop source-details flow was inspected in the in-app browser. Desktop/mobile browser-test screenshots of source filters, comparison/explanation panels and focused controls were inspected; in-app mobile navigation encountered a connection-error page, so mobile verification uses Playwright rather than claiming a successful in-app mobile session.
- The exact configured local key was scanned against all 27 production assets without printing its value: **absent**. `.env.local` is Git-ignored. `git diff --check` passed.
- Existing development server at `http://127.0.0.1:4173/` responded HTTP 200. No second server is left running by this implementation pass.

## Boundaries

- Source-backed is not musician-approved, and a chord accompaniment is not a recognizable melody transcription. Yellow and I'm Yours are explicitly lyric-free chord studies. Lathe Di Chadar and Khaab remain blocked without adequate ukulele arrangement evidence.
- Capture quality uses conservative POC heuristics, not a validated probability of detection accuracy. Timing checks do not recognize chord shapes or up/down direction.
- API tests use a mock provider; microphone tests use controlled synthetic signals. No paid/live Astra request, physical-ukulele trial, or Firefox/Safari device validation was performed in this implementation pass.
- Recordings stay in browser memory. Provider requests contain bounded numeric timing/quality evidence, not microphone audio, waveform samples or recording URLs. The key stays server-side in ignored local configuration.
- No commit, push, merge or deployment is included. The existing checkout and local server are retained.

## Suggested real-ukulele smoke test

1. Open **AI Coach → Steady downs → Start first take**. Stay quiet for the room check, then pluck once for the test. Continue when ready. Verify the five-second preparation, audible/visible count-in and PLAY cue.
2. Play eight downstrokes across two bars. Deliberately hurry the ending. Check that a usable take reaches Astra while a silent or heavily clipped take gives recording advice instead.
3. Read the correction, pause the automatic retry, and choose **Explain a measured mistake**. Check the beat/cycle/offset, request the explanation, select a lower tempo, and hear the short demonstration. At 50 BPM, quarter-note downstrokes should be 1.2 seconds apart, including loop boundaries.
4. Compare the original passage with the slower example. Starting either replay must stop the other. Navigate away during replay, calibration or a request; playback/capture must stop and late results must not restore the previous screen.
5. In **Practice → Songs**, filter Source-backed and open a source panel. Check the stated melody/accompaniment scope, try the tutorial links and download the chapter score. Unverified songs must not play through main or secondary reference controls.
6. With sound enabled, keyboard-navigate Source, Material and the slower-example tempo dropdowns. Arrow keys must stay in the controls; they must not play or focus instrument frets.

Use headphones first; speaker playback and real-room noise need separate device trials. Start any provider-backed explanation only when you intend to use the configured API account.
