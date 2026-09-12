import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces/wght.css";
import "./style.css";
import "./lesson-trust.css";

import { AdaptiveCoachController } from "./adaptive-coach-controller";
import { AudioEngine } from "./audio";
import { evaluateCoachPitch, gradeRhythmHit, OnsetDetector, NoteConfirmation, PulseDrill, type CoachPitchGrade } from "./coach";
import { chordFretLabel, chordHint, chordNoteNames, gestureHint, stringHint } from "./guidance";
import {
  chordMidiNotes,
  canPracticeLessonSong,
  isMelodyChapter,
  LESSON_CHORDS,
  LESSON_SONGS,
  lessonBackingChordEvents,
  lessonLineBeats,
  lessonLineEvents,
  lessonPlaybackEvents,
  matchesChord,
  type ChordName,
  type LessonGesture,
  type LessonPhase,
} from "./lesson";
import { RealMelodyConfirmation, RealStrumCounter } from "./song-input";
import { filterLessonLibrary, lessonTrust, safeLessonSourceUrl, type LessonLibraryFilters } from "./lesson-trust";
import { downloadLessonPracticeScore, trustLabel } from "./lesson-trust-ui";
import {
  appendFingerpickStep,
  FRET_COUNT,
  getCrossedStringIndices,
  getFretGridTemplate,
  getFretPosition,
  MAX_PATTERN_STEPS,
  UKULELE_STRINGS,
  velocityFromGesture,
  type FretPosition,
  type PlayMode,
  type StringId,
  type StrumDirection,
} from "./music";
import { InstrumentState } from "./state";
import {
  adaptPracticeTempo,
  formatPracticeTime,
  PracticePitchConfirmation,
  practiceStageOffsetSeconds,
  TEN_MINUTE_SECONDS,
  TEN_MINUTE_STAGES,
  type PracticeStage,
} from "./practice";
import { createSavedTake, MAX_TAKE_DURATION_MS, MAX_TAKE_EVENTS, parseSavedTake, type SavedTake, type TakeNoteEvent } from "./take";
import { targetPitch, TUNING_TARGETS, TunerEngine, type PitchReading, type SignalFrame, type TunerStatus } from "./tuner";

type AppView = PlayMode | "tuner" | "coach" | "ai-coach" | "practice" | "chapters";
type CoachDrill = "strings" | "pulse";
type HandLayout = "one" | "two";
type PracticeInput = "screen" | "real";
type LessonInput = "screen" | "real";
type ReferencePlayback =
  | "tuner-target"
  | "coach-target"
  | "practice-target"
  | "practice-bar"
  | "lesson-chord"
  | "lesson-bar";

const state = new InstrumentState();
const audio = new AudioEngine();
const tuner = new TunerEngine();
const fretButtons = new Map<string, HTMLButtonElement>();
const activeFretPointers = new Map<number, string>();
const strumPointers = new Map<
  number,
  {
    stringIndex: number;
    y: number;
    time: number;
    pressure: number;
    hasStrummed: boolean;
    sounded: Set<number>;
    direction: StrumDirection | null;
    lessonChecked: boolean;
  }
>();
let patternSteps: FretPosition[] = [];
let patternArmed = false;
let patternPlaying = false;
let currentPatternIndex = -1;
let patternTimers: number[] = [];
let patternTempo = 90;
let currentView: AppView = "strum";
let tunerTarget: StringId | null = null;
let lastTunerReading: PitchReading | null = null;
let lastTunerReadingAt = 0;
let selectedSongIndex = 0;
let selectedChapterIndex = 0;
let lessonPhase: LessonPhase = "preview";
let lessonLineIndex = 0;
let lessonChordIndex = 0;
let lessonGestureIndex = 0;
let lessonDemoPlaying = false;
let lessonTimers: number[] = [];
let lessonDemoLineIndex = -1;
let lessonDemoChordIndex = -1;
let lessonDemoGestureIndex = -1;
let lessonFeedback: "neutral" | "try-again" | "success" = "neutral";
let lessonMicIgnoreUntil = 0;
let lessonInput: LessonInput = storedPreference("four-strings-lesson-input") === "real" ? "real" : "screen";
const lessonPitchConfirmation = new RealMelodyConfirmation();
const lessonStrumCounter = new RealStrumCounter();
let lessonTakeRecording = false;
let lessonTakePlaying = false;
let lessonTakeStartedAt = 0;
let lessonTakeEvents: TakeNoteEvent[] = [];
let lessonTakeTimers: number[] = [];
let lessonTakeStopTimer = 0;
let coachDrill: CoachDrill = "strings";
let coachTargetIndex = 0;
let coachStableFrames = 0;
let coachPulseHits = 0;
const coachPulse = new PulseDrill();
const coachConfirmation = new NoteConfirmation();
let coachScreenActive = false;
const coachOnsets = new OnsetDetector();
let practiceActive = false;
let practicePaused = false;
let practiceComplete = false;
let practiceStartedAt = 0;
let practicePausedAt = 0;
let practicePausedDuration = 0;
let practiceStageIndex = 0;
let practiceTargetIndex = 0;
let practiceStageMastered = false;
let practiceClean = 0;
let practiceMisses = 0;
let practiceCleanStreak = 0;
let practiceMissWindow = 0;
let practiceTempo = 72;
let practiceRhythmAnchor = 0;
let practiceTimer = 0;
let practiceSelectedSong: "lathe-di-chadar" | "khaab" = "lathe-di-chadar";
let practiceAdjustment = "Tempo changes after three correct moves or two misses.";
let practiceInput: PracticeInput = storedPreference("four-strings-practice-input") === "real" ? "real" : "screen";
const practicePitchConfirmation = new PracticePitchConfirmation();
let practiceMicIgnoreUntil = 0;
const practiceOnsets = new OnsetDetector(0.018, 220);
let referenceSpeed = 0.75;
let referencePlayback: ReferencePlayback | null = null;
let referenceStep = -1;
let referenceTimers: number[] = [];
let tunerReferenceSuppressUntil = 0;
let coachReferenceSuppressUntil = 0;
let practiceReferenceSuppressUntil = 0;
let lastPlayView: PlayMode = "strum";
let lastPracticeView: "practice" | "chapters" | "coach" = "practice";
let handLayout: HandLayout = storedPreference("four-strings-hand-layout") === "one"
  ? "one"
  : storedPreference("four-strings-hand-layout") === "two"
    ? "two"
    : window.matchMedia("(max-width: 700px)").matches
      ? "one"
      : "two";
let focusMode = false;

const fretboard = byId<HTMLDivElement>("fretboard");
const fretLabels = byId<HTMLDivElement>("fret-labels");
const neckStrings = byId<HTMLDivElement>("neck-strings");
const bodyStrings = byId<HTMLDivElement>("body-strings");
const bodyStringNames = byId<HTMLDivElement>("body-string-names");
const positionMarkers = byId<HTMLDivElement>("position-markers");
const strumSurface = byId<HTMLElement>("strum-surface");
const instrumentFrame = byId<HTMLDivElement>("instrument-frame");
const audioGate = byId<HTMLDivElement>("audio-gate");
const enableButton = byId<HTMLButtonElement>("enable-button");
const gateTitle = byId<HTMLElement>("gate-title");
const gateMessage = byId<HTMLElement>("gate-message");
const audioStatus = byId<HTMLElement>("audio-status");
const audioStatusText = byId<HTMLElement>("audio-status-text");
const viewEyebrow = byId<HTMLElement>("view-eyebrow");
const instrumentTitle = byId<HTMLElement>("instrument-title");
const modeGuidance = byId<HTMLElement>("mode-guidance");
const lastNote = byId<HTMLElement>("last-note");
const readoutLabel = byId<HTMLElement>("readout-label");
const noteOrb = byId<HTMLElement>("note-orb");
const ripple = byId<HTMLElement>("ripple");
const navPlay = byId<HTMLButtonElement>("nav-play");
const navPractice = byId<HTMLButtonElement>("nav-practice");
const modeStrum = byId<HTMLButtonElement>("mode-strum");
const modeExplore = byId<HTMLButtonElement>("mode-explore");
const modeTuner = byId<HTMLButtonElement>("mode-tuner");
const modeCoach = byId<HTMLButtonElement>("mode-coach");
const modeAiCoach = byId<HTMLButtonElement>("mode-ai-coach");
const modePractice = byId<HTMLButtonElement>("mode-practice");
const modeChapters = byId<HTMLButtonElement>("mode-chapters");
const playSubnav = byId<HTMLElement>("play-subnav");
const practiceSubnav = byId<HTMLElement>("practice-subnav");
const playSubnavNote = byId<HTMLElement>("play-subnav-note");
const layoutOneHand = byId<HTMLButtonElement>("layout-one-hand");
const layoutTwoHands = byId<HTMLButtonElement>("layout-two-hands");
const focusModeButton = byId<HTMLButtonElement>("focus-mode");
const clearButton = byId<HTMLButtonElement>("clear-button");
const muteButton = byId<HTMLButtonElement>("mute-button");
const volumeRange = byId<HTMLInputElement>("volume-range");
const inputHint = byId<HTMLElement>("input-hint");
const patternBuilder = byId<HTMLElement>("pattern-builder");
const patternArm = byId<HTMLButtonElement>("pattern-arm");
const patternTrack = byId<HTMLOListElement>("pattern-steps");
const patternEmpty = byId<HTMLElement>("pattern-empty");
const patternCount = byId<HTMLElement>("pattern-count");
const patternPlay = byId<HTMLButtonElement>("pattern-play");
const patternPlayText = byId<HTMLElement>("pattern-play-text");
const patternUndo = byId<HTMLButtonElement>("pattern-undo");
const patternClear = byId<HTMLButtonElement>("pattern-clear");
const patternStatus = byId<HTMLElement>("pattern-status");
const patternTempoRange = byId<HTMLInputElement>("pattern-tempo");
const patternTempoValue = byId<HTMLOutputElement>("pattern-tempo-value");
const tunerWorkbench = byId<HTMLElement>("tuner-workbench");
const tunerToggle = byId<HTMLButtonElement>("tuner-toggle");
const tunerMeter = byId<HTMLElement>("tuner-meter");
const tunerNote = byId<HTMLElement>("tuner-note");
const tunerStringLabel = byId<HTMLElement>("tuner-string-label");
const tunerFrequency = byId<HTMLElement>("tuner-frequency");
const tunerCents = byId<HTMLElement>("tuner-cents");
const tunerStatus = byId<HTMLElement>("tuner-status");
const tunerHearTarget = byId<HTMLButtonElement>("tuner-hear-target");
const tunerReferenceNote = byId<HTMLElement>("tuner-reference-note");
const coachWorkbench = byId<HTMLElement>("coach-workbench");
const coachToggle = byId<HTMLButtonElement>("coach-toggle");
const coachLive = byId<HTMLElement>("coach-live");
const coachProgress = byId<HTMLElement>("coach-progress");
const coachGoal = byId<HTMLElement>("coach-goal");
const coachStringEcho = byId<HTMLElement>("coach-string-echo");
const coachHeardNote = byId<HTMLElement>("coach-heard-note");
const coachHeardDetail = byId<HTMLElement>("coach-heard-detail");
const coachSignal = byId<HTMLElement>("coach-signal");
const coachSignalDetail = byId<HTMLElement>("coach-signal-detail");
const coachBeats = byId<HTMLElement>("coach-beats");
const coachStatus = byId<HTMLElement>("coach-status");
const coachNext = byId<HTMLElement>("coach-next");
const coachHold = byId<HTMLElement>("coach-hold");
const coachKicker = byId<HTMLElement>("coach-kicker");
const coachCopy = byId<HTMLElement>("coach-copy");
const coachPrivacy = byId<HTMLElement>("coach-privacy");
const coachLayerTarget = byId<HTMLElement>("coach-layer-target");
const coachLayerNotes = byId<HTMLElement>("coach-layer-notes");
const coachHearTarget = byId<HTMLButtonElement>("coach-hear-target");
const coachReferenceStatus = byId<HTMLElement>("coach-reference-status");
const coachLayerHint = byId<HTMLElement>("coach-layer-hint");
const coachLayerHintDetail = byId<HTMLElement>("coach-layer-hint-detail");
const aiCoachWorkbench = byId<HTMLElement>("ai-coach-workbench");
const instrumentSourceChoice = byId<HTMLElement>("instrument-source-choice");
const instrumentSourceTitle = byId<HTMLElement>("instrument-source-title");
const practiceWorkbench = byId<HTMLElement>("practice-workbench");
const practiceKicker = byId<HTMLElement>("practice-kicker");
const practiceDescription = byId<HTMLElement>("practice-description");
const practiceInputScreen = byId<HTMLButtonElement>("practice-input-screen");
const practiceInputReal = byId<HTMLButtonElement>("practice-input-real");
const practiceInputNote = byId<HTMLElement>("practice-input-note");
const practiceClock = byId<HTMLOutputElement>("practice-clock");
const practiceStart = byId<HTMLButtonElement>("practice-start");
const practiceTimeline = byId<HTMLOListElement>("practice-timeline");
const practiceStageLabel = byId<HTMLElement>("practice-stage-label");
const practiceStageTitle = byId<HTMLElement>("practice-stage-title");
const practiceStageCopy = byId<HTMLElement>("practice-stage-copy");
const practiceTarget = byId<HTMLElement>("practice-target");
const practiceInsight = byId<HTMLElement>("practice-insight");
const practiceInsightKicker = byId<HTMLElement>("practice-insight-kicker");
const practiceProgressDetail = byId<HTMLElement>("practice-progress-detail");
const practiceMicFeedback = byId<HTMLElement>("practice-mic-feedback");
const practiceMicNote = byId<HTMLElement>("practice-mic-note");
const practiceMicDetail = byId<HTMLElement>("practice-mic-detail");
const practiceMicMeter = byId<HTMLElement>("practice-mic-meter");
const practiceAdjustmentReadout = byId<HTMLElement>("practice-adjustment");
const practiceTempoReadout = byId<HTMLElement>("practice-tempo");
const practiceCleanLabel = byId<HTMLElement>("practice-clean-label");
const practiceCleanReadout = byId<HTMLElement>("practice-clean");
const practiceMissesReadout = byId<HTMLElement>("practice-misses");
const practiceNext = byId<HTMLButtonElement>("practice-next");
const practiceReset = byId<HTMLButtonElement>("practice-reset");
const practiceStatus = byId<HTMLElement>("practice-status");
const practiceLayerTarget = byId<HTMLElement>("practice-layer-target");
const practiceLayerNotes = byId<HTMLElement>("practice-layer-notes");
const practiceHearTarget = byId<HTMLButtonElement>("practice-hear-target");
const practiceHearBar = byId<HTMLButtonElement>("practice-hear-bar");
const practiceReferenceStatus = byId<HTMLElement>("practice-reference-status");
const practiceLayerHint = byId<HTMLElement>("practice-layer-hint");
const practiceLayerHintDetail = byId<HTMLElement>("practice-layer-hint-detail");
const lessonWorkbench = byId<HTMLElement>("lesson-workbench");
const songSearch = byId<HTMLInputElement>("song-search");
const songResults = byId<HTMLElement>("song-results");
const lessonStatusFilter = byId<HTMLSelectElement>("lesson-status-filter");
const lessonTypeFilter = byId<HTMLSelectElement>("lesson-type-filter");
const lessonSongTitle = byId<HTMLElement>("lesson-song-title");
const lessonSongMeta = byId<HTMLElement>("lesson-song-meta");
const lessonRights = byId<HTMLElement>("lesson-rights");
const lessonTrustLabel = byId<HTMLElement>("lesson-trust-label");
const lessonMaterialType = byId<HTMLElement>("lesson-material-type");
const lessonTuning = byId<HTMLElement>("lesson-tuning");
const lessonSourceKey = byId<HTMLElement>("lesson-source-key");
const lessonArrangementVersion = byId<HTMLElement>("lesson-arrangement-version");
const lessonSourceNote = byId<HTMLElement>("lesson-source-note");
const lessonSourceList = byId<HTMLUListElement>("lesson-source-list");
const lessonDownload = byId<HTMLButtonElement>("lesson-download");
const lessonTitle = byId<HTMLElement>("lesson-technique-title");
const lessonCopy = byId<HTMLElement>("lesson-technique-copy");
const lessonTempo = byId<HTMLElement>("lesson-tempo");
const lessonPattern = byId<HTMLElement>("lesson-pattern");
const lessonProgress = byId<HTMLElement>("lesson-progress");
const lessonStatus = byId<HTMLElement>("lesson-status");
const lessonLines = byId<HTMLOListElement>("lesson-lines");
const lessonDemo = byId<HTMLButtonElement>("lesson-demo");
const lessonPractice = byId<HTMLButtonElement>("lesson-practice");
const lessonCue = byId<HTMLElement>("lesson-cue");
const lessonCueMode = byId<HTMLElement>("lesson-cue-mode");
const lessonCueLine = byId<HTMLElement>("lesson-cue-line");
const lessonCueNative = byId<HTMLElement>("lesson-cue-native");
const lessonCueTargetLabel = byId<HTMLElement>("lesson-cue-target-label");
const lessonCueChord = byId<HTMLElement>("lesson-cue-chord");
const lessonCueFrets = byId<HTMLElement>("lesson-cue-frets");
const lessonCueShape = byId<HTMLElement>("lesson-cue-shape");
const lessonCueBeat = byId<HTMLElement>("lesson-cue-beat");
const lessonCueGesture = byId<HTMLElement>("lesson-cue-gesture");
const lessonGestureRail = byId<HTMLElement>("lesson-gesture-rail");
const lessonCueNext = byId<HTMLElement>("lesson-cue-next");
const lessonCueNextDetail = byId<HTMLElement>("lesson-cue-next-detail");
const lessonLayerTarget = byId<HTMLElement>("lesson-layer-target");
const lessonLayerNotes = byId<HTMLElement>("lesson-layer-notes");
const lessonHearChord = byId<HTMLButtonElement>("lesson-hear-chord");
const lessonHearBar = byId<HTMLButtonElement>("lesson-hear-bar");
const lessonReferenceStatus = byId<HTMLElement>("lesson-reference-status");
const lessonLayerHint = byId<HTMLElement>("lesson-layer-hint");
const lessonLayerHintDetail = byId<HTMLElement>("lesson-layer-hint-detail");
const lessonTakeStatus = byId<HTMLElement>("lesson-take-status");
const lessonTakeRecord = byId<HTMLButtonElement>("lesson-take-record");
const lessonTakePlay = byId<HTMLButtonElement>("lesson-take-play");
const lessonTakeClear = byId<HTMLButtonElement>("lesson-take-clear");
const lessonTake = byId<HTMLElement>("lesson-take");
const lessonInputScreen = byId<HTMLButtonElement>("lesson-input-screen");
const lessonInputReal = byId<HTMLButtonElement>("lesson-input-real");
const lessonInputNote = byId<HTMLElement>("lesson-input-note");
const lessonRealChecks = byId<HTMLElement>("lesson-real-checks");
const lessonShapeCheck = byId<HTMLInputElement>("lesson-shape-check");
const lessonDirectionCheck = byId<HTMLInputElement>("lesson-direction-check");
const lessonHeardStatus = byId<HTMLElement>("lesson-heard-status");
const performanceReadout = byId<HTMLElement>("performance-readout");
const realUkeButton = byId<HTMLButtonElement>("real-uke-button");

const adaptiveCoach = new AdaptiveCoachController({
  root: aiCoachWorkbench,
  audio,
  tuner,
  ensureAudio: () => initializeAudio({ focusInstrument: false }),
});

const fretGridTemplate = getFretGridTemplate();
fretLabels.style.gridTemplateColumns = fretGridTemplate;

buildInstrument();
bindControls();
renderInstrumentState();
updateInputHint();
renderPattern();
renderLesson();
renderCoach();
renderPractice();
renderHandLayout();
setView("strum");

function buildInstrument(): void {
  const openLabel = document.createElement("span");
  openLabel.className = "fret-label is-open-label";
  openLabel.textContent = "OPEN";
  fretLabels.append(openLabel);

  for (let fret = 1; fret <= FRET_COUNT; fret += 1) {
    const label = document.createElement("span");
    label.className = "fret-label";
    label.textContent = String(fret).padStart(2, "0");
    fretLabels.append(label);
  }

  const cellGrid = document.createElement("div");
  cellGrid.className = "fret-cells";
  cellGrid.style.gridTemplateColumns = fretGridTemplate;

  UKULELE_STRINGS.forEach((string, stringIndex) => {
    const neckString = document.createElement("span");
    neckString.className = "instrument-string neck-string";
    neckString.dataset.string = String(stringIndex);
    neckString.style.setProperty("--string-row", String(stringIndex));
    neckStrings.append(neckString);

    const bodyString = document.createElement("span");
    bodyString.className = "instrument-string body-string";
    bodyString.dataset.string = String(stringIndex);
    bodyString.style.setProperty("--string-row", String(stringIndex));
    bodyStrings.append(bodyString);

    const bodyName = document.createElement("span");
    bodyName.className = "body-string-name";
    bodyName.dataset.string = String(stringIndex);
    bodyName.style.setProperty("--string-row", String(stringIndex));
    bodyName.innerHTML = `<small>${physicalStringNumber(stringIndex)}</small><strong>${string.id}</strong>`;
    bodyStringNames.append(bodyName);

    for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
      const position = getFretPosition(stringIndex, fret);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fret-cell";
      button.dataset.string = String(stringIndex);
      button.dataset.fret = String(fret);
      button.dataset.key = cellKey(stringIndex, fret);
      button.setAttribute("aria-pressed", "false");
      const accessibleLabel = `${string.id} string number ${physicalStringNumber(stringIndex)}, ${fret === 0 ? "open" : `fret ${fret}`}, ${position.noteName}`;
      button.dataset.baseLabel = accessibleLabel;
      button.setAttribute("aria-label", accessibleLabel);
      button.style.gridRow = String(stringIndex + 1);
      button.style.gridColumn = String(fret + 1);

      const label = document.createElement("span");
      label.className = "finger-label";
      label.textContent = position.noteName.replace(/\d+$/, "");
      button.append(label);

      if (fret === 0) {
        const stringName = document.createElement("span");
        stringName.className = "string-identity";
        stringName.innerHTML = `<small>${physicalStringNumber(stringIndex)}</small><strong>${string.id}</strong>`;
        button.prepend(stringName);
      }

      const sequenceBadge = document.createElement("span");
      sequenceBadge.className = "sequence-badge";
      sequenceBadge.setAttribute("aria-hidden", "true");
      button.append(sequenceBadge);

      fretButtons.set(cellKey(stringIndex, fret), button);
      cellGrid.append(button);
    }
  });

  fretboard.append(cellGrid);
  positionMarkers.style.gridTemplateColumns = fretGridTemplate;
  [3, 5, 7, 10].forEach((fret) => appendMarker(fret, 3));
  appendMarker(12, 2);
  appendMarker(12, 4);
}

function appendMarker(fret: number, row: number): void {
  const marker = document.createElement("span");
  marker.className = "position-marker";
  marker.style.gridColumn = String(fret + 1);
  marker.style.gridRow = String(row);
  positionMarkers.append(marker);
}

function bindControls(): void {
  enableButton.addEventListener("click", () => void initializeAudio());
  realUkeButton.addEventListener("click", () => {
    setPracticeInput("real");
    setView("tuner");
    modeTuner.focus({ preventScroll: true });
  });
  navPlay.addEventListener("click", () => setView(lastPlayView));
  navPractice.addEventListener("click", () => setView(lastPracticeView));
  modeStrum.addEventListener("click", () => setView("strum"));
  modeExplore.addEventListener("click", () => setView("explore"));
  modeTuner.addEventListener("click", () => setView("tuner"));
  modeCoach.addEventListener("click", () => setView("coach"));
  modeAiCoach.addEventListener("click", () => setView("ai-coach"));
  modePractice.addEventListener("click", () => setView("practice"));
  modeChapters.addEventListener("click", () => setView("chapters"));
  layoutOneHand.addEventListener("click", () => setHandLayout("one"));
  layoutTwoHands.addEventListener("click", () => setHandLayout("two"));
  focusModeButton.addEventListener("click", () => setFocusMode(!focusMode));

  patternTempoRange.addEventListener("input", () => {
    patternTempo = Number(patternTempoRange.value);
    patternTempoValue.value = `${patternTempo} BPM`;
    patternTempoRange.style.setProperty("--range-progress", `${((patternTempo - 50) / 130) * 100}%`);
    if (patternPlaying) {
      stopPatternPlayback();
      startPatternPlayback();
    }
  });
  patternTempoRange.style.setProperty("--range-progress", `${((patternTempo - 50) / 130) * 100}%`);

  tunerToggle.addEventListener("click", () => {
    if (tuner.isListening) stopTuner();
    else void startTuner();
  });
  document.querySelectorAll<HTMLButtonElement>(".tuner-target").forEach((button) => {
    button.addEventListener("click", () => {
      stopReferenceAudio();
      tunerTarget = button.dataset.target === "auto" ? null : (button.dataset.target as StringId);
      renderTunerTargets();
      renderTunerReference();
      resetTunerMeter(tuner.isListening ? "Listening — play the selected string." : "Press Start listening when ready.");
    });
  });
  tunerHearTarget.addEventListener("click", () => void playTunerReference());

  coachToggle.addEventListener("click", () => {
    if (coachIsActive()) stopCoach();
    else void startCoach();
  });
  document.querySelectorAll<HTMLButtonElement>(".coach-drill").forEach((button) => {
    button.addEventListener("click", () => {
      stopReferenceAudio();
      stopCoach();
      coachDrill = button.dataset.coachDrill as CoachDrill;
      resetCoach();
      renderCoach();
    });
  });

  practiceInputScreen.addEventListener("click", () => setPracticeInput("screen"));
  practiceInputReal.addEventListener("click", () => setPracticeInput("real"));
  coachHearTarget.addEventListener("click", () => void playCoachReference());
  practiceHearTarget.addEventListener("click", () => void playPracticeReference("target"));
  practiceHearBar.addEventListener("click", () => void playPracticeReference("bar"));
  lessonHearChord.addEventListener("click", () => void playLessonReference("chord"));
  lessonHearBar.addEventListener("click", () => void playLessonReference("bar"));
  document.querySelectorAll<HTMLButtonElement>("[data-reference-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      referenceSpeed = Number(button.dataset.referenceSpeed);
      stopReferenceAudio();
      renderReferenceControls();
    });
  });

  practiceStart.addEventListener("click", async () => {
    if (!practiceActive && !practiceComplete) {
      if (practiceInput === "screen" && !audio.isReady) {
        practiceStart.disabled = true;
        practiceStart.textContent = "Loading strings…";
        practiceStatus.textContent = "Loading the sampled ukulele, then your session will begin.";
        const ready = await initializeAudio({ focusInstrument: false });
        practiceStart.disabled = false;
        if (!ready) {
          practiceStatus.textContent = "The sampled ukulele could not load. Check the local server and try again.";
          renderPractice();
          return;
        }
      }
      if (practiceInput === "real" && !tuner.isListening) {
        practiceStart.disabled = true;
        practiceStart.textContent = "Requesting mic…";
        practiceStatus.textContent = "Allow microphone access, then play near this device.";
        const ready = await startPracticeMicrophone();
        practiceStart.disabled = false;
        if (!ready) {
          renderPractice();
          return;
        }
      }
      startPracticeSession();
    }
    else if (practiceComplete) resetPracticeSession();
    else if (practicePaused) await resumePracticeSession();
    else pausePracticeSession();
  });
  practiceNext.addEventListener("click", advancePracticeStage);
  practiceReset.addEventListener("click", resetPracticeSession);
  document.querySelectorAll<HTMLButtonElement>("[data-practice-song]").forEach((button) => {
    button.addEventListener("click", () => {
      if (practiceActive) return;
      practiceSelectedSong = button.dataset.practiceSong as typeof practiceSelectedSong;
      renderPractice();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".chapter-tab").forEach((button) => {
    button.addEventListener("click", () => {
      stopLessonTakePlayback();
      if (lessonTakeRecording) finishLessonTakeRecording();
      stopReferenceAudio();
      selectedChapterIndex = Number(button.dataset.chapter) - 1;
      resetLesson("Chapter changed. Hear its pattern, then start your turn.");
    });
  });
  songSearch.addEventListener("input", renderSongResults);
  lessonStatusFilter.addEventListener("change", renderSongResults);
  lessonTypeFilter.addEventListener("change", renderSongResults);
  songResults.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".song-result") : null;
    if (!button) return;
    const nextIndex = LESSON_SONGS.findIndex((song) => song.id === button.dataset.songId);
    if (nextIndex < 0 || nextIndex === selectedSongIndex) return;
    stopLessonTakePlayback();
    if (lessonTakeRecording) finishLessonTakeRecording();
    stopReferenceAudio();
    selectedSongIndex = nextIndex;
    selectedChapterIndex = 0;
    songSearch.value = "";
    resetLesson(`${currentSong().title} selected. Choose a chapter or hear the four-part demo.`);
    if (window.matchMedia("(max-width: 700px)").matches && canPracticeLessonSong(currentSong())) {
      lessonCue.scrollIntoView({ block: "center" });
    }
  });
  lessonDemo.addEventListener("click", async () => {
    if (!canPracticeLessonSong(currentSong())) return;
    stopReferenceAudio();
    if (!audio.isReady && !(await initializeAudio({ focusInstrument: false }))) return;
    if (lessonDemoPlaying) stopLessonDemo("Demo stopped. Start practice when you are ready.");
    else startLessonDemo();
  });
  lessonPractice.addEventListener("click", async () => {
    if (!canPracticeLessonSong(currentSong())) return;
    if (lessonInput === "screen" && !audio.isReady && !(await initializeAudio({ focusInstrument: false }))) return;
    if (lessonPhase === "preview" || lessonPhase === "complete") await startLessonPractice();
    else resetLesson("Practice reset. Hear the example or begin again.");
  });
  lessonTakeRecord.addEventListener("click", async () => {
    if (lessonTakeRecording) finishLessonTakeRecording();
    else await startLessonTakeRecording();
  });
  lessonTakePlay.addEventListener("click", async () => {
    if (lessonTakePlaying) stopLessonTakePlayback();
    else await playSavedLessonTake();
  });
  lessonTakeClear.addEventListener("click", clearSavedLessonTake);
  lessonInputScreen.addEventListener("click", () => setLessonInput("screen"));
  lessonInputReal.addEventListener("click", () => setLessonInput("real"));
  lessonDownload.addEventListener("click", () => downloadLessonPracticeScore(currentSong()));

  patternArm.addEventListener("click", () => {
    stopPatternPlayback();
    patternArmed = !patternArmed;
    patternStatus.textContent = patternArmed
      ? "Add notes is on. Tap frets to build your pattern."
      : "Add notes is off. Fret taps will only preview sound.";
    renderPattern();
  });

  patternPlay.addEventListener("click", () => {
    if (patternPlaying) stopPatternPlayback("Pattern stopped.");
    else startPatternPlayback();
  });

  patternUndo.addEventListener("click", () => {
    stopPatternPlayback();
    const removed = patternSteps.pop();
    patternStatus.textContent = removed
      ? `Removed ${removed.noteName} from the end of the pattern.`
      : "The pattern is already empty.";
    renderPattern();
  });

  patternClear.addEventListener("click", () => {
    stopPatternPlayback();
    patternSteps = [];
    patternStatus.textContent = "Fingerpicking pattern cleared.";
    renderPattern();
  });

  clearButton.addEventListener("click", () => {
    state.clearAll();
    renderInstrumentState();
    readoutLabel.textContent = "Ready";
    lastNote.textContent = "Shape cleared — open strings ready";
    noteOrb.textContent = "G";
  });

  volumeRange.addEventListener("input", () => {
    const volume = Number(volumeRange.value) / 100;
    state.setVolume(volume);
    audio.setVolume(volume);
    volumeRange.style.setProperty("--range-progress", `${volume * 100}%`);
  });
  volumeRange.style.setProperty("--range-progress", `${state.volume * 100}%`);

  muteButton.addEventListener("click", () => {
    state.setMuted(!state.muted);
    audio.setMuted(state.muted);
    muteButton.setAttribute("aria-pressed", String(state.muted));
    muteButton.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
    muteButton.classList.toggle("is-muted", state.muted);
    setAudioStatus(state.muted ? "muted" : "ready", state.muted ? "Muted" : "Sound ready");
  });

  fretboard.addEventListener("pointerdown", handleFretPointerDown);
  fretboard.addEventListener("pointermove", handleFretPointerMove);
  fretboard.addEventListener("pointerup", handleFretPointerEnd);
  fretboard.addEventListener("pointercancel", handleFretPointerEnd);
  fretboard.addEventListener("lostpointercapture", handleFretPointerEnd);
  fretboard.addEventListener("contextmenu", (event) => event.preventDefault());

  strumSurface.addEventListener("pointerdown", handleStrumPointerDown);
  strumSurface.addEventListener("pointermove", handleStrumPointerMove);
  strumSurface.addEventListener("pointerup", handleStrumPointerUp);
  strumSurface.addEventListener("pointercancel", handleStrumPointerCancel);
  strumSurface.addEventListener("lostpointercapture", handleStrumPointerCancel);
  strumSurface.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("blur", clearHeldPointers);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearHeldPointers();
      stopReferenceAudio();
      if (currentView === "coach") stopCoach();
      else if (currentView === "ai-coach") adaptiveCoach.leave();
      else stopTuner();
      stopLessonDemo();
      if (practiceActive && !practicePaused) pausePracticeSession();
    }
  });
  window.addEventListener("beforeunload", () => {
    stopReferenceAudio();
    audio.dispose();
    tuner.stop();
    adaptiveCoach.dispose();
    window.clearInterval(practiceTimer);
  });
}

async function initializeAudio({ focusInstrument = true }: { focusInstrument?: boolean } = {}): Promise<boolean> {
  if (audio.isReady) return true;
  enableButton.disabled = true;
  enableButton.classList.add("is-loading");
  enableButton.querySelector("span")!.textContent = "Loading instrument…";
  gateTitle.textContent = "Tuning the strings…";
  gateMessage.textContent = "Loading thirteen lossless notes into memory.";
  setAudioStatus("loading", "Loading samples");

  try {
    await audio.initialize();
    audio.setVolume(state.volume);
    document.body.dataset.audioReady = "true";
    instrumentFrame.dataset.audioReady = "true";
    audioGate.setAttribute("aria-hidden", "true");
    setAudioStatus("ready", "Sound ready");
    window.setTimeout(() => audioGate.classList.add("is-hidden"), 280);
    readoutLabel.textContent = "Ready";
    lastNote.textContent = "Open strings ready — give them a strum";
    noteOrb.textContent = "G";
    if (focusInstrument) strumSurface.focus({ preventScroll: true });
    renderLesson();
    renderPractice();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The samples could not be loaded.";
    enableButton.disabled = false;
    enableButton.classList.remove("is-loading");
    enableButton.querySelector("span")!.textContent = "Try again";
    gateTitle.textContent = "The strings did not load.";
    gateMessage.textContent = `${message} Check the local server and retry.`;
    setAudioStatus("error", "Audio error");
    return false;
  }
}

interface ReferenceEvent {
  atMs: number;
  label: string;
  play: () => void;
}

function currentTunerReferenceTarget() {
  if (tunerTarget) return TUNING_TARGETS.find((target) => target.id === tunerTarget) ?? TUNING_TARGETS[0];
  if (lastTunerReading) return targetPitch(lastTunerReading).target;
  return TUNING_TARGETS[0];
}

function currentPracticeChord(): ChordName | null {
  const stage = currentPracticeStage();
  if (stage.targetKind === "strings") return null;
  if (stage.targetKind === "rhythm") return "C";
  const targets = practiceChordTargets(stage);
  return targets[Math.min(practiceTargetIndex, targets.length - 1)];
}

function currentLessonGuidance() {
  const song = currentSong();
  const chapter = song.chapters[selectedChapterIndex];
  const lineIndex = lessonDemoPlaying
    ? Math.max(0, lessonDemoLineIndex)
    : lessonPhase === "complete"
      ? song.lines.length - 1
      : lessonLineIndex;
  const line = song.lines[lineIndex];
  const events = lessonPlaybackEvents(line, chapter, lessonPhase, lessonDemoPlaying);
  const chordIndex = lessonDemoPlaying ? Math.max(0, lessonDemoChordIndex) : lessonChordIndex;
  const chord = isMelodyChapter(chapter)
    ? chapter.backing ? line.chords[0] ?? null : null
    : line.chords[Math.min(chordIndex, line.chords.length - 1)] ?? null;
  const gestureIndex = lessonDemoPlaying
    ? Math.max(0, lessonDemoGestureIndex)
    : lessonPhase === "complete"
      ? events.length - 1
      : Math.min(lessonGestureIndex, events.length - 1);
  return { song, chapter, line, chord, gesture: events[gestureIndex], events };
}

async function ensureReferenceAudio(status: HTMLElement): Promise<boolean> {
  if (audio.isReady) return true;
  status.textContent = "Loading the sampled ukulele…";
  const ready = await initializeAudio({ focusInstrument: false });
  if (!ready) status.textContent = "Reference could not load. Check the local server and try again.";
  return ready;
}

function startReferenceSequence(
  playback: ReferencePlayback,
  events: readonly ReferenceEvent[],
  finishAtMs: number,
  suppress: "tuner" | "coach" | "practice" | "lesson" | null = null,
): void {
  stopReferenceAudio();
  referencePlayback = playback;
  referenceStep = -1;
  const now = performance.now();
  const suppressUntil = now + finishAtMs + 900;
  if (suppress === "tuner") tunerReferenceSuppressUntil = suppressUntil;
  if (suppress === "coach") coachReferenceSuppressUntil = suppressUntil;
  if (suppress === "practice") practiceReferenceSuppressUntil = suppressUntil;
  if (suppress === "lesson") lessonMicIgnoreUntil = suppressUntil;
  events.forEach((event, index) => {
    referenceTimers.push(window.setTimeout(() => {
      referenceStep = index;
      event.play();
      renderReferenceControls(event.label);
    }, event.atMs));
  });
  referenceTimers.push(window.setTimeout(finishReferenceAudio, finishAtMs));
  renderReferenceControls("Get ready…");
}

function finishReferenceAudio(): void {
  referenceTimers.forEach((timer) => window.clearTimeout(timer));
  referenceTimers = [];
  referencePlayback = null;
  referenceStep = -1;
  renderReferenceControls();
}

function stopReferenceAudio(): void {
  const wasPlaying = referencePlayback !== null;
  referenceTimers.forEach((timer) => window.clearTimeout(timer));
  referenceTimers = [];
  referencePlayback = null;
  referenceStep = -1;
  if (wasPlaying) {
    audio.stopAllVoices();
    const releaseAt = performance.now() + 140;
    tunerReferenceSuppressUntil = Math.min(tunerReferenceSuppressUntil, releaseAt);
    coachReferenceSuppressUntil = Math.min(coachReferenceSuppressUntil, releaseAt);
    practiceReferenceSuppressUntil = Math.min(practiceReferenceSuppressUntil, releaseAt);
    lessonMicIgnoreUntil = Math.min(lessonMicIgnoreUntil, releaseAt);
  }
  renderReferenceControls();
}

async function playTunerReference(): Promise<void> {
  if (referencePlayback === "tuner-target") {
    stopReferenceAudio();
    return;
  }
  if (!(await ensureReferenceAudio(tunerReferenceNote))) return;
  const target = currentTunerReferenceTarget();
  startReferenceSequence("tuner-target", [{
    atMs: 0,
    label: `Playing ${target.label} · listen, then copy it`,
    play: () => {
      audio.pluckString(target.stringIndex, target.midi, 0.68);
      showStringFeedback(target.stringIndex);
    },
  }], 1350, "tuner");
}

async function playCoachReference(): Promise<void> {
  if (referencePlayback === "coach-target") {
    stopReferenceAudio();
    return;
  }
  if (!(await ensureReferenceAudio(coachReferenceStatus))) return;
  if (coachDrill === "strings") {
    const target = TUNING_TARGETS[Math.min(coachTargetIndex, TUNING_TARGETS.length - 1)];
    startReferenceSequence("coach-target", [{
      atMs: 0,
      label: `Playing ${target.label} · wait for it to fade, then copy it`,
      play: () => {
        audio.pluckString(target.stringIndex, target.midi, 0.68);
        showStringFeedback(target.stringIndex);
      },
    }], 1350, practiceInput === "real" ? "coach" : null);
    return;
  }
  const beatMs = 60_000 / 72;
  const midis = chordMidiNotes("C");
  startReferenceSequence(
    "coach-target",
    Array.from({ length: 4 }, (_, index) => ({
      atMs: index * beatMs,
      label: `Beat ${index + 1} of 4 · 72 BPM preview`,
      play: () => {
        audio.strum(midis, "down", 0.54);
        showReferenceStrings("down");
      },
    })),
    4 * beatMs,
    practiceInput === "real" ? "coach" : null,
  );
}

async function playPracticeReference(kind: "target" | "bar"): Promise<void> {
  const playback: ReferencePlayback = kind === "target" ? "practice-target" : "practice-bar";
  if (referencePlayback === playback) {
    stopReferenceAudio();
    return;
  }
  if (!(await ensureReferenceAudio(practiceReferenceStatus))) return;
  const stage = currentPracticeStage();
  const suppress = practiceInput === "real" ? "practice" : null;
  if (kind === "target") {
    if (stage.targetKind === "strings") {
      const stringIndex = stage.stringTargets![Math.min(practiceTargetIndex, stage.stringTargets!.length - 1)];
      const position = getFretPosition(stringIndex, 0);
      startReferenceSequence(playback, [{
        atMs: 0,
        label: `Playing ${position.noteName} · string ${physicalStringNumber(stringIndex)}`,
        play: () => {
          audio.pluckString(stringIndex, position.midi, 0.68);
          showStringFeedback(stringIndex);
        },
      }], 1350, suppress);
      return;
    }
    const chord = currentPracticeChord()!;
    startReferenceSequence(playback, [{
      atMs: 0,
      label: `Playing ${chord} · ${chordNoteNames(chord).join(" · ")}`,
      play: () => {
        audio.playTogether(chordMidiNotes(chord), 0.62);
        showReferenceStrings();
      },
    }], 1450, suppress);
    return;
  }

  const beatMs = 60_000 / (practiceTempo * referenceSpeed);
  if (stage.targetKind === "strings") {
    const sequence = [0, 1, 2, 3];
    startReferenceSequence(playback, sequence.map((stringIndex, index) => ({
      atMs: index * beatMs,
      label: `${index + 1} of 4 · string ${physicalStringNumber(stringIndex)} · ${UKULELE_STRINGS[stringIndex].label}`,
      play: () => {
        audio.pluckString(stringIndex, UKULELE_STRINGS[stringIndex].openMidi, 0.64);
        showStringFeedback(stringIndex);
      },
    })), 4 * beatMs, suppress);
    return;
  }
  const chord = currentPracticeChord()!;
  const midis = chordMidiNotes(chord);
  startReferenceSequence(playback, Array.from({ length: 4 }, (_, index) => ({
    atMs: index * beatMs,
    label: `Beat ${index + 1} of 4 · ${chord} · down-strum`,
    play: () => {
      audio.strum(midis, "down", 0.56);
      showReferenceStrings("down");
    },
  })), 4 * beatMs, suppress);
}

async function playLessonReference(kind: "chord" | "bar"): Promise<void> {
  if (!canPracticeLessonSong(currentSong())) return;
  const playback: ReferencePlayback = kind === "chord" ? "lesson-chord" : "lesson-bar";
  if (referencePlayback === playback) {
    stopReferenceAudio();
    return;
  }
  if (!(await ensureReferenceAudio(lessonReferenceStatus))) return;
  if (!canPracticeLessonSong(currentSong())) return;
  const { chapter, line, chord, gesture, events } = currentLessonGuidance();
  const melody = isMelodyChapter(chapter);
  if (kind === "chord") {
    if (melody && gesture.kind === "pluck") {
      const position = getFretPosition(gesture.stringIndex, gesture.fret ?? 0);
      startReferenceSequence(playback, [{
        atMs: 0,
        label: `Playing ${gesture.solfege ? `${gesture.solfege} · ` : ""}${position.noteName} · ${physicalStringNumber(gesture.stringIndex)},${gesture.fret ?? 0}`,
        play: () => {
          audio.pluckString(gesture.stringIndex, position.midi, 0.66);
          showStringFeedback(gesture.stringIndex);
        },
      }], 1350, lessonInput === "real" ? "lesson" : null);
      return;
    }
    const resolvedChord = chord!;
    const midis = chordMidiNotes(resolvedChord);
    startReferenceSequence(playback, [{
      atMs: 0,
      label: `Playing ${resolvedChord} · ${chordNoteNames(resolvedChord).join(" · ")}`,
      play: () => {
        audio.playTogether(midis, 0.62);
        showReferenceStrings();
      },
    }], 1450, lessonInput === "real" ? "lesson" : null);
    return;
  }
  const beatMs = 60_000 / (chapter.bpm * referenceSpeed);
  const referenceEvents: ReferenceEvent[] = [];
  if (melody && chapter.backing) {
    lessonBackingChordEvents(line, chapter).forEach(({ chord: backingChord, beat }) => {
      referenceEvents.push({
        atMs: beat * beatMs,
        label: `Backing ${backingChord} · phrase pulse`,
        play: () => {
          audio.playTogether(chordMidiNotes(backingChord), 0.32);
          showReferenceStrings();
        },
      });
    });
  }
  const resolvedMidis = chord ? chordMidiNotes(chord) : null;
  events.forEach((event, index) => {
    referenceEvents.push({
      atMs: event.beat * beatMs,
      label: `Move ${index + 1} of ${events.length} · ${lessonGestureVisual(event)}`,
      play: () => {
        if (event.kind === "strum") {
          audio.strum(resolvedMidis!, event.direction, 0.56);
          showReferenceStrings(event.direction);
        } else {
          const fret = melody ? event.fret ?? 0 : LESSON_CHORDS[chord!].frets[event.stringIndex];
          const position = getFretPosition(event.stringIndex, fret);
          audio.pluckString(event.stringIndex, position.midi, 0.62);
          showStringFeedback(event.stringIndex);
        }
      },
    });
  });
  referenceEvents.sort((a, b) => a.atMs - b.atMs);
  const finishBeats = melody ? lessonLineBeats(line, chapter) : currentSong().beatsPerBar;
  startReferenceSequence(playback, referenceEvents, finishBeats * beatMs, lessonInput === "real" ? "lesson" : null);
}

function showReferenceStrings(direction?: StrumDirection): void {
  const indices = direction === "up" ? [3, 2, 1, 0] : [0, 1, 2, 3];
  indices.forEach((stringIndex, order) => window.setTimeout(() => showStringFeedback(stringIndex), direction ? order * 24 : 0));
  showRipple();
}

function setReferenceButton(button: HTMLButtonElement, playback: ReferencePlayback, idleLabel: string): void {
  const active = referencePlayback === playback;
  button.classList.toggle("is-playing", active);
  button.setAttribute("aria-pressed", String(active));
  button.querySelector("span")!.textContent = active ? "Stop reference" : idleLabel;
}

function renderReferenceControls(activeLabel?: string): void {
  document.querySelectorAll<HTMLButtonElement>("[data-reference-speed]").forEach((button) => {
    const selected = Number(button.dataset.referenceSpeed) === referenceSpeed;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  renderTunerReference(activeLabel);
  renderCoachGuidance(activeLabel);
  renderPracticeGuidance(activeLabel);
  renderLessonGuidance(activeLabel);

  coachBeats.querySelectorAll("span").forEach((beat, index) => {
    beat.classList.toggle("is-reference-current", referencePlayback === "coach-target" && coachDrill === "pulse" && index === referenceStep);
  });
  lessonGestureRail.querySelectorAll("span").forEach((step, index) => {
    step.classList.toggle("is-reference-current", referencePlayback === "lesson-bar" && index === referenceStep);
  });
}

function renderTunerReference(activeLabel?: string): void {
  const target = currentTunerReferenceTarget();
  setReferenceButton(tunerHearTarget, "tuner-target", `Hear ${target.label} reference`);
  tunerReferenceNote.textContent = referencePlayback === "tuner-target"
    ? activeLabel ?? `Playing ${target.label}…`
    : "Listen first, then pluck. Reference audio is ignored by the tuner.";
}

function renderCoachGuidance(activeLabel?: string): void {
  const complete = coachDrill === "strings" && coachTargetIndex >= TUNING_TARGETS.length;
  if (coachDrill === "strings") {
    const target = TUNING_TARGETS[Math.min(coachTargetIndex, TUNING_TARGETS.length - 1)];
    coachLayerTarget.textContent = complete ? "GCEA complete" : `Open ${target.label}`;
    coachLayerNotes.textContent = complete
      ? "G4 · C4 · E4 · A4"
      : `String ${physicalStringNumber(target.stringIndex)} · ${target.frequency.toFixed(1)} Hz`;
    const hint = stringHint(target.stringIndex);
    const grade = coachLive.dataset.grade as CoachPitchGrade;
    coachLayerHint.textContent = complete
      ? "All four open strings are balanced."
      : grade === "flat"
        ? `Tighten ${target.id} a tiny amount.`
        : grade === "sharp"
          ? `Loosen ${target.id} a tiny amount.`
          : grade === "wrong-note"
            ? `Find string ${physicalStringNumber(target.stringIndex)} · ${target.id}.`
            : hint.primary;
    coachLayerHintDetail.textContent = complete
      ? "Repeat the set and aim for the same relaxed attack."
      : grade === "correct"
        ? "Pluck once and let it ring. The rail confirms the pitch automatically."
        : hint.secondary;
    setReferenceButton(coachHearTarget, "coach-target", `Hear ${target.label}`);
    coachHearTarget.disabled = complete;
  } else {
    coachLayerTarget.textContent = coachPulseHits >= 8 ? "Eight strums complete" : `↓ Beat ${coachPulseHits + 1} of 8`;
    coachLayerNotes.textContent = `C chord · 72 BPM · ${chordNoteNames("C").join(" · ")}`;
    coachLayerHint.textContent = "Let your wrist travel the same distance every beat.";
    coachLayerHintDetail.textContent = coachPulseHits === 0
      ? "Your first down-strum starts the pulse. Keep counting 1–2–3–4."
      : coachLive.dataset.grade === "early"
        ? "Give the next beat a little more room."
        : coachLive.dataset.grade === "late"
          ? "Let the wrist return a little sooner."
          : "Stay loose and repeat that spacing.";
    setReferenceButton(coachHearTarget, "coach-target", "Hear 4-beat pulse");
    coachHearTarget.disabled = coachPulseHits >= 8;
  }
  coachReferenceStatus.textContent = referencePlayback === "coach-target"
    ? activeLabel ?? "Reference playing · wait, then copy it"
    : practiceInput === "real"
      ? "Reference is muted from microphone scoring."
      : "Reference is never counted as your move.";
}

function renderPracticeGuidance(activeLabel?: string): void {
  const stage = currentPracticeStage();
  const complete = practiceStageMastered;
  practiceHearTarget.disabled = complete;
  practiceHearBar.disabled = complete;
  if (stage.targetKind === "strings") {
    const stringIndex = stage.stringTargets![Math.min(practiceTargetIndex, stage.stringTargets!.length - 1)];
    const position = getFretPosition(stringIndex, 0);
    const hint = stringHint(stringIndex);
    practiceLayerTarget.textContent = complete ? "Stage complete" : `${physicalStringNumber(stringIndex)} · ${position.noteName}`;
    practiceLayerNotes.textContent = complete ? "G4 · C4 · E4 · A4" : `Open ${position.stringId} string · ${TUNING_TARGETS[stringIndex].frequency.toFixed(1)} Hz`;
    practiceLayerHint.textContent = complete ? "Repeat the sequence once without rushing." : hint.primary;
    practiceLayerHintDetail.textContent = complete ? "Move on when all four attacks feel equally clear." : hint.secondary;
    setReferenceButton(practiceHearTarget, "practice-target", `Hear ${position.noteName}`);
    setReferenceButton(practiceHearBar, "practice-bar", "Hear GCEA sequence");
  } else {
    const chord = currentPracticeChord()!;
    const hint = chordHint(chord);
    practiceLayerTarget.textContent = complete
      ? "Stage complete"
      : stage.targetKind === "rhythm"
        ? `${chord} · ↓ beat ${practiceTargetIndex + 1}`
        : `${chord} chord`;
    practiceLayerNotes.textContent = `${chordFretLabel(chord)} · ${chordNoteNames(chord).join(" · ")}`;
    practiceLayerHint.textContent = complete
      ? "Keep the same relaxed shape for one final repetition."
      : stage.targetKind === "rhythm"
        ? "Keep your wrist moving through every four-count."
        : hint.primary;
    practiceLayerHintDetail.textContent = complete
      ? "Continue when the sound and movement both feel repeatable."
      : stage.targetKind === "rhythm"
        ? `Count 1–2–3–4 at ${practiceTempo} BPM; the down-strum lands on each number.`
        : hint.secondary;
    setReferenceButton(practiceHearTarget, "practice-target", `Hear ${chord} chord`);
    setReferenceButton(practiceHearBar, "practice-bar", "Hear one bar");
  }
  practiceReferenceStatus.textContent = referencePlayback === "practice-target" || referencePlayback === "practice-bar"
    ? activeLabel ?? "Reference playing · watch and listen"
    : practiceInput === "real"
      ? "Reference is ignored by microphone scoring."
      : "Tap a reference, then copy it on the ukulele below.";
}

function renderLessonGuidance(activeLabel?: string): void {
  const { chapter, chord, gesture } = currentLessonGuidance();
  if (isMelodyChapter(chapter) && gesture.kind === "pluck") {
    const fret = gesture.fret ?? 0;
    const position = getFretPosition(gesture.stringIndex, fret);
    const notation = `${physicalStringNumber(gesture.stringIndex)},${fret}`;
    lessonLayerTarget.textContent = `${gesture.solfege ? `${gesture.solfege} · ` : ""}${position.noteName}`;
    lessonLayerNotes.textContent = `${notation} · string ${physicalStringNumber(gesture.stringIndex)} ${position.stringId} · fret ${fret === 0 ? "open" : fret}`;
    lessonLayerHint.textContent = fret === 0
      ? `Pick string ${physicalStringNumber(gesture.stringIndex)} open.`
      : `Hold fret ${fret} on string ${physicalStringNumber(gesture.stringIndex)}.`;
    lessonLayerHintDetail.textContent = gesture.quick
      ? "Quick move: place the next note halfway between the main beats."
      : `Let ${position.noteName} ring clearly, then move only when the next cue lights up.`;
    setReferenceButton(lessonHearChord, "lesson-chord", `Hear ${gesture.solfege ?? position.noteName}`);
    setReferenceButton(lessonHearBar, "lesson-bar", "Hear this phrase");
  } else {
    const resolvedChord = chord!;
    const hint = gestureHint(gesture, resolvedChord);
    lessonLayerTarget.textContent = `${resolvedChord} chord · ${lessonGestureMark(gesture)}`;
    lessonLayerNotes.textContent = `${chordFretLabel(resolvedChord)} · ${chordNoteNames(resolvedChord).join(" · ")}`;
    lessonLayerHint.textContent = hint.primary;
    lessonLayerHintDetail.textContent = hint.secondary;
    setReferenceButton(lessonHearChord, "lesson-chord", `Hear ${resolvedChord} chord`);
    setReferenceButton(lessonHearBar, "lesson-bar", "Hear one bar");
  }
  const referenceAllowed = canPracticeLessonSong(currentSong());
  lessonHearChord.disabled = lessonDemoPlaying || !referenceAllowed;
  lessonHearBar.disabled = lessonDemoPlaying || !referenceAllowed;
  lessonReferenceStatus.textContent = referencePlayback === "lesson-chord" || referencePlayback === "lesson-bar"
    ? activeLabel ?? "Reference playing · follow the highlighted move"
    : `Preview at ${Math.round(referenceSpeed * 100)}% · audio starts only when you ask.`;
}

function setView(view: AppView): void {
  stopPatternPlayback();
  stopLessonDemo();
  stopReferenceAudio();
  stopLessonTakePlayback();
  if (lessonTakeRecording && view !== "chapters") finishLessonTakeRecording();
  if (currentView === "coach" && view !== "coach") stopCoach();
  if (currentView === "ai-coach" && view !== "ai-coach") adaptiveCoach.leave();
  if (currentView === "tuner" && view !== "tuner") stopTuner();
  if (currentView === "chapters" && view !== "chapters" && lessonInput === "real") stopLessonMicrophone();
  if (currentView === "practice" && view !== "practice" && practiceActive && !practicePaused) pausePracticeSession();
  if (focusMode && view !== "strum" && view !== "explore") setFocusMode(false);
  currentView = view;
  if (view === "strum" || view === "explore") lastPlayView = view;
  if (view === "practice" || view === "chapters" || view === "coach") lastPracticeView = view;
  document.body.dataset.appView = view;
  const instrumentMode: PlayMode = view === "explore" ? "explore" : "strum";
  state.setMode(instrumentMode);
  activeFretPointers.clear();
  const playView = view === "strum" || view === "explore";
  const practiceView = view === "practice" || view === "chapters" || view === "coach";
  const primaryButtons: Array<[HTMLButtonElement, boolean]> = [
    [navPlay, playView],
    [navPractice, practiceView],
    [modeAiCoach, view === "ai-coach"],
    [modeTuner, view === "tuner"],
  ];
  primaryButtons.forEach(([button, selected]) => {
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const secondaryButtons: Array<[HTMLButtonElement, AppView]> = [
    [modeStrum, "strum"],
    [modeExplore, "explore"],
    [modePractice, "practice"],
    [modeChapters, "chapters"],
    [modeCoach, "coach"],
  ];
  secondaryButtons.forEach(([button, value]) => {
    button.classList.toggle("is-selected", value === view);
    button.setAttribute("aria-pressed", String(value === view));
  });
  const viewCopy: Record<AppView, { eyebrow: string; title: string; guidance: string }> = {
    strum: {
      eyebrow: "Play · Standard GCEA",
      title: "Play the strings.",
      guidance: "Set a shape, tap for a chord, or sweep for a natural strum.",
    },
    explore: {
      eyebrow: "Play · Fingerpicking",
      title: "Build a phrase, note by note.",
      guidance: "Preview any fret, then collect up to 30 notes into a pattern.",
    },
    tuner: {
      eyebrow: "Tune · Real ukulele",
      title: "Bring every string home.",
      guidance: "Listen to one open string at a time and adjust it toward centre.",
    },
    coach: {
      eyebrow: "Practice · Quick drills",
      title: "Play it. See what landed.",
      guidance: "Get immediate feedback on open-string clarity or a steady pulse.",
    },
    "ai-coach": {
      eyebrow: "AI Coach · Rhythm lab",
      title: "Hear what changed.",
      guidance: "Play a short pattern, fix one moment, then compare your next take.",
    },
    practice: {
      eyebrow: "Practice · Guided session",
      title: "Your next ten minutes.",
      guidance: "Follow one focused path; the working tempo adapts as you play.",
    },
    chapters: {
      eyebrow: "Practice · Songs",
      title: "Learn it one line at a time.",
      guidance: "Hear the example, play one part, then connect the full passage.",
    },
  };
  viewEyebrow.textContent = viewCopy[view].eyebrow;
  instrumentTitle.textContent = viewCopy[view].title;
  modeGuidance.textContent = viewCopy[view].guidance;
  playSubnav.hidden = !playView;
  practiceSubnav.hidden = !practiceView;
  playSubnavNote.textContent = view === "explore"
    ? "Tap to preview. Turn on Add notes to build the sequence."
    : handLayout === "one"
      ? "Tap frets to latch a shape, then play the body."
      : "Hold the neck with one hand and play the body with the other.";
  instrumentFrame.dataset.mode = instrumentMode;
  instrumentFrame.dataset.view = view;
  patternBuilder.hidden = view !== "explore";
  tunerWorkbench.hidden = view !== "tuner";
  coachWorkbench.hidden = view !== "coach";
  aiCoachWorkbench.hidden = view !== "ai-coach";
  practiceWorkbench.hidden = view !== "practice";
  lessonWorkbench.hidden = view !== "chapters";
  instrumentSourceChoice.hidden = view !== "practice" && view !== "coach";
  instrumentFrame.hidden = view === "tuner" || view === "ai-coach" || (view === "coach" && practiceInput === "real");
  performanceReadout.hidden = view === "tuner" || view === "ai-coach" || (view === "coach" && practiceInput === "real");
  clearButton.hidden = view === "tuner" || view === "ai-coach" || (view === "coach" && practiceInput === "real");
  if (view !== "explore") patternArmed = false;
  if (view === "chapters") renderLesson();
  if (view === "coach") renderCoach();
  if (view === "practice") renderPractice();
  if (view === "ai-coach") adaptiveCoach.enter();
  renderInstrumentSource();
  updateInputHint();
  renderPattern();
  renderInstrumentState();
}

function setHandLayout(layout: HandLayout): void {
  handLayout = layout;
  storePreference("four-strings-hand-layout", layout);
  state.clearHeldFrets();
  activeFretPointers.clear();
  renderHandLayout();
  renderInstrumentState();
  updateInputHint();
}

function renderHandLayout(): void {
  document.body.dataset.handLayout = handLayout;
  const oneHand = handLayout === "one";
  layoutOneHand.classList.toggle("is-selected", oneHand);
  layoutOneHand.setAttribute("aria-pressed", String(oneHand));
  layoutTwoHands.classList.toggle("is-selected", !oneHand);
  layoutTwoHands.setAttribute("aria-pressed", String(!oneHand));
  playSubnavNote.textContent = currentView === "explore"
    ? "Tap to preview. Turn on Add notes to build the sequence."
    : oneHand
      ? "Tap frets to latch a shape, then play the body."
      : "Hold the neck with one hand and play the body with the other.";
}

function setFocusMode(enabled: boolean): void {
  focusMode = enabled;
  document.body.classList.toggle("is-focus-mode", enabled);
  focusModeButton.classList.toggle("is-selected", enabled);
  focusModeButton.setAttribute("aria-pressed", String(enabled));
  focusModeButton.setAttribute("aria-label", enabled ? "Exit focus view" : "Enter focus view");
  focusModeButton.querySelector("span")!.textContent = enabled ? "Exit focus" : "Focus view";
  if (enabled) instrumentFrame.scrollIntoView({ block: "center" });
}

function handleFretPointerDown(event: PointerEvent): void {
  if (!audio.isReady) return;
  const cell = getFretCell(event.target);
  if (!cell) return;
  event.preventDefault();
  const position = cellPosition(cell);
  state.focusedCell = position;
  cell.focus({ preventScroll: true });

  if (event.pointerType === "mouse" || handLayout === "one") {
    if (state.mode === "strum") {
      state.toggleLatchedFret(position.stringIndex, position.fret);
    } else {
      playPosition(position.stringIndex, position.fret, 0.7);
    }
  } else {
    state.holdFret(event.pointerId, position.stringIndex, position.fret);
    activeFretPointers.set(event.pointerId, cell.dataset.key!);
    tryCapturePointer(fretboard, event.pointerId);
    if (state.mode === "explore") {
      playPosition(position.stringIndex, position.fret, velocityFromGesture(0, 0, event.pressure));
    }
  }
  renderInstrumentState();
}

function handleFretPointerMove(event: PointerEvent): void {
  if (event.pointerType === "mouse" || handLayout === "one" || !activeFretPointers.has(event.pointerId)) return;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const cell = getFretCell(hit);
  if (!cell || cell.dataset.key === activeFretPointers.get(event.pointerId)) return;

  const position = cellPosition(cell);
  activeFretPointers.set(event.pointerId, cell.dataset.key!);
  state.holdFret(event.pointerId, position.stringIndex, position.fret);
  if (state.mode === "explore") {
    playPosition(position.stringIndex, position.fret, velocityFromGesture(0, 0, event.pressure));
  }
  renderInstrumentState();
}

function handleFretPointerEnd(event: PointerEvent): void {
  if (!activeFretPointers.has(event.pointerId) && !state.heldFrets.has(event.pointerId)) return;
  activeFretPointers.delete(event.pointerId);
  state.releasePointer(event.pointerId);
  renderInstrumentState();
}

function handleStrumPointerDown(event: PointerEvent): void {
  if (!audio.isReady) return;
  event.preventDefault();
  tryCapturePointer(strumSurface, event.pointerId);
  const stringIndex = stringIndexFromClientY(event.clientY);
  strumPointers.set(event.pointerId, {
    stringIndex,
    y: event.clientY,
    time: event.timeStamp,
    pressure: event.pressure,
    hasStrummed: false,
    sounded: new Set<number>(),
    direction: null,
    lessonChecked: false,
  });
}

function handleStrumPointerMove(event: PointerEvent): void {
  const trace = strumPointers.get(event.pointerId);
  if (!trace) return;
  event.preventDefault();
  const nextIndex = stringIndexFromClientY(event.clientY);
  if (nextIndex === trace.stringIndex) return;

  const velocity = velocityFromGesture(
    Math.abs(event.clientY - trace.y),
    Math.max(1, event.timeStamp - trace.time),
    event.pressure,
  );
  const direction: StrumDirection = nextIndex > trace.stringIndex ? "down" : "up";
  const crossed = getCrossedStringIndices(trace.stringIndex, nextIndex);
  const playedIndices = trace.hasStrummed ? crossed : [trace.stringIndex, ...crossed];
  playSweepStrings(playedIndices, velocity);
  playedIndices.forEach((stringIndex) => trace.sounded.add(stringIndex));
  trace.hasStrummed = true;
  trace.direction = direction;
  trace.stringIndex = nextIndex;
  trace.y = event.clientY;
  trace.time = event.timeStamp;
  showShapeReadout("Last strum", direction === "down" ? "↓" : "↑", [...trace.sounded]);
  if (trace.sounded.size === UKULELE_STRINGS.length && !trace.lessonChecked) {
    trace.lessonChecked = true;
    handleLessonGesture({ kind: "strum", direction, beat: 0 });
    handlePracticeGesture({ kind: "strum", direction }, performance.now());
    handleCoachScreenGesture({ kind: "strum", direction }, performance.now());
  }
}

function handleStrumPointerUp(event: PointerEvent): void {
  const trace = strumPointers.get(event.pointerId);
  strumPointers.delete(event.pointerId);
  if (!trace || trace.hasStrummed) return;
  const pressure = Math.max(trace.pressure, event.pressure);
  const velocity = pressure > 0 ? velocityFromGesture(0, 0, pressure) : 0.72;
  if (
    (currentView === "chapters" && currentLessonGuidance().gesture.kind === "pluck") ||
    (currentView === "practice" && currentPracticeStage().targetKind === "strings")
  ) {
    playString(trace.stringIndex, velocity);
  } else {
    playChordTogether(velocity);
  }
}

function handleStrumPointerCancel(event: PointerEvent): void {
  strumPointers.delete(event.pointerId);
}

function handleKeyboard(event: KeyboardEvent): void {
  if (
    event.key === "/" &&
    currentView === "chapters" &&
    songSearch.getClientRects().length > 0 &&
    !isFormControl(event.target)
  ) {
    event.preventDefault();
    songSearch.focus();
    return;
  }
  if (event.key === "Escape" && focusMode) {
    event.preventDefault();
    setFocusMode(false);
    return;
  }
  if (currentView === "chapters" && lessonInput === "real") return;
  if (!audio.isReady) return;
  if (event.target instanceof Element && event.target.closest("select")) return;

  if (/^[1-4]$/.test(event.key) && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    playString(UKULELE_STRINGS.length - Number(event.key), 0.72);
    return;
  }

  if (isFormControl(event.target)) return;

  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    const next = state.moveFocus(
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0,
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0,
    );
    focusFretCell(next.stringIndex, next.fret);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const { stringIndex, fret } = state.focusedCell;
    if (state.mode === "strum") state.toggleLatchedFret(stringIndex, fret);
    else playPosition(stringIndex, fret, 0.7);
    renderInstrumentState();
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    if (event.shiftKey) strumAll("up");
    else playChordTogether();
    return;
  }

  if (event.key === "Escape") {
    state.clearAll();
    renderInstrumentState();
    readoutLabel.textContent = "Ready";
    lastNote.textContent = "Shape cleared — open strings ready";
  }
}

function playPosition(stringIndex: number, fret: number, velocity: number, record = true): void {
  const position = getFretPosition(stringIndex, fret);
  audio.pluckString(stringIndex, position.midi, velocity);
  if (record) recordPatternStep(position);
  const cell = fretButtons.get(cellKey(stringIndex, fret));
  if (cell) {
    cell.classList.remove("is-previewing");
    void cell.offsetWidth;
    cell.classList.add("is-previewing");
    window.setTimeout(() => cell.classList.remove("is-previewing"), 260);
  }
  showPluck(stringIndex, position.noteName, fret);
}

function playString(stringIndex: number, velocity: number): void {
  const fret = state.getEffectiveFret(stringIndex);
  const position = getFretPosition(stringIndex, fret);
  audio.pluckString(stringIndex, position.midi, velocity);
  captureLessonTakeNote(stringIndex, fret, velocity);
  showPluck(stringIndex, position.noteName, fret);
  handleLessonGesture({ kind: "pluck", stringIndex, beat: 0 });
  handlePracticeGesture({ kind: "pluck", stringIndex }, performance.now());
  handleCoachScreenGesture({ kind: "pluck", stringIndex }, performance.now());
}

function strumAll(direction: StrumDirection): void {
  const indices = direction === "down" ? [0, 1, 2, 3] : [3, 2, 1, 0];
  const positions = getCurrentShape();
  audio.strum(positions.map((position) => position.midi), direction, 0.74);
  indices.forEach((stringIndex, order) => captureLessonTakeNote(stringIndex, positions[stringIndex].fret, 0.74, order * 24));
  indices.forEach((stringIndex, order) => {
    window.setTimeout(() => showStringFeedback(stringIndex), order * 24);
  });
  showShapeReadout("Last strum", direction === "down" ? "↓" : "↑", indices);
  handleLessonGesture({ kind: "strum", direction, beat: 0 });
  handlePracticeGesture({ kind: "strum", direction }, performance.now());
  handleCoachScreenGesture({ kind: "strum", direction }, performance.now());
}

function playChordTogether(velocity = 0.72): void {
  const positions = getCurrentShape();
  audio.playTogether(positions.map((position) => position.midi), velocity);
  positions.forEach((position) => captureLessonTakeNote(position.stringIndex, position.fret, velocity));
  positions.forEach((position) => showStringFeedback(position.stringIndex));
  showShapeReadout("Last chord", "4", positions.map((position) => position.stringIndex));
  handleLessonGesture({ kind: "strum", direction: "down", beat: 0 });
  handlePracticeGesture({ kind: "strum", direction: "down" }, performance.now());
  handleCoachScreenGesture({ kind: "strum", direction: "down" }, performance.now());
}

function playSweepStrings(indices: readonly number[], velocity: number): void {
  indices.forEach((stringIndex, order) => {
    const fret = state.getEffectiveFret(stringIndex);
    const position = getFretPosition(stringIndex, fret);
    audio.pluckString(stringIndex, position.midi, velocity, order * 0.012);
    captureLessonTakeNote(stringIndex, fret, velocity, order * 12);
    window.setTimeout(() => showStringFeedback(stringIndex), order * 12);
  });
}

function getCurrentShape(): FretPosition[] {
  return UKULELE_STRINGS.map((_, stringIndex) =>
    getFretPosition(stringIndex, state.getEffectiveFret(stringIndex)),
  );
}

function showPluck(stringIndex: number, noteName: string, fret: number): void {
  const pitch = noteName.replace(/\d+$/, "");
  readoutLabel.textContent = "Last pluck";
  noteOrb.textContent = pitch;
  lastNote.textContent = `${noteName} · ${UKULELE_STRINGS[stringIndex].id} string · ${fret === 0 ? "open" : `fret ${fret}`}`;

  showStringFeedback(stringIndex);
  showRipple();
}

function showShapeReadout(label: string, orb: string, indices: readonly number[]): void {
  const canonicalIndices = [...new Set(indices)].sort((a, b) => a - b);
  const positions = canonicalIndices.map((stringIndex) =>
    getFretPosition(stringIndex, state.getEffectiveFret(stringIndex)),
  );
  readoutLabel.textContent = label;
  noteOrb.textContent = orb;
  lastNote.textContent =
    canonicalIndices.length === UKULELE_STRINGS.length
      ? `Frets ${positions.map((position) => position.fret).join("–")} · ${positions.map((position) => position.noteName).join(" · ")}`
      : `${positions.map((position) => `${physicalStringNumber(position.stringIndex)}·${position.stringId}`).join(" · ")} · ${positions.map((position) => position.noteName).join(" · ")}`;
  showRipple();
}

function showStringFeedback(stringIndex: number): void {
  document.querySelectorAll<HTMLElement>(`.instrument-string[data-string="${stringIndex}"]`).forEach((string) => {
    string.classList.remove("is-ringing");
    void string.offsetWidth;
    string.classList.add("is-ringing");
  });
}

function showRipple(): void {
  ripple.classList.remove("is-active");
  void ripple.offsetWidth;
  ripple.classList.add("is-active");
}

function renderInstrumentState(): void {
  const patternCounts = getPatternCounts();
  for (const [key, button] of fretButtons) {
    const position = cellPosition(button);
    const latched = position.fret > 0 && state.latchedFrets[position.stringIndex] === position.fret;
    const held = [...state.heldFrets.values()].some(
      (value) => value.stringIndex === position.stringIndex && value.fret === position.fret,
    );
    const effective = state.getEffectiveFret(position.stringIndex) === position.fret;
    const learningTarget = isLearningFretTarget(position.stringIndex, position.fret);
    button.classList.toggle("is-latched", latched);
    button.classList.toggle("is-held", held);
    button.classList.toggle("is-effective", effective);
    button.classList.toggle("is-learning-target", learningTarget);
    const selectedCount = patternCounts.get(key) ?? 0;
    button.classList.toggle("is-sequenced", selectedCount > 0);
    button.classList.toggle(
      "is-pattern-current",
      currentPatternIndex >= 0 && cellKey(patternSteps[currentPatternIndex].stringIndex, patternSteps[currentPatternIndex].fret) === key,
    );
    button.setAttribute("aria-pressed", String(latched || held));
    button.setAttribute(
      "aria-label",
      `${button.dataset.baseLabel}${learningTarget ? ", current learning target" : ""}${selectedCount > 0 ? `, selected ${selectedCount} ${selectedCount === 1 ? "time" : "times"} in pattern` : ""}`,
    );
    const badge = button.querySelector<HTMLElement>(".sequence-badge");
    if (badge) badge.textContent = selectedCount > 1 ? `×${selectedCount}` : selectedCount === 1 ? "1" : "";
    button.dataset.key = key;
  }
  const targetString = currentLearningStringTarget();
  document.querySelectorAll<HTMLElement>(".instrument-string, .body-string-name").forEach((element) => {
    element.classList.toggle("is-learning-target", Number(element.dataset.string) === targetString);
  });
}

function isLearningFretTarget(stringIndex: number, fret: number): boolean {
  if (currentView === "practice" && practiceInput === "screen" && !practiceStageMastered) {
    const stage = currentPracticeStage();
    if (stage.targetKind === "strings") {
      return stringIndex === stage.stringTargets![practiceTargetIndex] && fret === 0;
    }
    const chord = currentPracticeChord();
    return chord !== null && LESSON_CHORDS[chord].frets[stringIndex] === fret;
  }
  if (currentView === "chapters" && lessonPhase !== "complete") {
    const { chapter, chord, gesture } = currentLessonGuidance();
    if (isMelodyChapter(chapter) && gesture.kind === "pluck") {
      return gesture.stringIndex === stringIndex && (gesture.fret ?? 0) === fret;
    }
    return chord !== null && LESSON_CHORDS[chord].frets[stringIndex] === fret;
  }
  return false;
}

function currentLearningStringTarget(): number {
  if (currentView === "practice" && practiceInput === "screen" && !practiceStageMastered) {
    const stage = currentPracticeStage();
    return stage.targetKind === "strings" ? stage.stringTargets![practiceTargetIndex] : -1;
  }
  if (currentView === "chapters" && lessonPhase !== "complete") {
    const { gesture } = currentLessonGuidance();
    return gesture.kind === "pluck" ? gesture.stringIndex : -1;
  }
  return -1;
}

function recordPatternStep(position: FretPosition): void {
  if (!patternArmed || state.mode !== "explore" || patternPlaying) return;
  const nextSteps = appendFingerpickStep(patternSteps, position);
  if (nextSteps.length === patternSteps.length) {
    patternStatus.textContent = "Pattern full. Play it, undo a note, or clear it to continue.";
    return;
  }
  patternSteps = nextSteps;
  patternStatus.textContent = `Step ${patternSteps.length}: ${position.noteName} on string ${physicalStringNumber(position.stringIndex)} ${position.stringId}.`;
  renderPattern();
}

function renderPattern(): void {
  patternArm.classList.toggle("is-armed", patternArmed);
  patternArm.setAttribute("aria-pressed", String(patternArmed));
  patternArm.disabled = patternPlaying;
  patternBuilder.dataset.full = String(patternSteps.length >= MAX_PATTERN_STEPS);
  patternBuilder.dataset.playing = String(patternPlaying);
  patternCount.textContent = `${patternSteps.length} / ${MAX_PATTERN_STEPS}`;
  patternEmpty.hidden = patternSteps.length > 0;
  patternPlay.disabled = patternSteps.length === 0;
  patternPlayText.textContent = patternPlaying ? "Stop" : "Play";
  patternPlay.setAttribute("aria-label", patternPlaying ? "Stop fingerpicking pattern" : "Play fingerpicking pattern");
  patternUndo.disabled = patternSteps.length === 0 || patternPlaying;
  patternClear.disabled = patternSteps.length === 0 || patternPlaying;

  patternTrack.replaceChildren(
    ...patternSteps.map((step, index) => {
      const item = document.createElement("li");
      item.className = "pattern-step";
      item.classList.toggle("is-current", index === currentPatternIndex);
      item.dataset.index = String(index);
      item.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${physicalStringNumber(step.stringIndex)}·${step.stringId}</strong><small>${step.fret === 0 ? "open" : `fret ${step.fret}`} · ${step.noteName}</small>`;
      return item;
    }),
  );
  renderInstrumentState();
}

function startPatternPlayback(): void {
  if (patternSteps.length === 0 || !audio.isReady) return;
  stopPatternPlayback();
  patternPlaying = true;
  patternArmed = false;
  currentPatternIndex = -1;
  patternStatus.textContent = `Playing ${patternSteps.length} note${patternSteps.length === 1 ? "" : "s"} at ${patternTempo} BPM.`;
  renderPattern();

  const stepMs = 60_000 / patternTempo;

  patternSteps.forEach((step, index) => {
    patternTimers.push(
      window.setTimeout(() => {
        currentPatternIndex = index;
        playPosition(step.stringIndex, step.fret, 0.72, false);
        renderPattern();
      }, index * stepMs),
    );
  });

  patternTimers.push(
    window.setTimeout(() => {
      patternPlaying = false;
      currentPatternIndex = -1;
      patternTimers = [];
      patternStatus.textContent = "Pattern finished.";
      renderPattern();
    }, patternSteps.length * stepMs),
  );
}

function stopPatternPlayback(message?: string): void {
  patternTimers.forEach((timer) => window.clearTimeout(timer));
  patternTimers = [];
  const wasPlaying = patternPlaying;
  patternPlaying = false;
  currentPatternIndex = -1;
  if (message && wasPlaying) patternStatus.textContent = message;
  if (wasPlaying) renderPattern();
}

function getPatternCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  patternSteps.forEach((step) => {
    const key = cellKey(step.stringIndex, step.fret);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

async function startCoach(): Promise<void> {
  resetCoach();
  if (practiceInput === "screen") {
    coachToggle.disabled = true;
    coachToggle.querySelector("span")!.textContent = audio.isReady ? "Starting…" : "Loading strings…";
    if (!audio.isReady && !(await initializeAudio({ focusInstrument: false }))) {
      coachToggle.disabled = false;
      coachToggle.querySelector("span")!.textContent = "Try again";
      coachStatus.textContent = "The on-screen ukulele could not load. Check the local server and try again.";
      renderCoach();
      return;
    }
    coachScreenActive = true;
    coachToggle.disabled = false;
    coachToggle.classList.add("is-listening");
    coachToggle.querySelector("span")!.textContent = "Stop coaching";
    coachSignal.textContent = "Screen input · ready";
    coachStatus.textContent = coachDrill === "strings"
      ? "Play the highlighted open string on the ukulele below."
      : "Play a down-strum to set the pulse, then continue for eight beats.";
    renderCoach();
    instrumentFrame.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  coachSignal.textContent = "Signal · calibrating";
  coachToggle.disabled = true;
  coachToggle.querySelector("span")!.textContent = "Requesting access…";
  await tuner.start(handleCoachReading, handleCoachStatus);
  coachToggle.disabled = false;
  coachToggle.classList.toggle("is-listening", tuner.isListening);
  coachToggle.querySelector("span")!.textContent = tuner.isListening ? "Stop coaching" : "Try again";
}

function coachIsActive(): boolean {
  return coachScreenActive || tuner.isListening;
}

function stopCoach(message?: string): void {
  const wasListening = coachIsActive();
  coachScreenActive = false;
  tuner.stop();
  coachToggle.disabled = false;
  coachToggle.classList.remove("is-listening");
  coachToggle.querySelector("span")!.textContent = "Start coaching";
  coachSignal.textContent = practiceInput === "screen" ? "Screen input · off" : "Signal · off";
  coachWorkbench.dataset.listening = "false";
  if (wasListening && currentView === "coach") {
    coachStatus.textContent = message ?? (practiceInput === "screen"
      ? "On-screen coaching stopped. Your progress is kept until you restart."
      : "Microphone is off. Your progress is kept until you restart.");
  }
  renderCoach();
}

function resetCoach(): void {
  coachTargetIndex = 0;
  coachStableFrames = 0;
  coachConfirmation.reset();
  coachPulseHits = 0;
  coachPulse.reset();
  coachOnsets.reset();
  coachHeardNote.textContent = "—";
  coachHeardDetail.textContent = practiceInput === "screen" ? "Waiting for an on-screen note" : "Waiting for a clear note";
  coachSignal.textContent = practiceInput === "screen" ? "Screen input · ready" : "Signal · waiting";
  coachLive.dataset.grade = "waiting";
  coachStatus.textContent = practiceInput === "screen"
    ? coachDrill === "strings"
      ? "Start coaching, then play the highlighted open string below."
      : "Start coaching, then use down-strums to fill eight beats."
    : coachDrill === "strings"
      ? "Play each open string and let it ring steadily."
      : "Your first strum starts the pulse. Continue for eight beats.";
  if (!coachIsActive()) {
    coachToggle.classList.remove("is-listening");
    coachToggle.querySelector("span")!.textContent = "Start coaching";
  }
  renderCoach();
}

function handleCoachStatus(status: TunerStatus, message: string): void {
  coachWorkbench.dataset.listening = String(status === "requesting" || status === "listening");
  coachToggle.disabled = status === "requesting";
  coachToggle.classList.toggle("is-listening", status === "listening");
  coachToggle.querySelector("span")!.textContent =
    status === "requesting" ? "Requesting access…" : status === "listening" ? "Stop coaching" : status === "error" ? "Try again" : "Start coaching";
  coachStatus.textContent = status === "listening"
    ? coachDrill === "strings" ? "Listening — play the highlighted open string." : "Listening — your first strum starts the pulse."
    : message;
  coachSignal.textContent = status === "requesting"
    ? "Signal · calibrating"
    : status === "listening"
      ? "Signal · listening"
      : status === "error"
        ? "Signal · unavailable"
        : "Signal · off";
  coachLive.dataset.grade = status === "error" ? "wrong-note" : "waiting";
}

function handleCoachReading(reading: PitchReading | null, signal: SignalFrame): void {
  if (signal.at < coachReferenceSuppressUntil) {
    coachSignal.textContent = "Reference · not scored";
    coachStatus.textContent = "Listen to the reference, then play after it fades.";
    return;
  }
  coachSignal.textContent = reading
    ? `Signal · ${Math.round(reading.confidence * 100)}% confidence`
    : signal.rms >= 0.008
      ? "Signal · finding pitch"
      : "Signal · room is quiet";
  if (coachDrill === "pulse") {
    handleCoachPulse(signal);
    return;
  }
  if (coachTargetIndex >= TUNING_TARGETS.length) return;

  const target = TUNING_TARGETS[coachTargetIndex];
  const feedback = evaluateCoachPitch(reading, target);
  coachLive.dataset.grade = feedback.grade;
  coachHeardNote.textContent = feedback.heardNote;
  coachHeardDetail.textContent = coachPitchDetail(feedback.grade, feedback.cents);

  const confirmed = coachConfirmation.push(feedback.grade, signal.at);
  coachStableFrames = coachConfirmation.frames;

  if (confirmed) {
    coachTargetIndex += 1;
    coachStableFrames = 0;
    coachConfirmation.reset();
    if (coachTargetIndex >= TUNING_TARGETS.length) {
      coachStatus.textContent = "All four strings landed cleanly. That is a balanced GCEA set.";
      coachHeardDetail.textContent = "Clarity drill complete";
      tuner.stop();
      coachSignal.textContent = "Signal · complete";
      coachToggle.classList.remove("is-listening");
      coachToggle.querySelector("span")!.textContent = "Practice again";
    } else {
      coachStatus.textContent = `${target.id} accepted ✓ — play ${TUNING_TARGETS[coachTargetIndex].id} next. Pluck once and let it ring.`;
    }
  } else if (feedback.grade !== "quiet") {
    coachStatus.textContent = coachPitchInstruction(feedback.grade, target.id);
  }
  renderCoach();
}

function handleCoachPulse(signal: SignalFrame): void {
  if (coachPulseHits >= 8 || !coachOnsets.push(signal.rms, signal.at)) return;
  recordCoachPulse(signal.at);
}

function recordCoachPulse(at: number): void {
  if (coachPulseHits >= 8) return;
  const feedback = coachPulse.push(at);
  coachLive.dataset.grade = feedback.grade;
  coachPulseHits = coachPulse.hits.length;
  coachHeardNote.textContent = String(coachPulseHits);
  const label = feedback.grade === "on-time" ? "steady" : feedback.grade === "early" ? "too quick" : "too slow";
  coachHeardDetail.textContent = `Last gap: ${feedback.gapMs === null ? "—" : `${Math.round(feedback.gapMs)} ms`} / Target: 833 ms${feedback.gapMs === null ? "" : ` · ${label}`}`;
  coachStatus.textContent = feedback.grade === "restart"
    ? "Pause detected — fresh pulse started. This strum is your new starting point."
    : feedback.grade === "start"
      ? "Starting point set. Leave an even gap between strums. A pause over 2.5 seconds restarts the run."
      : feedback.grade === "on-time"
        ? "Steady — keep that spacing."
        : feedback.grade === "early"
          ? "Too quick — give the next gap a little more room."
          : "Too slow — bring the next strum a little closer.";
  if (coachPulseHits >= 8) {
    coachScreenActive = false;
    tuner.stop();
    coachSignal.textContent = practiceInput === "screen" ? "Screen input · complete" : "Signal · complete";
    coachToggle.classList.remove("is-listening");
    coachToggle.querySelector("span")!.textContent = "Practice again";
    const summary = coachPulse.summary();
    coachStatus.textContent = `${summary.steady} of 7 gaps steady · ${summary.early} too quick · ${summary.late} too slow. Average gap: ${summary.averageGapMs} ms. ${summary.steady === 7 ? "Beautifully even spacing." : "Try again and aim for 833 ms between strums."} The first strum sets the start; it is not scored.`;
  }
  renderCoach();
}

function handleCoachScreenGesture(
  gesture: { kind: "pluck"; stringIndex: number } | { kind: "strum"; direction: StrumDirection },
  at: number,
): void {
  if (currentView !== "coach" || practiceInput !== "screen" || !coachScreenActive) return;
  if (coachDrill === "pulse") {
    if (gesture.kind !== "strum" || gesture.direction !== "down") {
      coachLive.dataset.grade = "early";
      coachStatus.textContent = "Use relaxed down-strums for this pulse drill.";
      renderCoach();
      return;
    }
    recordCoachPulse(at);
    return;
  }
  if (gesture.kind !== "pluck" || coachTargetIndex >= TUNING_TARGETS.length) return;
  const expectedIndex = coachTargetIndex;
  const correct = gesture.stringIndex === expectedIndex && state.getEffectiveFret(gesture.stringIndex) === 0;
  const heard = UKULELE_STRINGS[gesture.stringIndex];
  coachHeardNote.textContent = heard.id;
  if (!correct) {
    coachLive.dataset.grade = "wrong-note";
    coachHeardDetail.textContent = `String ${physicalStringNumber(gesture.stringIndex)} · ${heard.label}`;
    coachStatus.textContent = `That was ${heard.id}. Play open ${TUNING_TARGETS[expectedIndex].label} next.`;
    renderCoach();
    return;
  }

  coachLive.dataset.grade = "correct";
  coachHeardDetail.textContent = "Exact on-screen note";
  coachTargetIndex += 1;
  if (coachTargetIndex >= TUNING_TARGETS.length) {
    coachScreenActive = false;
    coachSignal.textContent = "Screen input · complete";
    coachToggle.classList.remove("is-listening");
    coachToggle.querySelector("span")!.textContent = "Practice again";
    coachStatus.textContent = "All four open strings matched in GCEA order.";
  } else {
    coachStatus.textContent = `${heard.id} accepted ✓ — play ${TUNING_TARGETS[coachTargetIndex].id} next.`;
  }
  renderCoach();
}

function renderCoach(): void {
  const screenCoach = practiceInput === "screen";
  const active = coachIsActive();
  coachWorkbench.dataset.listening = String(active);
  coachWorkbench.dataset.source = practiceInput;
  coachLive.dataset.source = practiceInput;
  coachKicker.textContent = screenCoach ? "On-screen ukulele · exact input" : "Real ukulele · microphone";
  coachCopy.textContent = screenCoach
    ? "Use the playable strings and see each target respond the moment you play."
    : "Four Strings listens locally and responds while the note is still ringing.";
  coachPrivacy.textContent = screenCoach
    ? "No microphone needed. Every note comes from the built-in sampled instrument."
    : "Best for single notes and rhythm. Audio is analysed on this device and never stored.";
  coachSignalDetail.textContent = screenCoach ? "Exact browser input" : "Local analysis";
  if (!active && coachTargetIndex === 0 && coachPulseHits === 0 && coachHeardNote.textContent === "—") {
    coachHeardDetail.textContent = screenCoach ? "Waiting for an on-screen note" : "Waiting for a clear note";
    coachSignal.textContent = screenCoach ? "Screen input · ready" : "Signal · waiting";
  }
  coachWorkbench.querySelector<HTMLElement>(".coach-setup")!.hidden = screenCoach;
  if (currentView === "coach") {
    viewEyebrow.textContent = "Practice · Quick drills";
    modeGuidance.textContent = screenCoach
      ? "Learn the target with exact feedback from the playable strings."
      : "Get immediate feedback on open-string clarity or a steady pulse.";
  }
  coachToggle.classList.toggle("is-listening", active);
  document.querySelectorAll<HTMLButtonElement>(".coach-drill").forEach((button) => {
    const selected = button.dataset.coachDrill === coachDrill;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  coachLive.dataset.drill = coachDrill;
  coachStringEcho.hidden = coachDrill !== "strings";
  coachBeats.hidden = coachDrill !== "pulse";
  coachHold.hidden = coachDrill !== "strings" || screenCoach;
  const acceptance = byId<HTMLElement>("coach-acceptance");
  acceptance.hidden = coachDrill !== "strings" || coachTargetIndex === 0;
  acceptance.textContent = coachTargetIndex === 0 ? "" : coachTargetIndex >= 4
    ? "G · C · E · A accepted ✓ — all four complete"
    : `${TUNING_TARGETS[coachTargetIndex - 1].id} accepted ✓ — play ${TUNING_TARGETS[coachTargetIndex].id} next`;

  if (coachDrill === "strings") {
    const complete = coachTargetIndex >= TUNING_TARGETS.length;
    coachProgress.textContent = complete ? "4 of 4 strings" : `String ${coachTargetIndex + 1} of 4`;
    coachGoal.textContent = complete ? "GCEA complete" : `Play ${TUNING_TARGETS[coachTargetIndex].label}`;
    coachNext.textContent = complete
      ? "All four landed"
      : coachTargetIndex + 1 < TUNING_TARGETS.length
        ? `Next · ${TUNING_TARGETS[coachTargetIndex + 1].label}`
        : "Next · finish";
    coachHold.querySelectorAll("i").forEach((step, index) => {
      step.classList.toggle("is-complete", complete || index < coachStableFrames);
      step.classList.toggle("is-current", !complete && index === Math.min(coachStableFrames, 6));
    });
    coachHold.setAttribute("aria-label", complete ? "Steady note complete" : `Steady note progress ${coachStableFrames} of 7`);
    document.querySelectorAll<HTMLElement>(".echo-string").forEach((row, index) => {
      row.classList.toggle("is-complete", index < coachTargetIndex);
      row.classList.toggle("is-current", index === coachTargetIndex);
      row.querySelector("small")!.textContent = index < coachTargetIndex ? "clean" : index === coachTargetIndex ? "next" : "waiting";
    });
  } else {
    coachProgress.textContent = `${coachPulseHits} of 8 strums`;
    coachGoal.textContent = "Hold 72 BPM";
    coachNext.textContent = coachPulseHits >= 8 ? "Pulse complete" : `Next · beat ${coachPulseHits + 1}`;
    coachBeats.querySelectorAll("span").forEach((beat, index) => {
      const hit = coachPulse.hits[index];
      const label = !hit ? "waiting" : hit.grade === "on-time" ? "steady" : hit.grade === "early" ? "too quick" : hit.grade === "late" ? "too slow" : "start";
      beat.dataset.grade = hit?.grade ?? "waiting";
      beat.textContent = `${index + 1} · ${label}`;
      beat.setAttribute("aria-label", `Strum ${index + 1}: ${label}${hit?.gapMs != null ? `, ${Math.round(hit.gapMs)} milliseconds` : ""}`);
      beat.classList.toggle("is-current", index === coachPulseHits);
    });
  }
  if (currentView === "coach") {
    instrumentFrame.hidden = !screenCoach;
    performanceReadout.hidden = !screenCoach;
    clearButton.hidden = !screenCoach;
    instrumentFrame.dataset.coachActive = String(active);
    instrumentFrame.dataset.coachDrill = coachDrill;
    const targetString = coachDrill === "strings" && coachTargetIndex < TUNING_TARGETS.length ? coachTargetIndex : -1;
    document.querySelectorAll<HTMLElement>(".instrument-string, .body-string-name").forEach((element) => {
      element.classList.toggle("is-coach-target", screenCoach && active && Number(element.dataset.string) === targetString);
    });
    fretButtons.forEach((button) => {
      button.classList.toggle(
        "is-coach-target",
        screenCoach && active && Number(button.dataset.string) === targetString && Number(button.dataset.fret) === 0,
      );
    });
  }
  renderCoachGuidance();
  renderInstrumentSource();
  updateInputHint();
}

function coachPitchDetail(grade: CoachPitchGrade, cents: number | null): string {
  if (grade === "quiet") return "Waiting for a clear note";
  if (grade === "wrong-note") return "Different note detected";
  if (cents === null) return "Listening";
  if (grade === "correct") return `${Math.round(Math.abs(cents))} cents · centered`;
  return `${cents > 0 ? "+" : ""}${Math.round(cents)} cents · ${grade}`;
}

function coachPitchInstruction(grade: CoachPitchGrade, target: StringId): string {
  if (grade === "wrong-note") return `That is another note. Find the open ${target} string.`;
  if (grade === "flat") return `${target} is low. Tighten slightly, then let it ring again.`;
  if (grade === "sharp") return `${target} is high. Loosen slightly, then try again.`;
  if (grade === "close") return `${target} is close. Use a tiny adjustment and keep the note steady.`;
  if (grade === "correct") return `Hold that ${target} note steady for a moment.`;
  return `Play the open ${target} string.`;
}

function currentPracticeStage(): PracticeStage {
  return TEN_MINUTE_STAGES[Math.min(practiceStageIndex, TEN_MINUTE_STAGES.length - 1)];
}

function updatePracticeMicFeedback(
  note: string,
  detail: string,
  progress: number,
  feedbackState: "waiting" | "matching" | "wrong" | "confirmed",
): void {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  practiceMicFeedback.dataset.state = feedbackState;
  practiceMicFeedback.style.setProperty("--mic-progress", `${boundedProgress * 100}%`);
  practiceMicNote.textContent = note;
  practiceMicDetail.textContent = detail;
  practiceMicMeter.setAttribute("aria-valuenow", String(Math.round(boundedProgress * 4)));
  practiceMicMeter.setAttribute("aria-valuetext", detail);
}

function resetPracticePitchTracking(detail = "Play one clear note"): void {
  practicePitchConfirmation.reset();
  practiceMicIgnoreUntil = 0;
  updatePracticeMicFeedback("—", detail, 0, "waiting");
}

function setPracticeInput(input: PracticeInput): void {
  if (practiceActive) return;
  stopReferenceAudio();
  if (currentView === "coach" && coachIsActive()) stopCoach("Coaching stopped while the instrument changed.");
  practiceInput = input;
  storePreference("four-strings-practice-input", input);
  resetPracticePitchTracking();
  practiceOnsets.reset();
  practiceStatus.textContent = input === "real"
    ? "Your microphone will start with the session. Play one target at a time."
    : "Start when your hands are ready. You can finish early when a stage is mastered.";
  renderPractice();
  resetCoach();
  renderInstrumentSource();
}

function renderInstrumentSource(): void {
  const realInstrument = practiceInput === "real";
  const inCoach = currentView === "coach";
  instrumentSourceTitle.textContent = inCoach ? "Coach with" : "Practice with";
  practiceInputNote.textContent = inCoach
    ? realInstrument
      ? "The microphone listens locally to your ukulele and coaches pitch or pulse."
      : "Use the playable strings below for immediate, exact feedback."
    : realInstrument
      ? "Uses your microphone locally. Open strings are pitch-checked; chord shapes remain a visual self-check."
      : "Use the playable fretboard and get exact shape feedback.";
  practiceInputScreen.classList.toggle("is-selected", !realInstrument);
  practiceInputScreen.setAttribute("aria-pressed", String(!realInstrument));
  practiceInputReal.classList.toggle("is-selected", realInstrument);
  practiceInputReal.setAttribute("aria-pressed", String(realInstrument));
  const sourceLocked = practiceActive;
  practiceInputScreen.disabled = sourceLocked;
  practiceInputReal.disabled = sourceLocked;
}

async function startPracticeMicrophone(): Promise<boolean> {
  await tuner.start(handlePracticeMicReading, handlePracticeMicStatus);
  return tuner.isListening;
}

function handlePracticeMicStatus(status: TunerStatus, message: string): void {
  if (currentView !== "practice" || practiceInput !== "real") return;
  practiceStart.disabled = status === "requesting";
  if (status === "requesting") {
    practiceStart.textContent = "Requesting mic…";
    practiceStatus.textContent = message;
  } else if (status === "error") {
    practiceStart.textContent = "Try again";
    practiceStatus.textContent = message;
  } else if (status === "listening" && !practiceActive) {
    practiceStatus.textContent = "Microphone ready. Starting your real-ukulele session…";
  }
}

function handlePracticeMicReading(reading: PitchReading | null, signal: SignalFrame): void {
  if (currentView !== "practice" || practiceInput !== "real" || !practiceActive || practicePaused || practiceComplete) return;
  if (signal.at < practiceReferenceSuppressUntil) {
    practicePitchConfirmation.reset();
    updatePracticeMicFeedback("—", "Reference ignored by scoring", 0, "waiting");
    practiceStatus.textContent = "Reference playing — listen now, then copy it when the prompt returns.";
    return;
  }
  if (signal.at < practiceMicIgnoreUntil) return;
  const stage = currentPracticeStage();
  const onset = practiceOnsets.push(signal.rms, signal.at);

  if (stage.targetKind === "strings") {
    const expected = stage.stringTargets![practiceTargetIndex];
    const target = TUNING_TARGETS[expected];
    const feedback = evaluateCoachPitch(reading, target, 50);
    if (feedback.grade === "correct") {
      const confirmation = practicePitchConfirmation.observe("match", signal.at);
      const pitchDetail = feedback.cents === null
        ? `${confirmation.matches} of ${confirmation.required} checks`
        : `${Math.abs(Math.round(feedback.cents))} cents ${feedback.cents < 0 ? "flat" : feedback.cents > 0 ? "sharp" : "centered"} · ${confirmation.matches} of ${confirmation.required}`;
      updatePracticeMicFeedback(feedback.heardNote, pitchDetail, confirmation.progress, "matching");
      practiceStatus.textContent = `Heard ${target.label} — confirming this note, no tempo match needed.`;
      if (confirmation.confirmed) {
        const targets = stage.stringTargets!;
        const exerciseComplete = practiceTargetIndex + 1 >= targets.length;
        const nextTarget = exerciseComplete ? null : TUNING_TARGETS[targets[practiceTargetIndex + 1]];
        practicePitchConfirmation.reset();
        practiceMicIgnoreUntil = signal.at + 280;
        recordPracticeAttempt(true, `Microphone check: open ${target.id} heard clearly.`);
        advancePracticeTarget(targets.length);
        practiceOnsets.reset();
        updatePracticeMicFeedback(
          target.label,
          exerciseComplete ? "Counted · exercise complete" : `Counted · next ${nextTarget!.label}`,
          1,
          "confirmed",
        );
      }
      return;
    }

    const confirmation = practicePitchConfirmation.observe(feedback.grade === "quiet" ? "quiet" : "mismatch", signal.at);
    if (feedback.grade === "wrong-note") {
      updatePracticeMicFeedback(feedback.heardNote, `Expected ${target.label}`, 0, "wrong");
      practiceStatus.textContent = `Heard ${feedback.heardNote}. The next target is open ${target.label}.`;
    } else if (feedback.grade === "flat" || feedback.grade === "sharp" || feedback.grade === "close") {
      updatePracticeMicFeedback(feedback.heardNote, `${Math.abs(Math.round(feedback.cents ?? 0))} cents ${feedback.grade}`, 0, "wrong");
      practiceStatus.textContent = `${target.id} is ${feedback.grade}. Tune it closer, or use Tune for a precise adjustment.`;
    } else if (confirmation.matches > 0) {
      updatePracticeMicFeedback(target.label, `Keep it ringing · ${confirmation.matches} of ${confirmation.required}`, confirmation.progress, "matching");
    } else if (onset) {
      updatePracticeMicFeedback("—", `Waiting for ${target.label}`, 0, "waiting");
      practiceStatus.textContent = `Listening for open ${target.label}. Play one string and let it ring.`;
    } else if (practiceMicFeedback.dataset.state === "matching") {
      updatePracticeMicFeedback("—", `Waiting for ${target.label}`, 0, "waiting");
    }
    return;
  }

  if (!onset) return;
  const chordTargets = practiceChordTargets(stage);
  const expectedChord = chordTargets[Math.min(practiceTargetIndex, chordTargets.length - 1)];
  if (stage.targetKind === "rhythm") {
    if (practiceTargetIndex === 0) practiceRhythmAnchor = signal.at;
    const feedback = gradeRhythmHit(signal.at, practiceRhythmAnchor, practiceTempo, practiceTargetIndex);
    const correct = practiceTargetIndex === 0 || feedback.grade === "on-time";
    recordPracticeAttempt(
      correct,
      correct ? "Live timing: that strum arrived on beat." : `Live timing: that strum was ${feedback.grade}. Keep the wrist moving.`,
    );
    advancePracticeTarget(stage.strumTargets!.length);
    return;
  }

  recordPracticeAttempt(
    true,
    `Attack heard for ${expectedChord}. Compare your frets with ${LESSON_CHORDS[expectedChord].frets.join("–")}; microphone scoring checks timing here.`,
  );
  advancePracticeTarget(chordTargets.length);
}

function startPracticeSession(): void {
  stopReferenceAudio();
  if (practiceInput === "screen" && !audio.isReady) {
    practiceStatus.textContent = "The sampled ukulele is still loading. Try starting again in a moment.";
    return;
  }
  if (practiceInput === "real" && !tuner.isListening) {
    practiceStatus.textContent = "Microphone access is needed for real-ukulele practice. Try starting again.";
    return;
  }
  practiceActive = true;
  practicePaused = false;
  practiceComplete = false;
  practiceStartedAt = Date.now();
  practicePausedAt = 0;
  practicePausedDuration = 0;
  practiceStageIndex = 0;
  practiceTargetIndex = 0;
  practiceStageMastered = false;
  practiceClean = 0;
  practiceMisses = 0;
  practiceCleanStreak = 0;
  practiceMissWindow = 0;
  practiceTempo = 72;
  practiceRhythmAnchor = 0;
  resetPracticePitchTracking("Waiting for G4");
  practiceAdjustment = "Tempo changes after three correct moves or two misses.";
  state.clearAll();
  window.clearInterval(practiceTimer);
  practiceTimer = window.setInterval(updatePracticeTimer, 250);
  practiceStatus.textContent = practiceInput === "real"
    ? "Session started. Play open G4 on your ukulele and let it ring."
    : "Session started. Tap string 4 · G on the body or press 4 on the keyboard.";
  renderInstrumentState();
  renderPractice();
  strumSurface.focus({ preventScroll: true });
}

function pausePracticeSession(): void {
  if (!practiceActive || practicePaused) return;
  practicePaused = true;
  practicePausedAt = Date.now();
  window.clearInterval(practiceTimer);
  if (practiceInput === "real") tuner.stop();
  practiceStatus.textContent = "Session paused. Your place and working tempo are safe.";
  renderPractice();
}

async function resumePracticeSession(): Promise<void> {
  if (!practiceActive || !practicePaused) return;
  if (practiceInput === "real" && !(await startPracticeMicrophone())) {
    practiceStatus.textContent = "Microphone access is needed to resume real-ukulele practice.";
    renderPractice();
    return;
  }
  practicePausedDuration += Date.now() - practicePausedAt;
  practicePaused = false;
  practicePausedAt = 0;
  practiceTimer = window.setInterval(updatePracticeTimer, 250);
  practiceStatus.textContent = "Back in. Continue with the highlighted target.";
  renderPractice();
}

function resetPracticeSession(): void {
  stopReferenceAudio();
  window.clearInterval(practiceTimer);
  if (practiceInput === "real") tuner.stop();
  practiceActive = false;
  practicePaused = false;
  practiceComplete = false;
  practiceStageIndex = 0;
  practiceTargetIndex = 0;
  practiceStageMastered = false;
  practiceClean = 0;
  practiceMisses = 0;
  practiceCleanStreak = 0;
  practiceMissWindow = 0;
  practiceTempo = 72;
  practiceAdjustment = "Tempo changes after three correct moves or two misses.";
  practiceRhythmAnchor = 0;
  resetPracticePitchTracking();
  practiceOnsets.reset();
  practiceClock.value = formatPracticeTime(TEN_MINUTE_SECONDS);
  practiceInsight.textContent = "Begin slowly. The session will find what needs another repetition.";
  practiceStatus.textContent = "Start when your hands are ready. You can finish early when a stage is mastered.";
  renderPractice();
}

function updatePracticeTimer(): void {
  if (!practiceActive || practicePaused) return;
  const elapsedSeconds = (Date.now() - practiceStartedAt - practicePausedDuration) / 1000;
  practiceClock.value = formatPracticeTime(TEN_MINUTE_SECONDS - elapsedSeconds);
  if (elapsedSeconds >= TEN_MINUTE_SECONDS) {
    finishPracticeSession();
    return;
  }
  let timedStage = practiceStageIndex;
  TEN_MINUTE_STAGES.forEach((_, index) => {
    if (elapsedSeconds >= practiceStageOffsetSeconds(index)) timedStage = Math.max(timedStage, index);
  });
  if (timedStage !== practiceStageIndex) {
    practiceStageIndex = timedStage;
    practiceTargetIndex = 0;
    practiceStageMastered = false;
    practiceRhythmAnchor = 0;
    resetPracticePitchTracking();
    practiceAdjustment = "New stage. The working tempo carries forward.";
    practiceStatus.textContent = `${currentPracticeStage().label} begins. Follow the highlighted target.`;
    renderPractice();
  }
}

function advancePracticeStage(): void {
  if (!practiceActive || practicePaused) return;
  stopReferenceAudio();
  if (practiceStageIndex >= TEN_MINUTE_STAGES.length - 1) {
    finishPracticeSession();
    return;
  }
  practiceStageIndex += 1;
  practiceTargetIndex = 0;
  practiceStageMastered = false;
  practiceRhythmAnchor = 0;
  resetPracticePitchTracking();
  practiceOnsets.reset();
  practiceAdjustment = "New stage. The working tempo carries forward.";
  state.clearAll();
  practiceStatus.textContent = `${currentPracticeStage().label} begins. Take the first target slowly.`;
  renderInstrumentState();
  renderPractice();
}

function finishPracticeSession(): void {
  window.clearInterval(practiceTimer);
  if (practiceInput === "real") tuner.stop();
  practiceActive = false;
  practicePaused = false;
  practiceComplete = true;
  practiceClock.value = "0:00";
  practiceStatus.textContent = `Session complete. ${practiceClean} ${practiceInput === "real" ? "heard repetitions" : "correct screen moves"}; ${practiceMisses} targets repeated.`;
  practiceInsight.textContent = practiceMisses === 0
    ? "The whole session stayed clean. Next time, begin four BPM faster."
    : "Your working tempo adjusted around the difficult moments. Repeat tomorrow before adding speed.";
  renderPractice();
}

function handlePracticeGesture(
  gesture: { kind: "pluck"; stringIndex: number } | { kind: "strum"; direction: StrumDirection },
  at: number,
): void {
  if (currentView !== "practice" || !practiceActive || practicePaused || practiceComplete) return;
  const stage = currentPracticeStage();
  if (stage.targetKind === "strings") {
    const targets = stage.stringTargets!;
    const expected = targets[practiceTargetIndex];
    const correct = gesture.kind === "pluck" && gesture.stringIndex === expected && state.getEffectiveFret(expected) === 0;
    recordPracticeAttempt(
      correct,
      correct
        ? `Screen check: open ${UKULELE_STRINGS[expected].id} selected correctly.`
        : `Screen check: next is open ${UKULELE_STRINGS[expected].id}, string ${physicalStringNumber(expected)}.`,
    );
    if (correct) advancePracticeTarget(targets.length);
    return;
  }

  const chordTargets = practiceChordTargets(stage);
  const expectedChord = chordTargets[Math.min(practiceTargetIndex, chordTargets.length - 1)];
  const shapeCorrect = matchesChord(getCurrentShape().map((position) => position.fret), expectedChord);
  if (gesture.kind !== "strum" || !shapeCorrect) {
    recordPracticeAttempt(false, `${expectedChord} needs frets ${LESSON_CHORDS[expectedChord].frets.join("–")}. Rebuild it without rushing.`);
    return;
  }

  if (stage.targetKind === "rhythm") {
    if (gesture.direction !== "down") {
      recordPracticeAttempt(false, "Keep this pulse simple: down-strums only.");
      return;
    }
    if (practiceTargetIndex === 0) practiceRhythmAnchor = at;
    const feedback = gradeRhythmHit(at, practiceRhythmAnchor, practiceTempo, practiceTargetIndex);
    const correct = practiceTargetIndex === 0 || feedback.grade === "on-time";
    recordPracticeAttempt(
      correct,
      correct ? "Screen timing: that down-strum arrived on beat." : `Screen timing: that strum was ${feedback.grade}. Keep the wrist moving.`,
    );
    advancePracticeTarget(stage.strumTargets!.length);
    return;
  }

  recordPracticeAttempt(true, `Screen check: ${expectedChord} shape matched. Prepare the next shape.`);
  advancePracticeTarget(chordTargets.length);
}

function recordPracticeAttempt(correct: boolean, message: string): void {
  if (correct) {
    practiceClean += 1;
    practiceCleanStreak += 1;
    practiceMissWindow = 0;
    if (practiceCleanStreak >= 3) {
      const previous = practiceTempo;
      practiceTempo = adaptPracticeTempo(practiceTempo, practiceCleanStreak, 0);
      practiceCleanStreak = 0;
      practiceInsight.textContent = practiceTempo > previous
        ? `Three clean attempts. The working tempo rose gently to ${practiceTempo} BPM.`
        : message;
      practiceAdjustment = practiceTempo > previous
        ? `Tempo +${practiceTempo - previous} BPM after three correct moves.`
        : "Tempo is already at the upper practice limit.";
    } else practiceInsight.textContent = message;
  } else {
    practiceMisses += 1;
    practiceMissWindow += 1;
    practiceCleanStreak = 0;
    if (practiceMissWindow >= 2) {
      const previous = practiceTempo;
      practiceTempo = adaptPracticeTempo(practiceTempo, 0, practiceMissWindow);
      practiceMissWindow = 0;
      practiceInsight.textContent = practiceTempo < previous
        ? `Two misses found a useful practice point. Slowing to ${practiceTempo} BPM.`
        : message;
      practiceAdjustment = practiceTempo < previous
        ? `Tempo −${previous - practiceTempo} BPM after two missed targets.`
        : "Tempo is already at the lower practice limit.";
    } else practiceInsight.textContent = message;
  }
  practiceStatus.textContent = message;
  renderPractice();
}

function advancePracticeTarget(targetCount: number): void {
  practiceTargetIndex += 1;
  practicePitchConfirmation.reset();
  if (practiceTargetIndex < targetCount) {
    renderPractice();
    return;
  }
  practiceTargetIndex = 0;
  practiceStageMastered = true;
  practiceOnsets.reset();
  practiceStatus.textContent = `${currentPracticeStage().label} mastered. Move on now, or repeat it until its time window ends.`;
  renderPractice();
}

function practiceChordTargets(stage: PracticeStage): readonly ChordName[] {
  if (stage.id !== "song") return stage.chordTargets ?? ["C"];
  return practiceSelectedSong === "khaab"
    ? ["Am", "F", "C", "G", "Am", "F", "C", "G"]
    : ["C", "Am", "F", "G", "C", "Am", "F", "G"];
}

function practiceStageDescription(stage: PracticeStage, realPractice: boolean): string {
  if (!realPractice) return stage.description;
  if (stage.targetKind === "strings") {
    return "Play G, C, E and A in order. The microphone listens for each open-string pitch before moving on.";
  }
  if (stage.targetKind === "rhythm") {
    return "Strum the shown shape on each pulse. The microphone checks when each audible attack lands.";
  }
  return `${stage.description} Compare the shown frets, then play once; the microphone confirms the attack and timing.`;
}

function renderPractice(): void {
  const stage = currentPracticeStage();
  const realPractice = practiceInput === "real";
  practiceWorkbench.dataset.session = practiceComplete ? "complete" : practicePaused ? "paused" : practiceActive ? "active" : "idle";
  practiceWorkbench.dataset.input = practiceInput;
  practiceKicker.textContent = realPractice
    ? "Adaptive daily session · real ukulele"
    : "Adaptive daily session · screen instrument";
  practiceDescription.textContent = realPractice
    ? "The microphone checks open-string pitch and listening timing while you play your own instrument."
    : "The session notices clean shapes and missed changes, then adjusts the working tempo.";
  practiceInsightKicker.textContent = realPractice ? "Live microphone" : "Screen feedback";
  renderInstrumentSource();
  practiceStart.textContent = practiceComplete ? "Start again" : !practiceActive ? "Start session" : practicePaused ? "Resume" : "Pause";
  practiceReset.disabled = !practiceActive && !practiceComplete;
  practiceNext.disabled = !practiceActive || practicePaused || !practiceStageMastered;
  practiceStageLabel.textContent = `${practiceActive ? `Stage ${stage.number} of 5` : "Ready"} · ${Math.ceil(stage.durationSeconds / 60)} ${stage.durationSeconds === 60 ? "minute" : "minutes"}`;
  practiceStageTitle.textContent = stage.title;
  practiceStageCopy.textContent = practiceStageDescription(stage, realPractice);
  practiceTempoReadout.textContent = `${practiceTempo} BPM`;
  practiceCleanLabel.textContent = realPractice ? "Heard moves" : "Correct moves";
  practiceCleanReadout.textContent = String(practiceClean);
  practiceMissesReadout.textContent = String(practiceMisses);
  const targetCount = practiceTargetCount(stage);
  const completeCount = practiceStageMastered ? targetCount : Math.min(practiceTargetIndex, targetCount);
  practiceProgressDetail.textContent = `${completeCount} of ${targetCount} ${practiceProgressNoun(stage)} complete`;
  practiceMicFeedback.hidden = !realPractice || !practiceActive || practicePaused || practiceComplete || stage.targetKind !== "strings" || practiceStageMastered;
  practiceAdjustmentReadout.textContent = practiceAdjustment;
  if (currentView === "practice") {
    instrumentFrame.hidden = realPractice;
    performanceReadout.hidden = realPractice;
    clearButton.hidden = realPractice;
  }
  document.querySelectorAll<HTMLButtonElement>("[data-practice-song]").forEach((button) => {
    const selected = button.dataset.practiceSong === practiceSelectedSong;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = practiceActive;
  });

  practiceTimeline.replaceChildren(...TEN_MINUTE_STAGES.map((item, index) => {
    const li = document.createElement("li");
    li.className = "practice-timeline-step";
    li.classList.toggle("is-current", index === practiceStageIndex && !practiceComplete);
    li.classList.toggle("is-complete", index < practiceStageIndex || practiceComplete);
    li.innerHTML = `<span>${String(item.number).padStart(2, "0")}</span><strong>${item.label}</strong><small>${formatPracticeTime(item.durationSeconds)}</small>`;
    return li;
  }));

  if (practiceStageMastered) {
    practiceTarget.innerHTML = `<span>Stage complete</span><strong>✓</strong><small>Repeat it or continue</small>`;
  } else if (stage.targetKind === "strings") {
    const target = stage.stringTargets![practiceTargetIndex];
    practiceTarget.innerHTML = `<span>Target ${practiceTargetIndex + 1} of ${targetCount}</span><strong>${physicalStringNumber(target)} · ${UKULELE_STRINGS[target].id}</strong><small>Open ${UKULELE_STRINGS[target].label}${realPractice ? " · listen" : ""}</small>`;
  } else if (stage.targetKind === "rhythm") {
    practiceTarget.innerHTML = `<span>Beat ${practiceTargetIndex + 1} of ${stage.strumTargets!.length}</span><strong>↓ · C</strong><small>${LESSON_CHORDS.C.frets.join("–")} · ${practiceTempo} BPM</small>`;
  } else {
    const targets = practiceChordTargets(stage);
    const chord = targets[practiceTargetIndex];
    practiceTarget.innerHTML = `<span>Shape ${practiceTargetIndex + 1} of ${targetCount}</span><strong>${chord}</strong><small>Frets ${LESSON_CHORDS[chord].frets.join("–")}</small>`;
  }
  renderPracticeGuidance();
  if (currentView === "practice") {
    renderInstrumentState();
    updateInputHint();
  }
}

function practiceTargetCount(stage: PracticeStage): number {
  if (stage.targetKind === "strings") return stage.stringTargets!.length;
  if (stage.targetKind === "rhythm") return stage.strumTargets!.length;
  return practiceChordTargets(stage).length;
}

function practiceProgressNoun(stage: PracticeStage): string {
  if (stage.targetKind === "strings") return "strings";
  if (stage.targetKind === "rhythm") return "beats";
  return "shapes";
}

async function startTuner(): Promise<void> {
  await tuner.start(handleTunerReading, handleTunerStatus);
  tunerToggle.querySelector("span")!.textContent = tuner.isListening ? "Stop listening" : "Try again";
  tunerToggle.classList.toggle("is-listening", tuner.isListening);
}

function stopTuner(): void {
  const wasListening = tuner.isListening;
  tuner.stop();
  tunerToggle.querySelector("span")!.textContent = "Start listening";
  tunerToggle.classList.remove("is-listening");
  if (wasListening && currentView === "tuner") resetTunerMeter("Microphone is off.");
}

function handleTunerStatus(status: TunerStatus, message: string): void {
  tunerMeter.dataset.tuning = status;
  tunerStatus.textContent = message;
  tunerToggle.disabled = status === "requesting";
  tunerToggle.querySelector("span")!.textContent =
    status === "requesting" ? "Requesting access…" : status === "listening" ? "Stop listening" : status === "error" ? "Try again" : "Start listening";
}

function handleTunerReading(reading: PitchReading | null, signal: SignalFrame): void {
  if (signal.at < tunerReferenceSuppressUntil) {
    tunerMeter.dataset.signal = "reference";
    tunerStatus.textContent = "Reference playing — listen, then pluck your ukulele after it fades.";
    return;
  }
  if (!reading) {
    if (lastTunerReading) {
      if (signal.at - lastTunerReadingAt >= 700) {
        tunerMeter.dataset.signal = "held";
        tunerFrequency.textContent = `${lastTunerReading.frequency.toFixed(1)} Hz · last reading`;
        tunerStatus.textContent = "Last reading held — pluck the string again to refresh it.";
      }
      return;
    }

    tunerMeter.dataset.tuning = "listening";
    tunerMeter.dataset.signal = "waiting";
    tunerNote.textContent = "—";
    tunerStringLabel.textContent = tunerTarget ? `${tunerTarget} string selected` : "Play a string";
    tunerFrequency.textContent = "Waiting for a clear note";
    tunerCents.textContent = "0 cents";
    tunerMeter.style.setProperty("--needle", "0");
    return;
  }
  lastTunerReading = reading;
  lastTunerReadingAt = signal.at;
  tunerMeter.dataset.signal = "live";
  const pitch = targetPitch(reading, tunerTarget);
  const cents = Math.round(pitch.cents);
  const tuning = Math.abs(cents) <= 5 ? "in-tune" : cents < 0 ? "flat" : "sharp";
  tunerMeter.dataset.tuning = tuning;
  tunerNote.textContent = pitch.target.id;
  tunerStringLabel.textContent = `${physicalStringNumber(pitch.target.stringIndex)} · ${pitch.target.label}`;
  tunerFrequency.textContent = `${pitch.frequency.toFixed(1)} Hz`;
  tunerCents.textContent = Math.abs(cents) <= 5 ? "In tune" : `${cents > 0 ? "+" : ""}${cents} cents`;
  tunerStatus.textContent =
    tuning === "in-tune"
      ? `${pitch.target.id} is in tune. Let it ring, then move to the next string.`
      : tuning === "flat"
        ? `${pitch.target.id} is flat — tighten the string a little.`
        : `${pitch.target.id} is sharp — loosen the string a little.`;
  tunerMeter.style.setProperty("--needle", String(Math.max(-50, Math.min(50, cents)) / 50));
  document.querySelectorAll<HTMLElement>(".tuner-target").forEach((button) => {
    button.classList.toggle("is-heard", button.dataset.target === pitch.target.id);
  });
  renderTunerReference();
}

function resetTunerMeter(message: string): void {
  lastTunerReading = null;
  lastTunerReadingAt = 0;
  tunerMeter.dataset.tuning = tuner.isListening ? "listening" : "idle";
  tunerMeter.dataset.signal = tuner.isListening ? "waiting" : "idle";
  tunerNote.textContent = "—";
  tunerStringLabel.textContent = tunerTarget ? `${tunerTarget} string selected` : "Play a string";
  tunerFrequency.textContent = tuner.isListening ? "Waiting for a clear note" : "Waiting for sound";
  tunerCents.textContent = "0 cents";
  tunerStatus.textContent = message;
  tunerMeter.style.setProperty("--needle", "0");
  document.querySelectorAll<HTMLElement>(".tuner-target").forEach((button) => button.classList.remove("is-heard"));
  renderTunerReference();
}

function renderTunerTargets(): void {
  document.querySelectorAll<HTMLButtonElement>(".tuner-target").forEach((button) => {
    const selected = (button.dataset.target === "auto" && tunerTarget === null) || button.dataset.target === tunerTarget;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function resetLesson(message: string): void {
  stopLessonMicrophone();
  stopReferenceAudio();
  stopLessonDemo();
  stopLessonTakePlayback();
  lessonPhase = "preview";
  lessonLineIndex = 0;
  lessonChordIndex = 0;
  lessonGestureIndex = 0;
  lessonFeedback = "neutral";
  lessonStatus.textContent = message;
  state.clearAll();
  renderInstrumentState();
  renderLesson();
}

function currentSong() {
  return LESSON_SONGS[selectedSongIndex];
}

function renderSongResults(): void {
  const filters: LessonLibraryFilters = {
    status: lessonStatusFilter.value as LessonLibraryFilters["status"],
    type: lessonTypeFilter.value as LessonLibraryFilters["type"],
  };
  const matches = filterLessonLibrary(LESSON_SONGS, songSearch.value, filters);
  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "song-results-empty";
    empty.textContent = "No lessons match this search and filter combination. Clear the search or choose All.";
    songResults.replaceChildren(empty);
    return;
  }

  songResults.replaceChildren(
    ...matches.map((song) => {
      const button = document.createElement("button");
      const selected = song.id === currentSong().id;
      const chordNames = [...new Set(song.lines.flatMap((line) => line.chords))];
      const skill = chordNames.length > 0 ? chordNames.join(" · ") : song.skillLabel ?? "Single notes";
      button.type = "button";
      button.className = "song-result";
      button.classList.toggle("is-selected", selected);
      button.dataset.songId = song.id;
      button.setAttribute("aria-pressed", String(selected));
      button.innerHTML = `<span class="song-result-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="song-result-copy"><strong>${song.title}</strong><small>${song.artist} · ${song.genre}</small></span><span class="song-result-chords">${skill}</span><span class="song-result-rights">${trustLabel(song)}</span>`;
      return button;
    }),
  );
}

async function startLessonPractice(): Promise<void> {
  if (!canPracticeLessonSong(currentSong())) return;
  if (lessonInput === "screen" && !audio.isReady) {
    lessonStatus.textContent = "Enable the sampled ukulele below, then come back to start your turn.";
    instrumentFrame.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  stopReferenceAudio();
  stopLessonDemo();
  stopLessonTakePlayback();
  lessonPhase = "lines";
  lessonLineIndex = 0;
  lessonChordIndex = 0;
  lessonGestureIndex = 0;
  lessonFeedback = "neutral";
  lessonPitchConfirmation.reset();
  lessonStrumCounter.reset();
  state.clearAll();
  const song = currentSong();
  const chapter = song.chapters[selectedChapterIndex];
  if (isMelodyChapter(chapter)) {
    const first = song.lines[0].notes![0];
    const position = getFretPosition(first.stringIndex, first.fret);
    lessonStatus.textContent = `Part 1 begins with ${first.solfege ? `${first.solfege} · ` : ""}${position.noteName}. Pick string ${physicalStringNumber(first.stringIndex)}, fret ${first.fret}.`;
  } else {
    const firstChord = song.lines[0].chords[0];
    lessonStatus.textContent = `Part 1 begins on ${firstChord}. Form ${LESSON_CHORDS[firstChord].frets.join("–")}, then play the shown pattern.`;
  }
  renderInstrumentState();
  renderLesson();
  if (lessonInput === "real") await startLessonMicrophone();
}

function renderLesson(): void {
  const song = currentSong();
  const chapter = song.chapters[selectedChapterIndex];
  const melodyChapter = isMelodyChapter(chapter);
  lessonWorkbench.dataset.phase = lessonPhase;
  lessonWorkbench.dataset.demo = String(lessonDemoPlaying);
  lessonWorkbench.dataset.feedback = lessonFeedback;
  lessonWorkbench.dataset.technique = melodyChapter ? "melody" : "chords";
  lessonWorkbench.dataset.input = lessonInput;
  const phaseForPattern: LessonPhase = lessonPhase === "full" || lessonPhase === "complete" ? "full" : "lines";
  document.querySelectorAll<HTMLButtonElement>(".chapter-tab").forEach((button, index) => {
    const selected = index === selectedChapterIndex;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.querySelector("strong")!.textContent = song.chapters[index].shortTitle;
  });
  const chordNames = [...new Set(song.lines.flatMap((line) => line.chords))];
  lessonSongTitle.textContent = song.title;
  lessonSongMeta.textContent = `${song.artist} · ${song.genre} · Key of ${song.key} · ${song.meter} · ${melodyChapter ? song.skillLabel ?? "single-note melody" : chordNames.join(", ")}`;
  lessonRights.textContent = `${song.rightsDetail}${lessonTrust(song).status === "unverified" ? " · Unverified arrangement" : ""}`;
  renderLessonProvenance(song);
  lessonTitle.textContent = chapter.title;
  lessonCopy.textContent = chapter.description;
  lessonTempo.textContent = `${chapter.bpm} BPM · ${song.meter}`;
  lessonPattern.textContent = phaseForPattern === "full" ? chapter.fullPattern : chapter.guidedPattern;
  lessonPattern.dataset.step = String(lessonGestureIndex);
  lessonProgress.textContent =
    lessonPhase === "preview"
      ? `Preview · hear the ${song.lines.length}-part example`
      : lessonPhase === "full"
        ? `Full run · part ${lessonLineIndex + 1} of ${song.lines.length}`
        : lessonPhase === "complete"
          ? `Chapter complete · ${song.lines.length} of ${song.lines.length} parts`
          : `Guided part ${lessonLineIndex + 1} of ${song.lines.length}`;
  lessonPractice.textContent = lessonPhase === "preview"
    ? "Start practice"
    : lessonPhase === "complete"
      ? "Practice again"
      : "Reset practice";
  const practiceAllowed = canPracticeLessonSong(song);
  lessonPractice.disabled = !practiceAllowed;
  lessonPractice.title = practiceAllowed ? "" : "This arrangement is unverified; demo and guided practice are unavailable.";
  lessonDemo.disabled = !practiceAllowed;
  lessonDemo.title = practiceAllowed
    ? audio.isReady ? "" : "Sound will load when the demo starts"
    : "This arrangement is unverified; demo and guided practice are unavailable.";
  lessonDemo.querySelector("span")!.textContent = lessonDemoPlaying ? "Stop demo" : `Hear ${song.lines.length}-line demo`;
  lessonDemo.classList.toggle("is-playing", lessonDemoPlaying);
  renderLessonCue();
  renderLessonGuidance();

  lessonLines.replaceChildren(
    ...song.lines.map((line, lineIndex) => {
      const item = document.createElement("li");
      const isCurrent = !lessonDemoPlaying && ((lessonPhase === "preview" && lineIndex === 0) ||
        (lessonPhase !== "preview" && lessonPhase !== "complete" && lineIndex === lessonLineIndex));
      const isDemo = lessonDemoPlaying && lineIndex === lessonDemoLineIndex;
      const isComplete = lessonPhase === "complete" ||
        ((lessonPhase === "lines" || lessonPhase === "full") && lineIndex < lessonLineIndex);
      item.className = "lesson-line";
      item.classList.toggle("is-current", isCurrent);
      item.classList.toggle("is-demo", isDemo);
      item.classList.toggle("is-complete", isComplete);
      const steps = melodyChapter
        ? (line.notes ?? []).map((note, noteIndex) => {
          const position = getFretPosition(note.stringIndex, note.fret);
          const active = (isCurrent && noteIndex === lessonGestureIndex) || (isDemo && noteIndex === lessonDemoGestureIndex);
          return `<span class="lesson-chord lesson-note${active ? " is-expected" : ""}${note.quick ? " is-quick" : ""}"><strong>${physicalStringNumber(note.stringIndex)},${note.fret}</strong><small>${note.solfege ?? position.noteName}${note.quick ? " · quick" : ""}</small></span>`;
        }).join("")
        : line.chords.map((chord, chordIndex) => {
          const shape = LESSON_CHORDS[chord].frets.join("–");
          const active = (isCurrent && chordIndex === lessonChordIndex) || (isDemo && chordIndex === lessonDemoChordIndex);
          return `<span class="lesson-chord${active ? " is-expected" : ""}"><strong>${chord}</strong><small>${shape}</small></span>`;
        }).join("");
      item.innerHTML = `<span class="lesson-line-number">${String(lineIndex + 1).padStart(2, "0")}</span><div><p>${line.label}</p>${line.native ? `<small class="lesson-native">${line.native}</small>` : ""}<div class="lesson-chords">${steps}</div></div><span class="lesson-check" aria-hidden="true">✓</span>`;
      return item;
    }),
  );

  instrumentFrame.dataset.lessonChapter = String(chapter.id);
  instrumentFrame.dataset.lessonSong = song.id;
  strumSurface.setAttribute(
    "aria-label",
    melodyChapter && currentView === "chapters"
      ? "Tap the highlighted string to play the current melody note"
      : chapter.guidedEvents[0]?.kind === "pluck" && currentView === "chapters"
        ? "Tap an individual string to fingerpick"
      : "Tap to play all four strings together, or sweep across them to strum in order",
  );
  renderLessonTakeControls();
  renderLessonInput();
  renderSongResults();
  if (currentView === "chapters") renderInstrumentState();
  updateInputHint();
}

function renderLessonProvenance(song: (typeof LESSON_SONGS)[number]): void {
  const trust = lessonTrust(song);
  const exportAllowed = canPracticeLessonSong(song);
  lessonTrustLabel.textContent = trust.label;
  lessonTrustLabel.dataset.status = trust.status;
  lessonMaterialType.textContent = song.provenance.type === "exercise"
    ? "Exercise"
    : song.provenance.type[0].toUpperCase() + song.provenance.type.slice(1);
  lessonTuning.textContent = song.provenance.tuning.join(" · ");
  lessonSourceKey.textContent = song.key;
  lessonArrangementVersion.textContent = song.provenance.arrangementVersion;
  lessonSourceNote.textContent = trust.status === "source-backed"
    ? "These links support the details named below. Their authors do not endorse or review this Four Strings arrangement."
    : trust.status === "original"
      ? "Created for Four Strings from the user-provided note path; no external arrangement is claimed."
      : "No reliable playable ukulele score is attached, so demo and guided practice remain blocked.";
  const sourceItems = song.provenance.sources.flatMap((source) => {
    const href = safeLessonSourceUrl(source.url);
    if (!href) return [];
    const item = document.createElement("li");
    const link = document.createElement("a");
    const support = document.createElement("small");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.title;
    support.textContent = source.supports;
    item.append(link, support);
    return [item];
  });
  lessonSourceList.replaceChildren(...sourceItems);
  lessonSourceList.hidden = sourceItems.length === 0;
  lessonDownload.disabled = !exportAllowed;
  lessonDownload.textContent = exportAllowed ? "Download practice JSON" : "Practice JSON unavailable";
  lessonDownload.title = exportAllowed ? "" : "A reliable playable lesson is required before practice data can be exported.";
}

function renderLessonCue(): void {
  const { song, chapter, line, chord, gesture, events } = currentLessonGuidance();
  const melody = isMelodyChapter(chapter);
  const lineIndex = lessonDemoPlaying ? Math.max(0, lessonDemoLineIndex) : lessonPhase === "complete" ? song.lines.length - 1 : lessonLineIndex;
  const chordIndex = lessonDemoPlaying ? Math.max(0, lessonDemoChordIndex) : lessonChordIndex;
  const gestureIndex = lessonDemoPlaying ? Math.max(0, lessonDemoGestureIndex) : lessonPhase === "complete" ? events.length - 1 : Math.min(lessonGestureIndex, events.length - 1);

  lessonCue.dataset.state = lessonDemoPlaying
    ? "demo"
    : lessonPhase === "complete"
      ? "complete"
      : lessonPhase === "preview"
        ? "ready"
        : "practice";
  lessonCue.dataset.feedback = lessonFeedback;
  lessonCueMode.textContent = lessonDemoPlaying
    ? "Demo · follow along"
    : lessonPhase === "complete"
      ? "Chapter complete"
      : lessonPhase === "preview"
        ? "First move"
        : "Your turn · play this";
  lessonCueLine.textContent = `Part ${lineIndex + 1} · ${line.label}`;
  lessonCueNative.textContent = line.native ?? (melody ? "Beginner fingerpicking melody" : "Instrumental chord study");
  if (melody && gesture.kind === "pluck") {
    const fret = gesture.fret ?? 0;
    const position = getFretPosition(gesture.stringIndex, fret);
    lessonCueTargetLabel.textContent = "Note now";
    lessonCueChord.textContent = gesture.solfege ?? position.noteName;
    lessonCueFrets.textContent = `${physicalStringNumber(gesture.stringIndex)},${fret} · ${position.noteName}${gesture.quick ? " · quick" : ""}`;
    lessonCueShape.setAttribute("aria-label", `${position.noteName}, string ${physicalStringNumber(gesture.stringIndex)}, fret ${fret}`);
    lessonCueShape.replaceChildren(...UKULELE_STRINGS.map((stringInfo, index) => {
      const string = document.createElement("span");
      const active = index === gesture.stringIndex;
      string.className = `lesson-mini-string${active ? " is-note-target" : ""}`;
      string.innerHTML = `<b>${stringInfo.id}</b>${active ? `<i class="${fret === 0 ? "is-open" : ""}" style="--dot-y:${fret === 0 ? 21 : 35 + (fret - 0.5) * 14}px"></i>` : ""}`;
      return string;
    }));
  } else {
    const resolvedChord = chord!;
    const frets = LESSON_CHORDS[resolvedChord].frets;
    lessonCueTargetLabel.textContent = "Chord now";
    lessonCueChord.textContent = resolvedChord;
    lessonCueFrets.textContent = frets.map((fret, index) => `${UKULELE_STRINGS[index].id} ${fret}`).join(" · ");
    lessonCueShape.setAttribute("aria-label", `${resolvedChord} chord, frets ${frets.join(" ")}`);
    lessonCueShape.replaceChildren(...frets.map((fret, index) => {
      const string = document.createElement("span");
      string.className = "lesson-mini-string";
      string.innerHTML = `<b>${UKULELE_STRINGS[index].id}</b><i class="${fret === 0 ? "is-open" : ""}" style="--dot-y:${fret === 0 ? 21 : 35 + (fret - 0.5) * 14}px"></i>`;
      return string;
    }));
  }

  lessonCueBeat.textContent = `Move ${gestureIndex + 1} of ${events.length}`;
  lessonCueGesture.textContent = lessonGestureVisual(gesture);
  lessonGestureRail.style.setProperty("--lesson-steps", String(Math.min(8, Math.max(1, events.length))));
  lessonGestureRail.replaceChildren(
    ...events.map((event, index) => {
      const step = document.createElement("span");
      step.className = "lesson-gesture-step";
      step.classList.toggle("is-current", index === gestureIndex && lessonPhase !== "complete");
      step.classList.toggle(
        "is-complete",
        lessonPhase === "complete" || (lessonDemoPlaying ? index < gestureIndex : index < lessonGestureIndex),
      );
      step.textContent = lessonGestureMark(event);
      step.setAttribute("aria-label", `Move ${index + 1}: ${gestureInstruction(event)}`);
      return step;
    }),
  );

  if (gestureIndex + 1 < events.length) {
    lessonCueNext.textContent = lessonGestureVisual(events[gestureIndex + 1]);
    lessonCueNextDetail.textContent = melody ? lessonGestureDetail(events[gestureIndex + 1]) : `Stay on ${chord}`;
  } else if (melody && lineIndex + 1 < song.lines.length) {
    const nextNote = song.lines[lineIndex + 1].notes![0];
    lessonCueNext.textContent = `Part ${lineIndex + 2} · ${lessonGestureVisual(nextNote)}`;
    lessonCueNextDetail.textContent = song.lines[lineIndex + 1].label;
  } else if (!melody && chordIndex + 1 < line.chords.length) {
    const nextChord = line.chords[chordIndex + 1];
    lessonCueNext.textContent = `Change to ${nextChord}`;
    lessonCueNextDetail.textContent = LESSON_CHORDS[nextChord].frets.join("–");
  } else if (lineIndex + 1 < song.lines.length) {
    const nextChord = song.lines[lineIndex + 1].chords[0];
    lessonCueNext.textContent = `Part ${lineIndex + 2} · ${nextChord}`;
    lessonCueNextDetail.textContent = song.lines[lineIndex + 1].label;
  } else {
    lessonCueNext.textContent = lessonPhase === "lines" ? "Full run" : "Finish";
    lessonCueNextDetail.textContent = lessonPhase === "lines" ? chapter.fullPattern : "Let the last chord ring";
  }
}

function lessonGestureMark(gesture: LessonGesture): string {
  return gesture.kind === "pluck"
    ? gesture.fret === undefined ? String(physicalStringNumber(gesture.stringIndex)) : `${physicalStringNumber(gesture.stringIndex)}·${gesture.fret}`
    : gesture.direction === "down" ? "↓" : "↑";
}

function lessonGestureVisual(gesture: LessonGesture): string {
  if (gesture.kind === "pluck") {
    if (gesture.fret !== undefined) {
      const position = getFretPosition(gesture.stringIndex, gesture.fret);
      return `${physicalStringNumber(gesture.stringIndex)},${gesture.fret} · ${gesture.solfege ?? position.noteName}`;
    }
    return `${physicalStringNumber(gesture.stringIndex)} · ${UKULELE_STRINGS[gesture.stringIndex].id} string`;
  }
  return `${gesture.direction === "down" ? "↓" : "↑"} ${gesture.direction === "down" ? "Down-strum" : "Up-strum"}`;
}

function lessonGestureDetail(gesture: LessonGesture): string {
  if (gesture.kind !== "pluck") return gestureInstruction(gesture);
  const fret = gesture.fret ?? 0;
  const position = getFretPosition(gesture.stringIndex, fret);
  return `String ${physicalStringNumber(gesture.stringIndex)} ${position.stringId} · ${fret === 0 ? "open" : `fret ${fret}`}${gesture.quick ? " · quick transition" : ""}`;
}

function startLessonDemo(): void {
  if (!canPracticeLessonSong(currentSong())) return;
  if (!audio.isReady) {
    lessonStatus.textContent = "Enable sound on the instrument below before starting the demo.";
    return;
  }
  stopReferenceAudio();
  stopLessonDemo();
  lessonDemoPlaying = true;
  lessonFeedback = "neutral";
  const song = currentSong();
  const chapter = song.chapters[selectedChapterIndex];
  const beatMs = 60_000 / chapter.bpm;
  let chordOffset = 0;
  lessonStatus.textContent = `Playing the ${song.lines.length}-part ${chapter.shortTitle.toLowerCase()} example at ${chapter.bpm} BPM.`;
  renderLesson();

  if (isMelodyChapter(chapter)) {
    song.lines.forEach((line, lineIndex) => {
      const events = lessonLineEvents(line, chapter, "full");
      if (chapter.backing && line.chords.length > 0) {
        const chordSpacing = lessonLineBeats(line, chapter) / line.chords.length;
        line.chords.forEach((chord, chordIndex) => {
          lessonTimers.push(window.setTimeout(() => {
            audio.playTogether(chordMidiNotes(chord), 0.3);
            showReferenceStrings();
          }, chordOffset + chordIndex * chordSpacing * beatMs));
        });
      }
      events.forEach((gesture, gestureIndex) => {
        lessonTimers.push(
          window.setTimeout(() => {
            lessonDemoLineIndex = lineIndex;
            lessonDemoChordIndex = 0;
            lessonDemoGestureIndex = gestureIndex;
            playLessonMelodyGesture(gesture);
            renderLesson();
          }, chordOffset + gesture.beat * beatMs),
        );
      });
      chordOffset += lessonLineBeats(line, chapter) * beatMs;
    });
  } else {
    const events = chapter.fullEvents;
    song.lines.forEach((line, lineIndex) => {
      line.chords.forEach((chord, chordIndex) => {
        events.forEach((gesture, gestureIndex) => {
          lessonTimers.push(
            window.setTimeout(() => {
              lessonDemoLineIndex = lineIndex;
              lessonDemoChordIndex = chordIndex;
              lessonDemoGestureIndex = gestureIndex;
              playLessonDemoGesture(chord, gesture);
              renderLesson();
            }, chordOffset + gesture.beat * beatMs),
          );
        });
        chordOffset += song.beatsPerBar * beatMs;
      });
    });
  }

  lessonTimers.push(
    window.setTimeout(() => stopLessonDemo("Demo finished. Start practice and take it one line at a time."), chordOffset + 180),
  );
}

function playLessonMelodyGesture(gesture: LessonGesture): void {
  if (gesture.kind !== "pluck") return;
  const fret = gesture.fret ?? 0;
  const position = getFretPosition(gesture.stringIndex, fret);
  audio.pluckString(gesture.stringIndex, position.midi, 0.68);
  showPluck(gesture.stringIndex, position.noteName, fret);
  readoutLabel.textContent = "Lesson demo";
  noteOrb.textContent = gesture.solfege ?? position.noteName.replace(/\d+$/, "");
  lastNote.textContent = `${physicalStringNumber(gesture.stringIndex)},${fret} · ${position.noteName}${gesture.quick ? " · quick transition" : ""}`;
}

function playLessonDemoGesture(chord: ChordName, gesture: LessonGesture): void {
  const midis = chordMidiNotes(chord);
  if (gesture.kind === "strum") {
    audio.strum(midis, gesture.direction, 0.66);
    const indices = gesture.direction === "down" ? [0, 1, 2, 3] : [3, 2, 1, 0];
    indices.forEach((stringIndex, order) => window.setTimeout(() => showStringFeedback(stringIndex), order * 24));
  } else {
    audio.pluckString(gesture.stringIndex, midis[gesture.stringIndex], 0.68);
    showStringFeedback(gesture.stringIndex);
  }
  readoutLabel.textContent = "Chapter demo";
  noteOrb.textContent = chord;
  lastNote.textContent = `${chord} chord · frets ${LESSON_CHORDS[chord].frets.join("–")} · ${LESSON_CHORDS[chord].frets
    .map((fret, stringIndex) => getFretPosition(stringIndex, fret).noteName)
    .join(" · ")}`;
  showRipple();
}

function stopLessonDemo(message?: string): void {
  lessonTimers.forEach((timer) => window.clearTimeout(timer));
  lessonTimers = [];
  const wasPlaying = lessonDemoPlaying;
  lessonDemoPlaying = false;
  lessonDemoLineIndex = -1;
  lessonDemoChordIndex = -1;
  lessonDemoGestureIndex = -1;
  if (wasPlaying) {
    audio.stopAllVoices();
    lessonMicIgnoreUntil = performance.now() + 180;
  }
  if (message && wasPlaying) lessonStatus.textContent = message;
  if (wasPlaying) renderLesson();
}

function lessonTakeKey(): string {
  return `four-strings-lesson-take:${currentSong().id}:${currentSong().chapters[selectedChapterIndex].id}`;
}

function loadSavedLessonTake(): SavedTake | null {
  try {
    return parseSavedTake(window.localStorage.getItem(lessonTakeKey()));
  } catch {
    return null;
  }
}

async function startLessonTakeRecording(): Promise<void> {
  if (!(await ensureReferenceAudio(lessonTakeStatus))) return;
  stopReferenceAudio();
  stopLessonDemo();
  stopLessonTakePlayback();
  lessonTakeRecording = true;
  lessonTakeStartedAt = performance.now();
  lessonTakeEvents = [];
  lessonTakeStopTimer = window.setTimeout(finishLessonTakeRecording, MAX_TAKE_DURATION_MS);
  renderLessonTakeControls();
}

function finishLessonTakeRecording(): void {
  if (!lessonTakeRecording) return;
  window.clearTimeout(lessonTakeStopTimer);
  lessonTakeStopTimer = 0;
  lessonTakeRecording = false;
  const duration = Math.min(MAX_TAKE_DURATION_MS, performance.now() - lessonTakeStartedAt);
  if (lessonTakeEvents.length > 0) {
    const take = createSavedTake(currentSong().id, currentSong().chapters[selectedChapterIndex].id, duration, lessonTakeEvents);
    try {
      window.localStorage.setItem(lessonTakeKey(), JSON.stringify(take));
    } catch {
      lessonTakeStatus.textContent = "This browser could not save the take, but your lesson can continue.";
    }
  }
  renderLessonTakeControls();
}

function captureLessonTakeNote(stringIndex: number, fret: number, velocity: number, offsetMs = 0): void {
  if (
    !lessonTakeRecording ||
    currentView !== "chapters" ||
    lessonDemoPlaying ||
    lessonTakePlaying ||
    referencePlayback !== null ||
    lessonTakeEvents.length >= MAX_TAKE_EVENTS
  ) return;
  const atMs = Math.min(MAX_TAKE_DURATION_MS, performance.now() - lessonTakeStartedAt + offsetMs);
  lessonTakeEvents.push({ atMs, stringIndex, fret, velocity });
  lessonTakeStatus.textContent = `Recording · ${lessonTakeEvents.length} ${lessonTakeEvents.length === 1 ? "note" : "notes"} captured`;
}

async function playSavedLessonTake(): Promise<void> {
  const take = loadSavedLessonTake();
  if (!take || take.events.length === 0) return;
  if (!(await ensureReferenceAudio(lessonTakeStatus))) return;
  stopReferenceAudio();
  stopLessonDemo();
  if (lessonTakeRecording) finishLessonTakeRecording();
  lessonTakePlaying = true;
  take.events.forEach((event) => {
    lessonTakeTimers.push(window.setTimeout(() => {
      const position = getFretPosition(event.stringIndex, event.fret);
      audio.pluckString(event.stringIndex, position.midi, event.velocity);
      showPluck(event.stringIndex, position.noteName, event.fret);
    }, event.atMs));
  });
  lessonTakeTimers.push(window.setTimeout(() => stopLessonTakePlayback(), Math.max(take.durationMs, take.events.at(-1)?.atMs ?? 0) + 900));
  renderLessonTakeControls();
}

function stopLessonTakePlayback(): void {
  const wasPlaying = lessonTakePlaying;
  lessonTakeTimers.forEach((timer) => window.clearTimeout(timer));
  lessonTakeTimers = [];
  lessonTakePlaying = false;
  if (wasPlaying) audio.stopAllVoices();
  renderLessonTakeControls();
}

function clearSavedLessonTake(): void {
  stopLessonTakePlayback();
  try {
    window.localStorage.removeItem(lessonTakeKey());
  } catch {
    // A blocked storage area behaves like an empty take library.
  }
  renderLessonTakeControls();
}

function renderLessonTakeControls(): void {
  const take = loadSavedLessonTake();
  lessonTakeRecord.classList.toggle("is-recording", lessonTakeRecording);
  lessonTakeRecord.setAttribute("aria-pressed", String(lessonTakeRecording));
  lessonTakeRecord.textContent = lessonTakeRecording ? "Stop & save" : "Record take";
  lessonTakePlay.classList.toggle("is-playing", lessonTakePlaying);
  lessonTakePlay.setAttribute("aria-pressed", String(lessonTakePlaying));
  lessonTakePlay.textContent = lessonTakePlaying ? "Stop playback" : "Play saved";
  lessonTakeRecord.disabled = lessonInput === "real";
  lessonTakePlay.disabled = lessonInput === "real" || lessonTakeRecording || (!take && !lessonTakePlaying);
  lessonTakeClear.disabled = lessonInput === "real" || lessonTakeRecording || lessonTakePlaying || !take;
  lessonTakeStatus.textContent = lessonTakeRecording
    ? `Recording · ${lessonTakeEvents.length} ${lessonTakeEvents.length === 1 ? "note" : "notes"} captured`
    : lessonTakePlaying
      ? "Playing your saved take through the sampled ukulele"
      : take
        ? `${take.events.length} ${take.events.length === 1 ? "note" : "notes"} · ${(take.durationMs / 1000).toFixed(1)}s · saved on this device`
        : lessonInput === "real"
          ? "Recording and replay are unavailable for real ukulele input · microphone audio is never stored"
          : "No take saved for this chapter";
}

function setLessonInput(input: LessonInput): void {
  if (lessonInput === input) return;
  stopLessonMicrophone();
  stopReferenceAudio();
  stopLessonDemo();
  stopLessonTakePlayback();
  if (lessonTakeRecording) finishLessonTakeRecording();
  lessonInput = input;
  storePreference("four-strings-lesson-input", input);
  resetLesson(`${input === "real" ? "Real ukulele" : "On-screen ukulele"} selected. Start practice when ready.`);
}

function renderLessonInput(): void {
  const real = lessonInput === "real";
  lessonInputScreen.classList.toggle("is-selected", !real);
  lessonInputReal.classList.toggle("is-selected", real);
  lessonInputScreen.setAttribute("aria-pressed", String(!real));
  lessonInputReal.setAttribute("aria-pressed", String(real));
  lessonRealChecks.hidden = !real || isMelodyChapter(currentSong().chapters[selectedChapterIndex]);
  lessonTake.hidden = false;
  instrumentFrame.hidden = currentView === "chapters" && real;
  performanceReadout.hidden = currentView === "chapters" && real;
  clearButton.hidden = currentView === "chapters" && real;
  lessonInputNote.textContent = real
    ? isMelodyChapter(currentSong().chapters[selectedChapterIndex])
      ? "Microphone confirms the expected pitch after a clear attack. It cannot identify the exact ukulele string. Repeated notes need a fresh pluck."
      : "Microphone counts clear strum attacks. Confirm the shown chord shape and arrow yourself; audio cannot identify shape or direction."
    : "Use the instrument below; Four Strings checks the exact string, fret, shape, and direction.";
  if (real && !tuner.isListening && lessonPhase === "preview") {
    lessonHeardStatus.dataset.state = "idle";
    lessonHeardStatus.textContent = "Expected and heard status appears after you start practice.";
  }
}

async function startLessonMicrophone(): Promise<void> {
  lessonHeardStatus.dataset.state = "requesting";
  lessonHeardStatus.textContent = "Requesting microphone access…";
  await tuner.start(handleLessonMicReading, handleLessonMicStatus);
}

function stopLessonMicrophone(): void {
  if (lessonInput === "real") tuner.stop();
  lessonPitchConfirmation.reset();
  lessonStrumCounter.reset();
}

function handleLessonMicStatus(status: TunerStatus, message: string): void {
  if (currentView !== "chapters" || lessonInput !== "real") return;
  lessonHeardStatus.dataset.state = status;
  lessonHeardStatus.textContent = status === "error" ? `${message} Press Reset practice, then Start practice to retry.` : message;
}

function midiFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function handleLessonMicReading(reading: PitchReading | null, signal: SignalFrame): void {
  if (currentView !== "chapters" || lessonInput !== "real" || lessonDemoPlaying || referencePlayback !== null || signal.at < lessonMicIgnoreUntil) return;
  if (lessonPhase !== "lines" && lessonPhase !== "full") return;
  const { chapter, gesture } = currentLessonGuidance();
  if (isMelodyChapter(chapter) && gesture.kind === "pluck") {
    const expected = getFretPosition(gesture.stringIndex, gesture.fret ?? 0);
    const result = lessonPitchConfirmation.update(reading?.frequency ?? null, midiFrequency(expected.midi), signal.rms, signal.at);
    const heard = reading ? `${reading.frequency.toFixed(1)} Hz` : "waiting for a clear attack";
    lessonHeardStatus.dataset.state = result.accepted ? "accepted" : "listening";
    lessonHeardStatus.textContent = `Expected ${expected.noteName} · Heard ${heard} · ${result.accepted ? "Accepted" : `confirming ${result.stableFrames}/3`}`;
    if (result.accepted) {
      lessonGestureIndex += 1;
      lessonFeedback = "success";
      const events = lessonLineEvents(currentSong().lines[lessonLineIndex], chapter, lessonPhase);
      if (lessonGestureIndex >= events.length) advanceLessonLine();
      else {
        const next = events[lessonGestureIndex];
        if (next.kind === "pluck") lessonPitchConfirmation.nextExpected(midiFrequency(getFretPosition(next.stringIndex, next.fret ?? 0).midi));
        renderLesson();
      }
    }
    return;
  }
  if (!lessonStrumCounter.update(signal.rms, signal.at)) return;
  if (!lessonShapeCheck.checked || !lessonDirectionCheck.checked) {
    lessonHeardStatus.dataset.state = "error";
    lessonHeardStatus.textContent = `Expected ${lessonGestureVisual(gesture)} · Heard strum attack · Confirm the shown shape and direction, then try again.`;
    return;
  }
  lessonHeardStatus.dataset.state = "accepted";
  lessonHeardStatus.textContent = `Expected ${lessonGestureVisual(gesture)} · Heard strum attack · Shape and direction self-checked · Accepted`;
  lessonShapeCheck.checked = false;
  lessonDirectionCheck.checked = false;
  lessonGestureIndex += 1;
  const events = lessonLineEvents(currentSong().lines[lessonLineIndex], chapter, lessonPhase);
  if (lessonGestureIndex >= events.length) advanceLessonChord();
  else renderLesson();
}

function handleLessonGesture(gesture: LessonGesture): void {
  if (currentView !== "chapters" || lessonInput !== "screen" || lessonDemoPlaying || (lessonPhase !== "lines" && lessonPhase !== "full")) return;
  const song = currentSong();
  const line = song.lines[lessonLineIndex];
  const chapter = song.chapters[selectedChapterIndex];
  const expectedEvents = lessonLineEvents(line, chapter, lessonPhase);
  const expected = expectedEvents[lessonGestureIndex];

  if (isMelodyChapter(chapter)) {
    const actualFret = gesture.kind === "pluck" ? state.getEffectiveFret(gesture.stringIndex) : -1;
    const correct = expected?.kind === "pluck" &&
      gesture.kind === "pluck" &&
      expected.stringIndex === gesture.stringIndex &&
      (expected.fret ?? 0) === actualFret;
    if (!correct) {
      lessonFeedback = "try-again";
      lessonStatus.textContent = `Next: ${gestureInstruction(expected)}. Follow the coral string-and-fret target.`;
      renderLesson();
      return;
    }
    lessonGestureIndex += 1;
    lessonFeedback = "success";
    if (lessonGestureIndex < expectedEvents.length) {
      lessonStatus.textContent = `${lessonGestureVisual(expected)} sounds right. Next: ${gestureInstruction(expectedEvents[lessonGestureIndex])}.`;
      renderLesson();
      return;
    }
    advanceLessonLine();
    return;
  }

  const chord = line.chords[lessonChordIndex];
  const frets = getCurrentShape().map((position) => position.fret);
  if (!matchesChord(frets, chord)) {
    lessonFeedback = "try-again";
    lessonStatus.textContent = `Shape check: ${chord} needs ${LESSON_CHORDS[chord].frets.join("–")}. You have ${frets.join("–")}.`;
    renderLesson();
    return;
  }

  const correct =
    expected.kind === gesture.kind &&
    (expected.kind === "pluck"
      ? gesture.kind === "pluck" && expected.stringIndex === gesture.stringIndex
      : gesture.kind === "strum" && expected.direction === gesture.direction);
  if (!correct) {
    lessonFeedback = "try-again";
    lessonStatus.textContent = `Keep the ${chord} shape. Next: ${gestureInstruction(expected)}.`;
    renderLesson();
    return;
  }

  lessonGestureIndex += 1;
  lessonFeedback = "success";
  if (lessonGestureIndex < expectedEvents.length) {
    lessonStatus.textContent = `${chord} sounds right. Next: ${gestureInstruction(expectedEvents[lessonGestureIndex])}.`;
    renderLesson();
    return;
  }
  advanceLessonChord();
}

function advanceLessonLine(): void {
  lessonGestureIndex = 0;
  lessonChordIndex = 0;
  lessonFeedback = "neutral";
  const song = currentSong();
  lessonLineIndex += 1;
  if (lessonLineIndex < song.lines.length) {
    const next = song.lines[lessonLineIndex].notes![0];
    lessonPitchConfirmation.nextExpected(midiFrequency(getFretPosition(next.stringIndex, next.fret ?? 0).midi));
    lessonStatus.textContent = `Part ${lessonLineIndex} complete. Next: ${gestureInstruction(next)} for “${song.lines[lessonLineIndex].label}”.`;
    renderLesson();
    return;
  }
  if (lessonPhase === "lines") {
    lessonPhase = "full";
    lessonLineIndex = 0;
    const next = song.lines[0].notes![0];
    lessonPitchConfirmation.nextExpected(midiFrequency(getFretPosition(next.stringIndex, next.fret ?? 0).midi));
    lessonStatus.textContent = `All ${song.lines.length} parts learned. Now connect the full melody without stopping.`;
  } else {
    lessonPhase = "complete";
    lessonLineIndex = song.lines.length - 1;
    lessonStatus.textContent = "Chapter complete. Your notes stayed connected from the first phrase to the last.";
  }
  renderLesson();
}

function advanceLessonChord(): void {
  lessonGestureIndex = 0;
  lessonFeedback = "neutral";
  const song = currentSong();
  const line = song.lines[lessonLineIndex];
  if (lessonChordIndex + 1 < line.chords.length) {
    lessonChordIndex += 1;
    const next = line.chords[lessonChordIndex];
    lessonStatus.textContent = `Good pulse. Change to ${next} (${LESSON_CHORDS[next].frets.join("–")}) and repeat the pattern.`;
    renderLesson();
    return;
  }

  lessonChordIndex = 0;
  lessonLineIndex += 1;
  if (lessonLineIndex < song.lines.length) {
    const next = song.lines[lessonLineIndex].chords[0];
    lessonStatus.textContent = `Part ${lessonLineIndex} complete. Part ${lessonLineIndex + 1} starts on ${next}.`;
    renderLesson();
    return;
  }

  if (lessonPhase === "lines") {
    lessonPhase = "full";
    lessonLineIndex = 0;
    lessonChordIndex = 0;
    lessonStatus.textContent = `All ${song.lines.length} parts learned. Now play the full run with ${song.chapters[selectedChapterIndex].fullPattern}.`;
  } else {
    lessonPhase = "complete";
    lessonLineIndex = song.lines.length - 1;
    lessonStatus.textContent = "Chapter complete. That was the whole study — steady, musical, and yours.";
  }
  renderLesson();
}

function gestureInstruction(gesture: LessonGesture): string {
  return gesture.kind === "pluck"
    ? `pick string ${physicalStringNumber(gesture.stringIndex)} (${UKULELE_STRINGS[gesture.stringIndex].id})${gesture.fret === undefined ? "" : ` at fret ${gesture.fret}`}`
    : `${gesture.direction === "down" ? "down" : "up"}-strum`;
}

function clearHeldPointers(): void {
  activeFretPointers.clear();
  strumPointers.clear();
  state.clearHeldFrets();
  renderInstrumentState();
}

function focusFretCell(stringIndex: number, fret: number): void {
  const button = fretButtons.get(cellKey(stringIndex, fret));
  button?.focus({ preventScroll: true });
  button?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

function stringIndexFromClientY(clientY: number): number {
  const rect = strumSurface.getBoundingClientRect();
  const ratio = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height));
  return Math.floor(ratio * UKULELE_STRINGS.length);
}

function setAudioStatus(status: "idle" | "loading" | "ready" | "muted" | "error", text: string): void {
  audioStatus.dataset.status = status;
  audioStatusText.textContent = text;
}

function updateInputHint(): void {
  const hasTouch = navigator.maxTouchPoints > 0;
  if (currentView === "chapters") {
    const chapter = currentSong().chapters[selectedChapterIndex];
    const currentGesture = currentLessonGuidance().gesture;
    inputHint.innerHTML =
      isMelodyChapter(chapter) && currentGesture.kind === "pluck"
        ? `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Your turn:</strong> set ${physicalStringNumber(currentGesture.stringIndex)},${currentGesture.fret ?? 0} on the neck, then pick that body string</span>`
        : currentGesture.kind === "pluck"
        ? `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Your turn:</strong> hold the shown chord, then tap body strings 3 · 2 · 1 · 2</span>`
        : `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Your turn:</strong> form the highlighted chord, then sweep the shown rhythm</span>`;
    return;
  }
  if (currentView === "practice") {
    const stage = currentPracticeStage();
    inputHint.innerHTML = stage.targetKind === "strings"
      ? `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Practice:</strong> tap the highlighted body string, or use keys 1–4</span>`
      : `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Practice:</strong> form the target shape, then play it on the body</span>`;
    return;
  }
  if (currentView === "coach" && practiceInput === "screen") {
    inputHint.innerHTML = coachDrill === "strings"
      ? `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Coach:</strong> play the highlighted open string on the body, or use keys 1–4</span>`
      : `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Coach:</strong> tap the body for down-strums and follow the eight beats</span>`;
    return;
  }
  if (state.mode === "explore") {
    inputHint.innerHTML = `<span class="input-icon" aria-hidden="true">${hasTouch ? handIcon() : pointerIcon()}</span><span><strong>Fingerpick:</strong> tap frets to hear them; Add notes builds the pattern</span>`;
    return;
  }
  inputHint.innerHTML = hasTouch
    ? handLayout === "one"
      ? `<span class="input-icon" aria-hidden="true">${handIcon()}</span><span><strong>One hand:</strong> tap frets to latch, then play the body</span>`
      : `<span class="input-icon" aria-hidden="true">${handIcon()}</span><span><strong>Two hands:</strong> hold the neck while the other hand strums</span>`
    : `<span class="input-icon" aria-hidden="true">${pointerIcon()}</span><span><strong>Body:</strong> click for all four together; drag to strum</span>`;
}

function handIcon(): string {
  return '<svg viewBox="0 0 24 24"><path d="M8.5 4.5v9.25M12 3.5v10.25M15.5 5v8.75M7 13.75c-1.5 0-2.5 1-2.5 2.25s1 2.25 2.5 2.25h8.5c2.2 0 4-1.8 4-4v-2.5"/></svg>';
}

function pointerIcon(): string {
  return '<svg viewBox="0 0 24 24"><path d="m7 4 10 9-5 .5L9.5 18 7 4Z"/></svg>';
}

function getFretCell(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest<HTMLButtonElement>(".fret-cell") : null;
}

function cellPosition(cell: HTMLButtonElement): { stringIndex: number; fret: number } {
  return { stringIndex: Number(cell.dataset.string), fret: Number(cell.dataset.fret) };
}

function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`;
}

function physicalStringNumber(stringIndex: number): number {
  return UKULELE_STRINGS.length - stringIndex;
}

function isFormControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, select, summary, .control-ribbon button, .view-subnav button, .instrument-source-choice button, .pattern-builder button, .audio-gate, .lesson-workbench button, .tuner-workbench button, .coach-workbench button, .ai-coach-workbench button, .practice-workbench button"));
}

function tryCapturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic test events are not registered as active browser pointers.
  }
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function storedPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are optional when storage is unavailable.
  }
}
