# Approved learning-flow fixes

User approved all pending fixes on September 12, 2026. Work in the existing local application; preserve all existing uncommitted implementation. Do not commit, push, expose credentials, or silently claim musical verification.

## Task 1: Songs
Synchronize upper and lower song/demo panels using the current demo line/chord/note, restoring learner position afterward. Allow Songs instrument-source selection. Real ukulele melody progresses through pitch-confirmed separate attacks (including repeated pitches), while chord lessons count onsets and explicitly self-check chord shapes/direction. Suppress reference/demo scoring. Stop microphone on navigation/reset/song/chapter/source changes, avoid pending permission races. Disable on-screen take recording controls in real mode. Label Khaab and Lathe arrangements unverified and disable their guided courses/demo, preserving data. Do not invent replacement music. Show useful heard/expected feedback and retryable errors. Tests for DOM sync, real melody/chord progression, repeated notes, permissions and teardown. Files: main.ts, lesson.ts, new song mic helpers/tests, Songs-specific HTML/CSS sections. No AI edits.

## Task 2: AI Coach
Fix odd-length focused loop boundary by keeping beat-aligned trailing rests in audio, animation, grading and duration. Clearly label original/retry tempo. Beginner steady downs uses down arrows only, subtle silent hand return. Add optional C/F/G/C chord changes with synced sample notes and diagrams and explicit timing-only scoring. Show 10-second cancellable review of Astra response, 5-second preparation before takes, and four-beat visible/audio count-in then PLAY. Pausing/continuing must not start unexpected capture. Compare expected and both takes in aligned per-cycle beat traces with offsets/misses/extras, tempo labels; do not fake waveform audio. Preserve recordings and existing controls. Test all supported BPM and cancellation/loop boundaries.

## Task 3: Verification and roadmap
Review implementation, run unit/build and desktop/mobile browser coverage. Musical arrangements remain unverified; physical uke tests cannot be claimed. Research and provide 3 prioritised product improvements and 3 Astra-specific improvements, with implementation and success measures after tests.

## Decisions
Continue the already approved existing local app; no worktree migration of dirty user changes. Prior existing-key reuse approval remains in force. The new change set is not a request to commit/push. Keep original unverified song data recoverable behind a visible block. Data flows for Songs and AI are separate except index.html/style.css: agents edit only their assigned sections.
