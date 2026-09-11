# Four Strings

A playable, local-first browser ukulele built with vanilla TypeScript, Pointer Events, and the Web Audio API. Four primary areas—Play, Practice, Coach, and Tune—cover standard high-G playing across twelve frets, one- or two-hand touch interaction, a tempo-controlled 30-step fingerpicking sequencer, microphone tuning, real-instrument coaching, adaptive ten-minute practice, and guided chord and melody studies.

## Run locally

```bash
npm install
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
- Coach mode: use a real ukulele for guided G/C/E/A string-clarity checks or an eight-strum pulse exercise. Pitch, timing, and microphone level are analysed locally and no recording is stored.
- Practice: follow five timed stages—open strings, clean shapes, chord changes, rhythm, and a musical finish. The interface clearly labels these as screen-input checks; correct attempts raise the working tempo gently and repeated misses slow it down.
- Songs: search four local courses—Lathe Di Chadar, Khaab, Sa Re Ga Ma, and Twinkle Twinkle—then progress one line at a time with highlighted string/fret, note, chord, gesture, and reference-audio cues.
- My take: record on-screen lesson note events for up to 60 seconds, save one take per course chapter in local browser storage, and replay it through the sampled ukulele. This stores performance events rather than microphone audio.
- Keyboard: arrow keys navigate, Enter toggles the focused fret, keys 1–4 pluck A, E, C, and G respectively, Space plays all four together, Shift+Space strums up, and Escape clears.
- Phone: use the persistent Play/Practice/Coach/Tune navigation, swipe horizontally to reach all twelve frets, and optionally keep the strum deck within reach in one-hand mode.

Coach intentionally evaluates monophonic open-string pitch and strum onset timing in this version. Reliable identification of several simultaneously ringing strings requires a future polyphonic recognition and device-calibration pass.

## Audio credits

The bundled ukulele recordings were created by Mateusz Dąbrowski for [FreePats ukulele1](https://github.com/freepats/ukulele1) and dedicated to the public domain under CC0 1.0. The original source instrument is a Flight Fireball tenor ukulele recorded at 96 kHz/24-bit and distributed here as the source lossless FLAC files.

## Song-study notes

- **Lathe Di Chadar** uses a short traditional folk excerpt with an original Four Strings accompaniment. Background and spelling were cross-checked against [Punjabi Wedding Songs](https://punjabiweddingsongs.in/lyrics/lathe-di-chadar-punjabi-folk-song-meaning-history-english-translation/), and the simplified chord family was informed by [ChordU](https://chordu.com/chords-tabs-lathe-di-chadar-id_G5n8zJ0btoo).
- **Khaab** is a copyright-safe accompaniment study based on the commonly published Am–F–C–G progression and an 80 BPM reference from [Chordify](https://chordify.net/chords/akhil-songs/khaab-chords) and [SongBPM](https://songbpm.com/%40akhil/khaab). It does not include the song's lyrics, melody, recording, or tablature.
- **Sa Re Ga Ma** follows the requested C-major ascent from `3,0` through `1,3`, pairing Indian solfege with exact GCEA string-and-fret targets.
- **Twinkle Twinkle** uses the requested beginner fingerpicking path. Its chord chapter starts with four steady down-strums in 4/4, following the beginner notation example in [Ukulele Tricks](https://s3.amazonaws.com/ukuleletricks.com/products/strumming-tricks/Appendix-B-Ukulele-Notation.pdf); the final chapter adds a quiet C/F/G7 chord bed beneath the melody reference.
