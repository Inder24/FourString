# Four Strings

A playable, local-first browser ukulele built with vanilla TypeScript, Pointer Events, and the Web Audio API. It supports standard high-G tuning across twelve frets, simultaneous touch fretting, mouse-latched chord shapes, realistic strumming, and an immediate-note Explore mode with a 15-step fingerpicking sequencer.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173` and press **Enable sound**.

## Checks

```bash
npm test
npm run build
npm run test:e2e
```

## Controls

- Touch: hold fret positions with one hand, then tap the body to play all four strings together or sweep for an ordered strum.
- Mouse: click fret positions to latch them, then click the body for all four together or drag across it to strum.
- Explore mode: click, tap, or glide over frets to play their notes immediately. Turn on **Add notes** to build and play a phrase; repeated notes are supported up to 15 steps.
- Keyboard: arrow keys navigate, Enter toggles the focused fret, keys 1–4 pluck A, E, C, and G respectively, Space plays all four together, Shift+Space strums up, and Escape clears.
- Phone: swipe the fret-number rail horizontally to reach all twelve frets; the strum deck remains full width below it.

## Audio credits

The bundled ukulele recordings were created by Mateusz Dąbrowski for [FreePats ukulele1](https://github.com/freepats/ukulele1) and dedicated to the public domain under CC0 1.0. The original source instrument is a Flight Fireball tenor ukulele recorded at 96 kHz/24-bit and distributed here as the source lossless FLAC files.
