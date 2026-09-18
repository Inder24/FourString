# Modern Luthier Studio — design QA

**Findings**

No actionable P0, P1, or P2 differences remain in the final comparison. The rendered instrument deliberately keeps all 12 frets and the complete strum body in view, whereas the concept crops a larger body at the right edge. That is an accepted playability constraint, not an unfinished visual fix.

- [P3] The live sidebar is denser than the concept. At 992 px high, the implementation also exposes Clear, volume, mute, and Help, so the Learn and Tools groups have less vertical air. A future polish pass could use an expandable utility drawer at shorter desktop heights; this does not impede navigation or legibility.
- [P3] The concept's large photographic body and hand illustration were not copied onto the interactive surface. The live fretboard and sound-hole remain native pointer targets, with locally bundled koa and rosewood textures. An illustration overlay would risk blocking the playable instrument.

**Comparison target and evidence**

- Source visual truth: `docs/design/studio/selected-direction.png` (1586 × 992 px).
- Browser-rendered implementation: `ui/v1/play-ready-reference-viewport.png` (1586 × 992 px), captured from `http://127.0.0.1:4174/` after enabling sound.
- Both are desktop web views at a 1586 × 992 CSS-pixel viewport, device scale factor 1, dark theme, ready-to-play state. No density normalization or browser-chrome crop was required.
- Full-view, equal-size side-by-side evidence: `docs/design/studio/qa-side-by-side.png` (3172 × 992 px).
- Focused navigation/typography evidence: `docs/design/studio/qa-sidebar-detail.png` (600 × 720 px). The left 300 px are the source and the right 300 px are the implementation.
- Responsive evidence: `ui/v1/play-ready-desktop.png`, `ui/v1/play-ready-mobile.png`, plus desktop and mobile captures of Practice, Songs, Quick drills, AI Coach, Tune, Tempo, and Check chord in `ui/v1/`.

**Required fidelity surfaces**

- Fonts and typography: Fraunces provides the warm display hierarchy, Manrope the compact control labels. The live title and navigation retain the source's serif/sans contrast. Sidebar copy is slightly smaller to accommodate all working tools; labels remain readable and do not truncate.
- Spacing and layout rhythm: the sidebar, top status, headline, and instrument follow the source's large-region hierarchy. The continuous 12-fret instrument is less cinematic but more usable than the concept's cropped close-up. Desktop navigation is fixed; phone navigation is bottom-fixed with instrument controls above it.
- Colors and tokens: dark walnut surroundings, rosewood neck, koa body, cream type, coral active accents, and nickel strings match the chosen direction. Lesson panels are intentionally opaque cream for contrast on the dark workbench.
- Image quality and asset fidelity: the background and wood textures are self-hosted raster assets with no remote dependency. They are sharp at the captured sizes and sit behind the original live fret and string DOM, not over it. The concept's hand illustration is intentionally omitted from the functional instrument.
- Copy and content: Play, Practice, Songs, AI Coach, Tune, Tempo, and Check chord are explicit top-level destinations. The first screen uses the concept's “Good to see you.” greeting. Existing song provenance and exercise guidance remain visible rather than being replaced with decorative copy.

**Comparison history**

1. Initial browser capture: [P1] the sound-enable overlay obscured the instrument. Replaced it with a compact gate card; the final ready and gated views are in `ui/v1/`.
2. Initial dark-workbench capture: [P1] inherited translucent lesson panels and dark text lost contrast. Set cream panels to an opaque surface; compare `ui/v1/practice-songs-desktop.png` in the final set.
3. Initial phone capture: [P1] the bottom navigation covered the A string in the strum deck. Reduced portrait top spacing and deck gap; the final `ui/v1/play-ready-mobile.png` shows G, C, E, and A above the navigation.
4. Initial Songs demo capture: [P1] a transform on the entrance animation made the fixed now/next cue scroll away. Switched to an opacity-only entrance; the Playwright Songs cue test passes.
5. Initial 844 × 390 landscape check: [P2] the horizontal navigation overflowed. Allowed the mid-size navigation to wrap; the tablet/landscape Playwright checks pass.
6. Final comparison: reopened the equal-size combined image and focused sidebar crop after the fixes above. No remaining P0/P1/P2 finding.

**Interactions and runtime checks**

- Playwright coverage exercises desktop and phone navigation, Songs search and lesson cue, Play/Explore, Practice, Quick drills, AI Coach, Tune, Tempo, and Check chord. The two browser-test groups total 198 passed and 4 skipped; the final layout/navigation rerun passed 100 with 4 skipped.
- Unit tests: 134 passed. Production TypeScript/Vite build passed.
- A browser pass at 390 × 844 enabled sound and navigated Practice → AI Coach → Songs → Tune → Tempo → Check chord; no page or console errors were observed.
- Physical microphone accuracy and real-ukulele timing were not re-measured in this visual redesign QA; those still warrant on-device validation.

**Open Questions**

None blocking. The larger, cropped concept instrument is intentionally not used as the live playing geometry.

**Implementation Checklist**

- [x] Preserve the native playable fretboard and sound-hole interaction.
- [x] Expose the main destinations directly on desktop and through an accessible phone Tools menu.
- [x] Keep all four mobile strum strings visible above the fixed navigation.
- [x] Verify loading, ready, reduced-motion, desktop, phone, tablet, and landscape states.
- [x] Capture versioned UI screenshots and compare the selected direction side by side.

final result: passed
