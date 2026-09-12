# Four Strings: guided workbench redesign proposal

Status: proposed for user approval. This is a design/UX plan, not an implemented redesign. No app code, audio behavior, API configuration or stored learner data is changed by this document.

## Recommendation

Keep the recognisable warm instrument, but replace the stack of feature panels with one focused workspace per task. The user should always know: what am I doing, what do I play now, is the app listening, and what happens next?

Grounding: [13 captured states and audit notes](../../design/audits/2026-09-12-site-ux/audit.md), current vanilla TypeScript/Vite code, and the existing koa/rosewood/cream/coral design tokens. No saved Product Design context was present. Product Design Audit supplied evidence; Interface Design supplied the hierarchy and component discipline.

## People, task and feel

- A beginner with a phone propped near a real ukulele, needing large, glanceable cues while both hands are occupied.
- The same learner without an instrument, exploring the on-screen neck with a mouse or one/two-hand touch.
- A returning learner who wants to resume a short exercise, not navigate a marketing page each visit.
- Feel: a calm, encouraging practice room; tactile where the instrument matters, quiet where the interface serves it.

### Domain exploration

- Domain: tuning pegs, four-string courses, fret markers, thumb strokes, musical phrases, count-ins, call-and-response, practice repetitions.
- Colour world: koa amber, rosewood brown, cream binding, nickel silver, paper ivory, coral finger markers, muted green for accepted notes.
- Signature: **Follow-the-string stage** — the same compact Now/Next strip connects physical string number, fret/chord, playing direction and accepted/heard feedback across exercises. Rhythm patterns extend it into the beat lane rather than inventing another dashboard.
- Reject: generic analytics home → task-first instrument; repeated oversized hero sections → compact task headers; a card for every setting → contextual controls and a shared transport.

## Three approaches considered

| Approach | Benefit | Cost | Decision |
|---|---|---|---|
| Guided workbench | Preserves familiar navigation while making the active task obvious | Needs shared presentation components and careful state migration | Recommended |
| Course-first academy | Strong linear beginner curriculum with lessons as the main destination | Makes instant instrument play less direct; needs more trustworthy curriculum content | Later, if learner research supports it |
| Visual polish only | Smallest implementation surface | Leaves duplicated targets, source locks and buried primary actions intact | Insufficient for the reported problems |

## Information architecture

Keep four primary destinations and their current identities. Do not add a dashboard or a fifth navigation item.

| Destination | Promise shown at entry | Secondary choices | Primary next action |
|---|---|---|---|
| Play | Explore notes, build a shape, or create a picking pattern | Strum / Fingerpick; One hand / Two hands | Enable sound, then interact directly |
| Practice | Learn one useful thing at your own pace | 10-minute session / Songs & lessons / Quick drills | Start or resume the chosen activity |
| AI Coach | Record a rhythm, get one correction, hear the improvement | Three existing patterns; optional chord changes | Hear example, then check microphone |
| Tune | Bring each open string into tune | Auto / G / C / E / A | Start listening |

Instrument source is a separate choice, not a route: **On-screen ukulele / My ukulele** wherever both are supported. AI Coach and Tune explicitly say **My ukulele required** rather than presenting a disabled screen-instrument toggle. Choosing a real instrument never forces a tuner detour. A contextual Tune first link is optional and returns to the previous lesson.

## Shared layout and interaction contract

1. Compact task header: current activity, source/readiness, optional help. One title per workspace, not a page title plus a second promotional title.
2. Now/Next strip: current note or chord, physical string/fret, required gesture, next target, and one acknowledgement. For string clarity: “Pluck G once and let it ring”; accepted message: “G accepted — play C next.” No instruction to pluck continuously.
3. Main stage: on-screen instrument for screen input; large target/diagram and live signal feedback for real input. Do not keep a second full decorative instrument below the active lesson.
4. Transport: one primary action appropriate to the phase, Stop/Pause where applicable, current BPM and reference scope. Keep it adjacent to the main stage, not below several detail panels.
5. Details: Tips, Sources, recording options and advanced measurements use explicit expandable sections. Current target, capture errors and recovery actions are never hidden inside them.

Desktop: at 1280 × 720 and larger, the current target and primary action should be visible together without page scrolling. At 1440 × 900, the instrument/beat scene should also fit. On phone at 390 × 844, the current target, next action and microphone/playing state must fit; the neck may scroll horizontally with at least 44px hit targets. Keep both hand layouts. In landscape, prioritise the instrument and collapse optional explanation.

Mobile transport sits above the bottom navigation with safe-area padding; only those two bars may be sticky. Reserve their measured height in content padding and scroll margins. Do not cover focused controls or notes. Volume moves into a labelled sound control when it is not the main task.

## Screen-by-screen changes

### Play and Fingerpick

- Keep instant instrument access; no mandatory welcome tour.
- Offer a small optional “What can I do here?” reveal: play a chord, build a 30-note phrase, practise a lesson, or check a real instrument. Links open the named destination without starting audio or microphone capture.
- Fingerpick gets an explicit **Just play / Build a pattern** choice. Entering Fingerpick previews notes; collecting starts only after Build a pattern. Show “Tap a fret to add note 1” and a visible 0/30 counter.
- Once populated, show numbered notes with string/fret notation, repeated entries, Undo, Clear and Play/Stop in one compact region. Preserve the current tempo range and 30-note limit. Do not introduce recording, editing or sharing behavior beyond what is already supported without separate approval.
- One-hand latching and two-hand held frets remain equal choices. Explain their difference with one sentence, not device-based assumptions.

### Practice and Quick drills

- Session setup shows duration, the next skill and source once. The future five-stage outline is expandable; active practice leads with only the current task.
- Show optional Resume only for a genuinely paused in-memory session. No invented streak, progress history or personalised claim.
- Leaving an active session pauses it and releases resources. A paused session must not lock the source selector in another destination. Preserve the paused session's original input context; if the user returns with a different source, offer **Resume with previous instrument** or **Restart with this instrument**, with explicit progress consequences.
- “Start coaching” becomes **Start drill** in Quick drills; AI Coach retains its separate identity.
- String confirmation, brief detection-gap tolerance and gap-based pulse grading stay unchanged. Pulse shows Last gap / Target and each hit's grade; string clarity never implies a tempo requirement.
- Remove unverified song names from the 10-minute “Musical finish” promise. In the first redesign increment, label the existing sequence **Original chord-flow exercise** rather than implying Lathe/Khaab authenticity. Do not substitute an unverified melody or progression.

### Songs & lessons

- Separate **Library → Lesson overview → Player → Summary** as UI states within Practice. The catalog is not permanently stacked above the player. Back to lessons restores the search/filter context.
- Default playable order: Sa Re Ga Ma, Twinkle Twinkle, Yellow, I'm Yours. Unverified songs live in an **Unavailable arrangements** section, unselected by default, with the existing reason and sources.
- Cards show outcome and technique first: “Your first eight notes”, “Pick a familiar melody”, or “Practise a chord accompaniment.” Keep source status as honest secondary information.
- Primary technique choices: All / First notes / Melody / Chord accompaniment. Map First notes to the existing exercise material type. Keep advanced provenance filters in a single More filters reveal.
- Overview: outcome, prerequisites grounded in encoded frets/chords, melody-versus-accompaniment scope, three chapter choices and one chapter start action. No invented duration or mastery score; derive duration from BPM/event counts if shown.
- Player: Now/Next, line/phrase rail, compact chord/fret diagram, reference scope (**Note / Phrase / Full demo**) and one transport. BPM is primary; percent speed can appear as secondary explanation. Demo and learner phase derive from the same event cursor so every cue changes together.
- Keep My take secondary. Label screen-event recording versus microphone audio accurately; do not display a microphone-recording promise where only event recording exists.

### AI Coach

- A seven-stage learner rail: **Listen → Check mic → Play → Feedback → Slow practice → Retry → Compare**. Existing internal phases remain the timing authority; the rail is a presentation mapping, not a new competing state machine.
- Listen: pattern name, two-bar duration, current BPM, simple arrows and Hear example in the first viewport. For Steady downs, no up-strum language or hollow up arrows.
- Check mic: one instruction at a time, quiet check then test pluck; distinguish permission, signal quality and provider configuration. API key configured is not presented as verified service availability.
- Play: count-in, PLAY cue, target lane and detected attacks. No promotional paragraph, secondary explanation or conflicting Continue button. Preserve five-second preparation and audible/visible four-count.
- Feedback: lead with the measured quality or one correction. Local measurements and Astra explanation are labelled separately. Capture-quality failures lead to recording advice, not a timing judgment.
- Slow practice: one exact highlighted passage with its actual BPM and loop count; one Listen slower action, separate Listen to my passage, and a shared Stop. No microphone capture during examples.
- Retry: manual Continue is the proposed beginner default. Optional Auto-continue retains at least the existing ten-second result-review buffer and a visible Pause; this is an explicit UX change for approval, not already implemented. No silent automatic take.
- Compare: Expected / First take / Retry on one shared time axis, with the focused section preserved. Call these **timing marks**, not an audio waveform. Show one useful conclusion, error/on-time numbers and misses/extras; remaining metrics are expandable. Early/late/missed marks open the existing Explain this mistake flow.
- One compact “Powered by GPT-6 Astra” badge at AI entry and beside actual generated feedback. No badge on local tuner, lesson grading or illustrations. No free-form chat or new model capability is proposed.

### Tune

- Target string, heard note and clear tuning direction lead. Permission/readiness stays visible; unset readings use an em dash instead of a result-like zero.
- Preserve the current pitch-hold behavior and algorithm. Explain “pluck once; let it ring” and indicate when a retained reading is fading/stale.
- Place Hear target next to string selection. Stop listening and Back to lesson are reachable without scrolling away from the meter. Return does not auto-start microphone capture elsewhere.

## Visual system

- Keep Fraunces for expressive titles/wordmark, Manrope for task labels and controls. Reduce repeated display type; task title 28px desktop / 24px phone, primary target 40–56px, body 16px, control text 14–16px, essential helper text at least 14px. Metadata may use 12px only when not needed to perform the task.
- Retain the existing palette: workbench #eee5d7, parchment #f7f1e7, rosewood #3a2522, koa #b86d45, binding #efe0be, coral #de725c and success #557a64. Measure contrast rather than assuming these pass in every pairing.
- Surface strategy: quiet warm layers and existing soft shadows. Reserve the dark stage for actual playing/feedback; avoid putting every filter or empty state into a heavy dark card.
- Four-pixel spacing grid; 16px compact panel padding, 24px section gaps, 44px minimum primary touch targets, visible focus and tabular tempo/timer numbers. Rhythm-related movement follows the existing audio clock; general UI transitions use transform/opacity and reduced-motion alternatives.
- Define reusable TaskHeader, InstrumentSource, NowNext, PracticeTransport, CaptureStatus, EvidenceDrawer and TakeComparison presentations. Share their behavior/tokens, not just CSS appearance.

## Show functionality through doing

| Capability | Where the user discovers it | Proof of value | Honest boundary |
|---|---|---|---|
| Playable ukulele | Play, immediately | Touch a fret and strum | Screen interaction is not physical finger-strength practice |
| Phrase builder | Fingerpick → Build a pattern | Notes accumulate and replay in order | Maximum 30; no implicit recording |
| Guided lessons | Practice → Songs & lessons | A phrase demo and the next played note | Label melody versus accompaniment |
| Real-instrument drills | Source selector and a short drill outcome | Note accepted or Last gap feedback | Pitch/rhythm, not chord recognition |
| AI coaching | AI Coach entry and comparison | A measured mistake, slower example and retry difference | Numeric evidence goes to Astra; audio stays local |
| Tuner | Tune and optional Tune first link | Clear target/adjustment state | Needs microphone permission; no accuracy claim from mock tests |

Use short interactive examples only on explicit Play/Hear actions. Do not add an autoplay marketing reel, simulated personal results, fake progress, new account system or extra courses as part of this redesign.

## Success criteria and validation

These are acceptance targets, not measurements already achieved:

- Five beginner participants, including real-ukulele and screen-only use, can identify the next action in each destination without coaching. Aim for at least four of five succeeding unaided; record problems qualitatively rather than treating the small sample as a population estimate.
- No forced tuner routing; no cross-destination source lock; no unavailable song in the default playable path; no phase-inappropriate enabled action.
- At 390 × 844, 844 × 390, 1024 × 768 and 1440 × 900, the current target and main action stay visible, with no unintended horizontal page scrolling. Neck/pattern scrolling is intentional and labelled.
- Keyboard-only navigation, 200% zoom, reduced motion, touch targets and screen-reader status announcements are checked. Sticky elements do not cover focused content.
- Full unit/build/browser regression remains green. Validate at least one complete real-ukulele loop and permission-denial recovery in Chrome, Firefox and Safari before claiming real-device readiness.

## Sources and limits

The current audit covers entry, local demonstration, pause/navigation and three phone layouts. It did not capture live microphone acceptance, Astra responses or comparison in this turn. Those phases require new screenshots during implementation; prior test results are regression context, not new audit evidence.

[Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) informs the secondary details strategy. [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) and [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) inform interaction checks. The chosen 44px touch target is a product target, not a claim that WCAG AA requires 44px everywhere.

## Approval boundary

Approve the guided-workbench direction before visual implementation. Then use Product Design Ideate with this audit's screenshots to explore three visual options for the shared active-practice screen, choose one, and apply it incrementally to the existing app. Keep the current project; no scaffold, framework migration, install, commit, push or deployment is implied by approving a design direction.
