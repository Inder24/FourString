# Learning-flow verification — 12 September 2026

## Automated checks

- `npm run build`: TypeScript and Vite production build passed.
- `npm run test`: 83 tests passed across 18 files.
- `npm run test:e2e -- --workers=2`: 127 passed, 1 skipped. The skip is the mobile-only layout assertion in the desktop project, not a failed feature. Includes ten real-Songs synthetic-microphone cases across desktop/mobile for repeated notes, full Sargam ascent through C5, reference suppression and permission lifecycle.
- Desktop and mobile Chromium cover Play, Explore, 10-minute Practice, Songs, Quick drills, AI Coach and Tune. Signals, microphone permission and Astra responses are simulated for repeatable tests; these are not live API or physical instrument checks.
- Exact local API-key value scanned against production assets without printing it: absent.
- `git diff --check`: passed.
- AI comparison screenshots inspected at desktop/mobile sizes; traces are labelled as timing peaks, not amplitude waveforms.

## Important limitations

- Lathe Di Chadar and Khaab are explicitly unverified and cannot start a demo or guided lesson. The previous generic progressions were not a trustworthy rendition of those songs. Their data remains preserved pending a sourced, reviewed ukulele arrangement.
- Song chord lessons detect attacks only; chord shapes and direction are self-checks. Melody confirmation checks pitch, not which physical string produced it.
- No physical ukulele, real microphone calibration or Firefox/Safari device verification was performed here. No live paid Astra call was made during this verification pass.

## Real-ukulele acceptance checklist

1. **Quick drills → String clarity:** pluck G once and let it ring; see “G accepted” and C next. Continue C/E/A. No tempo requirement and no seven-pluck requirement.
2. **Quick drills → Steady pulse:** try even strokes at 72 BPM. Last gap should be near 833 ms. Try one quick/slow gap; only that strum should change colour. Wait over 2.5 seconds; the pulse should restart.
3. **Songs → Sa Re Ga Ma → My ukulele:** play all eight notes, including high C5. Confirm each new line responds to the next pitch. **Twinkle:** let the first C ring; it must not consume both repeated C notes. Briefly damp and re-pluck to accept the second.
4. **Songs references:** hear a note/chord/bar and stop a demo. Playback should not advance your score. Then play the target yourself after the reference/release guard.
5. **AI Coach → Steady downs:** first exercise sounds only downstrokes. Follow five seconds preparation, four audible/visible counts, then PLAY. Test with headphones initially.
6. **AI retry:** read the correction for ten seconds, or pause it. Check the retry BPM label and slower demo. At 60 BPM, downstrokes one beat apart should remain one second apart across loop boundaries.
7. **Comparison:** inspect expected/first/new timing peaks, select offsets, and replay each take. Try a silent take: it must not be praised as improved.
8. **Navigation:** leave a recording/listening screen; microphone use must stop. Return and start explicitly. Deny microphone once and verify the retry message.

The local development URL is http://127.0.0.1:4173/ while `npm run dev` is running.
