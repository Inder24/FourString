# Four Strings — Modern Luthier Studio

Status: selected by the user on 2026-09-17 (visual direction 1). This replaces the visual direction in the earlier proposed site-wide UX document; existing music, audio, microphone and lesson behavior remains authoritative.

## Outcome

Make the playable ukulele the unmistakable center of the product while giving beginners a short route from playing to a song, a ten-minute session, AI rhythm feedback, or a practical tool. The redesign must cover every current destination, not only the Play screen. Desktop should feel like a dark luthier's studio; mobile should be a compact, touch-first version of the same place.

## Visual source and research

The selected source is `docs/design/studio/selected-direction.png`, generated from the current Four Strings Play and AI Coach screens. It establishes a charcoal/walnut rail, ambient dark workbench, large rosewood/koa instrument, cream type and a restrained coral active state. The reference is a design target, not a flattened image to put behind an unplayable instrument.

- [NameThatUI](https://namethatui.com/) informed clear navigation groups, explicit step/state labels and correct segmented-control language.
- [Beautiful UI](https://www.beautifului.dev/) informed the AI Coach's distinct listening, analysing, correction and comparison states; numeric evidence stays visibly separate from model-written advice.
- [Recent websites](https://recent.design/websites), especially its music category, informed the editorial scale and purposeful asymmetry, not a copied site layout.

## Navigation and flow

Desktop has one fixed 248px left rail: Play; Learn (Practice, Songs, AI Coach); Tools (Tune, Tempo, Check Chord). Songs opens the existing `chapters` view directly. Practice retains its 10-minute session / Songs / Quick drills sub-navigation so existing context and tests continue to work. The rail uses real button labels, selected state and clear focus, never decorative dead links.

Phone has five persistent destinations: Play, Practice, Songs, AI Coach and Tools. Tools opens a small, dismissible menu containing Tune, Tempo and Check Chord; choosing one closes it and highlights Tools while on that view. The existing audio, clear and help controls remain accessible without stealing instrument space. At tablet widths, the rail can become a compact top or bottom navigation rather than squeeze the playing surface.

Every destination gets the same shell and material vocabulary, but the active task leads: large playable instrument on Play, current step and transport on Practice, song/phrase on Songs, clear listening state on AI Coach and Tune, beat or chord target on Tools. No new account, analytics, lesson content, paid API call, or microphone capture is introduced by navigation.

## Instrument and visual system

- Retain the real interactive 4-string, 12-fret DOM instrument, its Pointer Events, keyboard access, one/two-hand layouts, fingerpick builder, Web Audio engine and existing sampled sound. Never replace it with a static image.
- Use the selected mock's dark studio atmosphere and wood-grain assets only as materials behind the live fret cells and strum surface. Keep fret labels and GCEA names legible.
- Palette: near-black `#171311`, walnut `#27201c`, rosewood `#3a2522`, koa `#b86d45`, cream `#f7f1e7`, nickel `#d4c8b7`, coral `#ef927c`, muted green for accepted/heard success. Existing Fraunces and Manrope remain self-hosted.
- Desktop Play frame at 1440×900: brand/rail left, contextual status at upper right, concise greeting, dominant instrument, and a compact mode/status strip. Non-Play screens use a readable cream or dark stage within the same shell, without deep nesting of generic cards.
- At 390×844: current title/action in the first screen, instrument neck horizontally scrollable, 44px minimum interactive targets, no page-wide horizontal overflow. At 844×390 landscape, the instrument remains operable without a bottom bar obscuring it.

## Motion and accessibility

Navigation content enters with a short opacity/translate transition; active rail state moves with a modest material/color shift. Existing string vibration and sound-hole ripple remain, with a stronger but brief coral indication. Beat/playhead movement follows the audio clock, not a decorative unsynchronised animation. Use `prefers-reduced-motion` to remove nonessential transforms and keep opacity/state feedback. Maintain visible keyboard focus, semantic headings/navigation, polite status announcements and `hidden` behavior.

## Implementation boundaries

Keep the existing Vite/vanilla TypeScript app, `setView` controller and DOM IDs. Add a small presentation layer/stylesheet rather than rebuilding the audio or lesson state machines. New buttons are wired through `setView`; entering and leaving routes continues to release microphone/audio resources as before. Existing tests are a regression floor, not proof of visual quality.

## Acceptance

1. Play, Fingerpick, 10-minute Practice, Songs, Quick drills, AI Coach, Tune, Tempo and Check Chord all navigate and remain functional.
2. Selected design's rail, instrument emphasis, palette and typography are recognisable on desktop. Mobile has a coherent corresponding flow, not a shrunken desktop rail.
3. No visible control blocks playable frets, strumming, lesson transport, tuner meter, AI countdown or chord result at 1440×900, 1024×768, 844×390 and 390×844.
4. Build, unit and browser suites pass. Fresh screenshots and a side-by-side design QA report identify and resolve P0–P2 visual/interaction issues.
5. Work is committed on a new `codex/` branch, pushed to GitHub, published to the existing Sites project and opened locally for review. Site deployment is verified by loading the public URL.
