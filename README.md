# Four Strings

A playable, local-first browser ukulele built with vanilla TypeScript, Pointer Events, and the Web Audio API. Four primary areas—Play, Practice, AI Coach, and Tune—cover standard high-G playing across twelve frets, one- or two-hand touch interaction, a tempo-controlled 30-step fingerpicking sequencer, microphone tuning, real-instrument coaching, adaptive ten-minute practice, and guided chord and melody studies.

## Run locally

```bash
npm install
cp .env.example .env.local
# Add your OpenAI Platform key to .env.local as OPENAI_API_KEY.
npm run dev
```

Open `http://127.0.0.1:4173` and choose **Play on screen**. If you have your ukulele, choose **I have my ukulele** to go directly to the tuner.

## Checks

```bash
npm test
npm run build
npm run test:e2e
```

## Controls

- One-hand touch: tap frets to latch a shape, then tap the body to play all four strings together or sweep for an ordered strum.
- Two-hand touch: hold fret positions with one hand while the other hand plucks or strums.
- Mouse: click fret positions to latch them, then click the body for all four together or drag across it to strum.
- Fingerpick mode: click, tap, or glide over frets to play their notes immediately. Turn on **Add notes** to build and play a phrase; repeated notes are supported up to 30 steps, with playback from 50–180 BPM.
- Tune mode: explicitly enable the microphone, tune automatically or target G/C/E/A, and follow live cents feedback. The microphone stream stays local and stops when you leave Tune.
- Practice → Quick drills: use a real or on-screen ukulele for guided G/C/E/A string-clarity checks or an eight-strum pulse exercise. String confirmation tolerates quiet detection gaps up to 250 ms, without accepting wrong pitches. The 72 BPM pulse grades each gap against 833 ms, labels and colours each result, and summarises seven gaps (the first strum is unscored). A gap over 2.5 seconds starts a fresh run. Pitch, timing, and microphone level are analysed locally and no recording is stored.
- AI Coach: choose one of three rhythm patterns and **Watch & hear** two bars at 70 BPM. The illustrated GCEA instrument follows the sampled audio; Steady downs shows only sounded downstrokes, while later patterns distinguish sounded strokes from silent returns. C major (0003) is shown by default, with optional chord-change practice; rhythm scoring does not check chord shapes or direction. Astra returns one measurement-backed correction and a slower focused demonstration before the next count-in. Cancel the countdown or demonstration to pause; **Watch correction again** does not start recording. A focused retry ends with timing and audio comparison. Reduced motion uses stationary/opacity cues.
- Capture quality: a silent room check and one test pluck precede the first AI take. Silence, too few attacks, noisy/clipped capture and sampling interruptions produce recording advice, not a timing judgment. The take remains replayable without calling Astra or consuming a retry. These are POC signal heuristics, not validated detection-accuracy probabilities.
- Explain this mistake: select an early, late or missed strum from the correction/comparison and inspect the local timing evidence. **Explain this mistake** explicitly asks Astra for a short explanation. **Hear slower passage** demonstrates the exact source strokes/rests at a chosen lower tempo; **Hear my passage** replays that part of the original take. These controls do not record. Recordings remain in browser memory; only bounded numeric timing/quality evidence reaches Astra through local Vite middleware. No audio, waveform samples, recording URLs, video or hand tracking are sent.
- Practice: follow five timed stages—open strings, clean shapes, chord changes, rhythm, and a musical finish. The interface clearly labels these as screen-input checks; correct attempts raise the working tempo gently and repeated misses slow it down.
- Songs: search six local courses—Lathe Di Chadar, Khaab, Sa Re Ga Ma, Twinkle Twinkle, Yellow, and I’m Yours—then filter by source status or melody/accompaniment. Expand each course’s provenance for tuning, key, arrangement identity, scoped tutorial links, and a downloadable validated practice score. Lathe Di Chadar and Khaab remain visible but blocked as unverified.
- My take: record on-screen lesson note events for up to 60 seconds, save one take per course chapter in local browser storage, and replay it through the sampled ukulele. This stores performance events rather than microphone audio.
- Keyboard: arrow keys navigate, Enter toggles the focused fret, keys 1–4 pluck A, E, C, and G respectively, Space plays all four together, Shift+Space strums up, and Escape clears.
- Phone: use the persistent Play/Practice/AI Coach/Tune navigation, swipe horizontally to reach all twelve frets, and optionally keep the strum deck within reach in one-hand mode. Practice contains 10-minute session, Songs, and Quick drills.

Coach intentionally evaluates monophonic open-string pitch and strum onset timing in this version. Reliable identification of several simultaneously ringing strings requires a future polyphonic recognition and device-calibration pass.

The API key is loaded only by Vite from `.env.local`; it is never included in the client bundle. The AI Coach route is a localhost POC and needs a server-side adapter before static hosting.

## Audio credits

The bundled ukulele recordings were created by Mateusz Dąbrowski for [FreePats ukulele1](https://github.com/freepats/ukulele1) and dedicated to the public domain under CC0 1.0. The original source instrument is a Flight Fireball tenor ukulele recorded at 96 kHz/24-bit and distributed here as the source lossless FLAC files.

## Song-study notes

The full source inventory and the exact limit of each attribution are documented in [Lesson sources and provenance](docs/lesson-sources.md). “Source-backed” is evidence for named lesson details, not an endorsement or musician review of the Four Strings arrangement. Sa Re Ga Ma is an original exercise derived from the user-provided C-major note path. Lathe Di Chadar and Khaab remain unverified and blocked because generic chord or tempo pages do not establish a reliable playable ukulele score. Yellow and I’m Yours are lyric-free accompaniment studies, not their original recordings or melodies.
