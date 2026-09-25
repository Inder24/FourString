import type { ChordName } from "./lesson";
import type { StrumDirection } from "./music";

export type CourseId = "foundations-v1";
export type CourseInput = "screen" | "real";
export type CourseStage = "see" | "hear" | "guess" | "play" | "check" | "recap";

export const COURSE_STAGES: readonly CourseStage[] = ["see", "hear", "guess", "play", "check", "recap"];

interface CourseActivityBase {
  id: string;
  stage: CourseStage;
  title: string;
  instruction: string;
  required: boolean;
  supportedInputs: readonly CourseInput[];
}

export interface ExplainActivity extends CourseActivityBase {
  kind: "explain";
  visual: "ukulele" | "pitch-stairs" | "scale-path" | "beat-grid" | "chord-stack" | "progression" | "waveform";
  referenceNotes?: readonly number[];
}

export interface SelfCheckActivity extends CourseActivityBase {
  kind: "self-check";
  checks: readonly string[];
}

export interface EarChoiceActivity extends CourseActivityBase {
  kind: "ear-choice";
  question: string;
  choices: readonly string[];
  correctChoice: string;
  referenceNotes: readonly number[];
}

export interface CourseNote {
  stringIndex: number;
  fret: number;
  midi: number;
  sargam?: string;
  western: string;
}

export interface NoteSequenceActivity extends CourseActivityBase {
  kind: "note-sequence";
  notes: readonly CourseNote[];
  bpm: number;
}

export interface ChordActivity extends CourseActivityBase {
  kind: "chord";
  chords: readonly ChordName[];
  bpm: number;
}

export interface RhythmActivity extends CourseActivityBase {
  kind: "rhythm";
  bpm: number;
  strokes: readonly { slot: number; direction: StrumDirection; sounded: boolean }[];
}

export interface ComposeActivity extends CourseActivityBase {
  kind: "compose";
  noteCount: number;
  allowedMidi: readonly number[];
}

export interface PerformanceActivity extends CourseActivityBase {
  kind: "performance";
  bpm: number;
  chords: readonly ChordName[];
  strokes: readonly { slot: number; direction: StrumDirection; sounded: boolean }[];
}

export type CourseActivity =
  | ExplainActivity
  | SelfCheckActivity
  | EarChoiceActivity
  | NoteSequenceActivity
  | ChordActivity
  | RhythmActivity
  | ComposeActivity
  | PerformanceActivity;

export interface CourseUnit {
  id: string;
  number: number;
  title: string;
  description: string;
  lessonIds: readonly string[];
}

export interface CourseLesson {
  id: string;
  number: number;
  unitId: string;
  title: string;
  durationMinutes: number;
  objective: string;
  concept: string;
  primaryTerms: readonly string[];
  westernTerms: readonly string[];
  activityLabels: readonly string[];
  activities: readonly CourseActivity[];
  secureActivityId: string;
}

type PlayDefinition =
  | Omit<SelfCheckActivity, keyof CourseActivityBase | "id" | "stage">
  | Omit<NoteSequenceActivity, keyof CourseActivityBase | "id" | "stage">
  | Omit<ChordActivity, keyof CourseActivityBase | "id" | "stage">
  | Omit<RhythmActivity, keyof CourseActivityBase | "id" | "stage">
  | Omit<ComposeActivity, keyof CourseActivityBase | "id" | "stage">
  | Omit<PerformanceActivity, keyof CourseActivityBase | "id" | "stage">;

interface LessonSeed {
  id: string;
  title: string;
  objective: string;
  concept: string;
  primaryTerms?: readonly string[];
  westernTerms?: readonly string[];
  duration?: number;
  visual: ExplainActivity["visual"];
  hearNotes: readonly number[];
  guess: { choices: readonly string[]; correctChoice: string };
  play: PlayDefinition;
  labels: readonly string[];
}

const INPUTS: readonly CourseInput[] = ["screen", "real"];
const C_SCALE: readonly CourseNote[] = [
  { stringIndex: 1, fret: 0, midi: 60, sargam: "Sa", western: "C4" },
  { stringIndex: 1, fret: 2, midi: 62, sargam: "Re", western: "D4" },
  { stringIndex: 2, fret: 0, midi: 64, sargam: "Ga", western: "E4" },
  { stringIndex: 2, fret: 1, midi: 65, sargam: "Ma", western: "F4" },
  { stringIndex: 2, fret: 3, midi: 67, sargam: "Pa", western: "G4" },
  { stringIndex: 3, fret: 0, midi: 69, sargam: "Dha", western: "A4" },
  { stringIndex: 3, fret: 2, midi: 71, sargam: "Ni", western: "B4" },
  { stringIndex: 3, fret: 3, midi: 72, sargam: "Sa", western: "C5" },
];

const DOWN_QUARTERS = [0, 2, 4, 6].map((slot) => ({ slot, direction: "down" as const, sounded: true }));
const EIGHTHS = Array.from({ length: 8 }, (_, slot) => ({ slot, direction: slot % 2 ? "up" as const : "down" as const, sounded: true }));
const ISLAND = [
  { slot: 0, direction: "down" as const, sounded: true },
  { slot: 1, direction: "up" as const, sounded: false },
  { slot: 2, direction: "down" as const, sounded: true },
  { slot: 3, direction: "up" as const, sounded: true },
  { slot: 4, direction: "down" as const, sounded: false },
  { slot: 5, direction: "up" as const, sounded: true },
  { slot: 6, direction: "down" as const, sounded: true },
  { slot: 7, direction: "up" as const, sounded: true },
];

const unitDefinitions = [
  ["instrument", "Instrument & first sound", "Hold it comfortably, hear its four voices, and find a steady pulse."],
  ["sargam", "Sargam & the fretboard", "Use Sa as home, map the scale, and recognise musical movement."],
  ["rhythm", "Beat, bar & rhythm", "See time, divide it evenly, and answer rhythms by ear."],
  ["right-hand", "Right-hand craft", "Shape tone with the thumb, fingerpick clearly, and build a flowing strum."],
  ["harmony", "Chords & harmony", "See how notes combine and hear tension return home."],
  ["accompaniment", "Changes & accompaniment", "Connect shapes, recognise progressions, and support a musical phrase."],
  ["musicianship", "Melody, memory & invention", "Match melody with harmony, remember by ear, and make a phrase."],
  ["expression", "Expression & performance", "Control accents, feel syncopation, and complete a final music lab."],
] as const;

const GUESS_QUESTIONS: Readonly<Record<string, string>> = {
  "your-ukulele": "Which part lets the ukulele body project the sound?",
  "four-strings": "Which open-string order did you hear?",
  "find-the-pulse": "Which pulse best matches the example?",
  "find-sa": "Where did the phrase finally settle?",
  "climb-sargam": "Which opening Sargam path did you hear?",
  "steps-skips-echoes": "Did the notes move by a step or a skip?",
  "beat-bar-four-four": "How many steady beats completed the bar?",
  "split-the-beat": "How was each beat divided?",
  "rhythm-echo": "Which rhythm matches the example?",
  "right-hand-sound": "Which right-hand choice can make a clear tone?",
  "fingerpicking-flow": "Which string-number path did you hear?",
  "strumming-vocabulary": "Which strumming pattern matches the example?",
  "notes-become-chord": "Which three scale tones formed the chord?",
  "first-chord-family": "Which chord colour did you hear?",
  "tension-comes-home": "Where did the cadence want to go?",
  "clean-chord-changes": "Which chord order did you hear?",
  "hear-progression": "Which progression matches the loop?",
  "accompany-phrase": "What should the accompaniment follow?",
  "melody-over-harmony": "Which chord supports this melody?",
  "hear-hide-remember": "Which hidden note path did you hear?",
  "musical-sentence": "What made the phrase feel complete?",
  "dynamics-accents": "Where did the strongest accent land?",
  "syncopation-groove": "Which groove placed sounds off the beat?",
  "final-music-lab": "Which chord journey powered the study?",
};

const lessonSeeds: readonly LessonSeed[] = [
  { id: "your-ukulele", title: "Your ukulele and you", objective: "Name the main parts and settle into a relaxed playing hold.", concept: "A balanced instrument and loose wrist make every later movement easier.", visual: "ukulele", hearNotes: [60, 64, 67, 69], guess: { choices: ["Neck", "Bridge", "Sound hole"], correctChoice: "Sound hole" }, play: { kind: "self-check", checks: ["Body rests without squeezing", "Neck points slightly upward", "Shoulders stay loose", "Strumming wrist can swing"] }, labels: ["Theory", "Posture"] },
  { id: "four-strings", title: "Four strings, four voices", objective: "Recognise and play open G, C, E, and A.", concept: "High-G tuning is re-entrant: string 4 is higher than the open C beside it.", visual: "ukulele", hearNotes: [67, 60, 64, 69], guess: { choices: ["G · C · E · A", "A · E · C · G", "C · D · E · F"], correctChoice: "G · C · E · A" }, play: { kind: "note-sequence", notes: [{ stringIndex: 0, fret: 0, midi: 67, western: "G4" }, { stringIndex: 1, fret: 0, midi: 60, western: "C4" }, { stringIndex: 2, fret: 0, midi: 64, western: "E4" }, { stringIndex: 3, fret: 0, midi: 69, western: "A4" }], bpm: 60 }, labels: ["Ear", "Play"] },
  { id: "find-the-pulse", title: "Find the pulse", objective: "Feel a steady beat and place one down-strum on each pulse.", concept: "Tempo tells us how quickly the beat repeats; the beat itself stays even.", visual: "beat-grid", hearNotes: [60, 60, 60, 60], guess: { choices: ["60 BPM", "72 BPM", "No pulse"], correctChoice: "60 BPM" }, play: { kind: "rhythm", bpm: 60, strokes: DOWN_QUARTERS }, labels: ["Rhythm", "Strum"] },
  { id: "find-sa", title: "Find Sa", objective: "Hear Sa as home and locate course Sa on open C.", concept: "Sa is a movable musical home. In Book One we choose C as Sa so every exercise shares one map.", primaryTerms: ["Sa"], westernTerms: ["C"], visual: "pitch-stairs", hearNotes: [60, 62, 60], guess: { choices: ["Higher", "Lower", "Home"], correctChoice: "Home" }, play: { kind: "note-sequence", notes: [C_SCALE[0], C_SCALE[0]], bpm: 54 }, labels: ["Sargam", "Ear", "Play"] },
  { id: "climb-sargam", title: "Climb Sargam", objective: "Play Sa through high Sa and return calmly.", concept: "A scale orders notes from one Sa to the next; descending reverses the same path.", primaryTerms: ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni", "Sa"], westernTerms: ["C", "D", "E", "F", "G", "A", "B", "C"], visual: "scale-path", hearNotes: C_SCALE.map((note) => note.midi), guess: { choices: ["Sa · Re · Ga", "Sa · Ga · Re", "Pa · Dha · Sa"], correctChoice: "Sa · Re · Ga" }, play: { kind: "note-sequence", notes: [...C_SCALE, ...[...C_SCALE].reverse()], bpm: 54 }, labels: ["Sargam", "Fingerpick"] },
  { id: "steps-skips-echoes", title: "Steps, skips, and echoes", objective: "Hear adjacent notes, leaps, and a short melodic echo.", concept: "A step moves to a neighbour; a skip jumps over at least one scale note.", visual: "pitch-stairs", hearNotes: [60, 62, 65], guess: { choices: ["Step then skip", "Two steps", "Two skips"], correctChoice: "Step then skip" }, play: { kind: "note-sequence", notes: [C_SCALE[0], C_SCALE[1], C_SCALE[3]], bpm: 58 }, labels: ["Ear", "Memory"] },
  { id: "beat-bar-four-four", title: "Beat, bar, and 4/4", objective: "Count and strum two complete bars of four.", concept: "A bar groups repeating beats. In 4/4, four quarter-note beats complete the measure.", visual: "beat-grid", hearNotes: [60, 60, 60, 60], guess: { choices: ["Three beats", "Four beats", "Eight beats"], correctChoice: "Four beats" }, play: { kind: "rhythm", bpm: 68, strokes: [...DOWN_QUARTERS, ...DOWN_QUARTERS.map((stroke) => ({ ...stroke, slot: stroke.slot + 8 }))] }, labels: ["Theory", "Rhythm"] },
  { id: "split-the-beat", title: "Split the beat", objective: "Keep the hand travelling through 1 & 2 & 3 & 4 &.", concept: "Eighth notes divide each beat into two equal places: the number and the ampersand.", visual: "beat-grid", hearNotes: [60, 60, 60, 60], guess: { choices: ["1 2 3 4", "1 & 2 &", "1 trip-let"], correctChoice: "1 & 2 &" }, play: { kind: "rhythm", bpm: 64, strokes: EIGHTHS }, labels: ["Theory", "Strum"] },
  { id: "rhythm-echo", title: "Hear it, then echo it", objective: "Remember and reproduce short rhythmic answers.", concept: "Rhythm memory hears distance between attacks, not just how many attacks occur.", visual: "waveform", hearNotes: [60, 60, 60], guess: { choices: ["D · D · D · D", "D · D-U · U", "D U D U D U D U"], correctChoice: "D · D-U · U" }, play: { kind: "rhythm", bpm: 66, strokes: ISLAND.slice(0, 6) }, labels: ["Ear", "Rhythm", "Memory"] },
  { id: "right-hand-sound", title: "Sound from the right hand", objective: "Make eight relaxed, even attacks and compare thumb with index tone.", concept: "Tone changes with the contact point and finger, while relaxed motion keeps volume controllable.", visual: "waveform", hearNotes: [67, 60, 64, 69], guess: { choices: ["Thumb", "Index", "Both can work"], correctChoice: "Both can work" }, play: { kind: "rhythm", bpm: 60, strokes: EIGHTHS }, labels: ["Technique", "Tone"] },
  { id: "fingerpicking-flow", title: "Fingerpicking flow", objective: "Pick a six-note string pattern with even spacing.", concept: "String numbers follow 4=G, 3=C, 2=E, 1=A; a repeated route frees the ear to hear harmony.", visual: "ukulele", hearNotes: [67, 60, 64, 69, 64, 60], guess: { choices: ["4 · 3 · 2 · 1 · 2 · 3", "1 · 2 · 3 · 4", "4 · 2 · 4 · 2"], correctChoice: "4 · 3 · 2 · 1 · 2 · 3" }, play: { kind: "note-sequence", notes: [0, 1, 2, 3, 2, 1].map((stringIndex) => ({ stringIndex, fret: 0, midi: [67, 60, 64, 69][stringIndex], western: ["G4", "C4", "E4", "A4"][stringIndex] })), bpm: 60 }, labels: ["Fingerpick", "Technique"] },
  { id: "strumming-vocabulary", title: "Strumming vocabulary", objective: "Keep the wrist moving through sounded and silent strokes.", concept: "A strumming pattern is continuous hand motion with selected contacts, not a list of disconnected hits.", visual: "beat-grid", hearNotes: [60, 64, 67], guess: { choices: ["D · D-U · U-D-U", "D D D D", "U · U · U"], correctChoice: "D · D-U · U-D-U" }, play: { kind: "rhythm", bpm: 70, strokes: ISLAND }, labels: ["Strum", "Rhythm"] },
  { id: "notes-become-chord", title: "When notes become a chord", objective: "Hear Sa–Ga–Pa separately and together as a C chord.", concept: "A triad stacks alternating scale notes. Sa–Ga–Pa translates here to C–E–G.", primaryTerms: ["Sa", "Ga", "Pa"], westernTerms: ["C", "E", "G"], visual: "chord-stack", hearNotes: [60, 64, 67], guess: { choices: ["Sa · Ga · Pa", "Sa · Re · Ga", "Pa · Dha · Ni"], correctChoice: "Sa · Ga · Pa" }, play: { kind: "chord", chords: ["C"], bpm: 60 }, labels: ["Theory", "Chord"] },
  { id: "first-chord-family", title: "Your first chord family", objective: "Form and hear C, Am, and F one string at a time and together.", concept: "These shapes share notes, so careful finger movement can preserve ringing strings.", visual: "chord-stack", hearNotes: [60, 64, 67, 69], guess: { choices: ["C", "Am", "F"], correctChoice: "C" }, play: { kind: "chord", chords: ["C", "Am", "F"], bpm: 58 }, labels: ["Chord", "Play"] },
  { id: "tension-comes-home", title: "Tension comes home", objective: "Hear and play G7 resolving to C.", concept: "G7 contains tones that lean strongly toward C, making the return home easy to hear.", visual: "progression", hearNotes: [67, 71, 74, 77, 60, 64, 67], guess: { choices: ["Home → away", "Away → home", "No change"], correctChoice: "Away → home" }, play: { kind: "chord", chords: ["G7", "C"], bpm: 56 }, labels: ["Harmony", "Ear", "Chord"] },
  { id: "clean-chord-changes", title: "Clean chord changes", objective: "Move through C–Am–F–G without abandoning the pulse.", concept: "Prepare the destination shape while the current chord rings; economy beats speed.", visual: "progression", hearNotes: [60, 69, 65, 67], guess: { choices: ["C · Am · F · G", "C · F · Am · G", "G · F · C · Am"], correctChoice: "C · Am · F · G" }, play: { kind: "chord", chords: ["C", "Am", "F", "G"], bpm: 54 }, labels: ["Chord changes", "Tempo"] },
  { id: "hear-progression", title: "Hear the progression", objective: "Recognise the order of a short four-chord loop.", concept: "Chord progressions create memory through repeated harmonic direction: home, colour, space, tension.", visual: "progression", hearNotes: [60, 69, 65, 67], guess: { choices: ["C · Am · F · G", "Am · F · C · G", "C · G · Am · F"], correctChoice: "C · Am · F · G" }, play: { kind: "chord", chords: ["C", "Am", "F", "G"], bpm: 60 }, labels: ["Ear", "Harmony"] },
  { id: "accompany-phrase", title: "Accompany a phrase", objective: "Support a four-bar phrase with chords and a steady pulse.", concept: "Accompaniment keeps harmonic time beneath a melody without competing with it.", visual: "progression", hearNotes: [60, 64, 67, 69], guess: { choices: ["Follow the pulse", "Chase every melody note", "Stop between bars"], correctChoice: "Follow the pulse" }, play: { kind: "performance", bpm: 68, chords: ["C", "Am", "F", "G"], strokes: DOWN_QUARTERS }, labels: ["Performance", "Strum"] },
  { id: "melody-over-harmony", title: "Melody over harmony", objective: "Choose a supporting chord and play melody and harmony separately.", concept: "Melody moves while harmony supplies a slower home beneath it.", visual: "chord-stack", hearNotes: [60, 62, 64, 67], guess: { choices: ["C", "F", "G7"], correctChoice: "C" }, play: { kind: "note-sequence", notes: [C_SCALE[0], C_SCALE[1], C_SCALE[2], C_SCALE[4]], bpm: 60 }, labels: ["Melody", "Harmony"] },
  { id: "hear-hide-remember", title: "Hear, hide, remember", objective: "Hold a short note path in memory and reproduce it.", concept: "Audiation means hearing music internally after the external sound stops.", visual: "scale-path", hearNotes: [60, 64, 62, 67], guess: { choices: ["Sa · Ga · Re · Pa", "Sa · Re · Ga · Pa", "Pa · Ga · Re · Sa"], correctChoice: "Sa · Ga · Re · Pa" }, play: { kind: "note-sequence", notes: [C_SCALE[0], C_SCALE[2], C_SCALE[1], C_SCALE[4]], bpm: 58 }, labels: ["Ear", "Memory"] },
  { id: "musical-sentence", title: "Make a musical sentence", objective: "Create, hear, hide, and replay an eight-note phrase.", concept: "A phrase feels intentional when it has a beginning, movement, and a return or resting point.", visual: "scale-path", hearNotes: [60, 62, 64, 60], guess: { choices: ["Question and answer", "Random noise", "One held note"], correctChoice: "Question and answer" }, play: { kind: "compose", noteCount: 8, allowedMidi: C_SCALE.map((note) => note.midi) }, labels: ["Create", "Memory"] },
  { id: "dynamics-accents", title: "Dynamics and accents", objective: "Make selected strokes clearly stronger while keeping the pulse even.", concept: "Dynamics shape intensity; an accent is relative emphasis, not a fixed microphone volume.", visual: "waveform", hearNotes: [60, 60, 60, 60], guess: { choices: ["Strong · soft · soft · soft", "All equal", "Soft · soft · soft · strong"], correctChoice: "Strong · soft · soft · soft" }, play: { kind: "rhythm", bpm: 64, strokes: DOWN_QUARTERS }, labels: ["Expression", "Rhythm"] },
  { id: "syncopation-groove", title: "Syncopation and groove", objective: "Land offbeat strokes while the hand moves through rests.", concept: "Syncopation gives emphasis to weaker or unexpected parts of the beat without losing the underlying pulse.", visual: "beat-grid", hearNotes: [60, 60, 60], guess: { choices: ["D – D U – U D U", "D D D D", "U U U U"], correctChoice: "D – D U – U D U" }, play: { kind: "rhythm", bpm: 68, strokes: ISLAND }, labels: ["Syncopation", "Strum"] },
  { id: "final-music-lab", title: "Final music lab", objective: "Hear, infer, perform, retry, and compare a complete four-bar study.", concept: "Musicianship joins listening, theory, physical control, memory, and expression in one continuous decision.", visual: "progression", hearNotes: [60, 69, 65, 67], guess: { choices: ["C · Am · F · G", "F · G · C · Am", "Am · C · G · F"], correctChoice: "C · Am · F · G" }, play: { kind: "performance", bpm: 70, chords: ["C", "Am", "F", "G"], strokes: ISLAND }, labels: ["Ear", "Performance", "Recap"], duration: 12 },
] as const;

function clonePlayActivity(seed: LessonSeed, stage: "play" | "check"): CourseActivity {
  const common = {
    id: `${seed.id}-${stage}`,
    stage,
    title: stage === "play" ? "Now you try" : "Check what landed",
    instruction: stage === "play" ? playInstruction(seed.play) : checkInstruction(seed.play),
    required: true,
    supportedInputs: INPUTS,
  } as const;
  return { ...seed.play, ...common } as CourseActivity;
}

function playInstruction(play: PlayDefinition): string {
  if (play.kind === "self-check") return "Settle the instrument into position, then confirm each physical cue when it feels relaxed.";
  if (play.kind === "note-sequence") return "Follow the highlighted notes in order. Each accepted note moves the target forward.";
  if (play.kind === "chord") return "Form each shown shape, let all four strings ring, then move to the next chord.";
  if (play.kind === "rhythm") return "Listen to the count-in, then strum once on each bright pulse.";
  if (play.kind === "compose") return "Choose notes on the playable fretboard to build your own complete phrase.";
  return "Follow the chord path and place each strum on the bright pulse.";
}

function checkInstruction(play: PlayDefinition): string {
  if (play.kind === "self-check") return "Repeat the posture check once more without tension.";
  if (play.kind === "note-sequence") return "Play the complete note path once more without stopping.";
  if (play.kind === "chord") return "Play the chord sequence once more and check that every string rings.";
  if (play.kind === "rhythm") return "Repeat the pulse once more; Four Strings checks attack timing, not hand direction.";
  if (play.kind === "compose") return "Replay the phrase you created from memory.";
  return "Perform the full study once more, keeping the chord changes inside the pulse.";
}

function makeLesson(seed: LessonSeed, number: number): CourseLesson {
  const unitId = unitDefinitions[Math.floor((number - 1) / 3)][0];
  const hear: ExplainActivity = {
    id: `${seed.id}-hear`, stage: "hear", kind: "explain", title: "Hear it",
    instruction: "Listen once with the visual path, then again with your eyes on the playable instrument.", required: true,
    supportedInputs: INPUTS, visual: seed.visual, referenceNotes: seed.hearNotes,
  };
  const guess: EarChoiceActivity = {
    id: `${seed.id}-guess`, stage: "guess", kind: "ear-choice", title: GUESS_QUESTIONS[seed.id], question: GUESS_QUESTIONS[seed.id],
    instruction: seed.id === "your-ukulele"
      ? "Use the part map you just explored and choose the part that matches the description."
      : "Listen first, then choose before using the playable instrument if you want this answer to count toward Secure.", required: true,
    supportedInputs: INPUTS, choices: seed.guess.choices, correctChoice: seed.guess.correctChoice, referenceNotes: seed.hearNotes,
  };
  return {
    id: seed.id,
    number,
    unitId,
    title: seed.title,
    durationMinutes: seed.duration ?? (number % 3 === 0 ? 10 : 9),
    objective: seed.objective,
    concept: seed.concept,
    primaryTerms: seed.primaryTerms ?? [],
    westernTerms: seed.westernTerms ?? [],
    activityLabels: seed.labels,
    secureActivityId: `${seed.id}-check`,
    activities: [
      { id: `${seed.id}-see`, stage: "see", kind: "explain", title: "See the idea", instruction: seed.concept, required: true, supportedInputs: INPUTS, visual: seed.visual },
      hear,
      guess,
      clonePlayActivity(seed, "play"),
      clonePlayActivity(seed, "check"),
      { id: `${seed.id}-recap`, stage: "recap", kind: "explain", title: "Keep this", instruction: seed.objective, required: true, supportedInputs: INPUTS, visual: seed.visual },
    ],
  };
}

export const COURSE_LESSONS: readonly CourseLesson[] = lessonSeeds.map((seed, index) => makeLesson(seed, index + 1));

export const COURSE_UNITS: readonly CourseUnit[] = unitDefinitions.map(([id, title, description], index) => ({
  id,
  number: index + 1,
  title,
  description,
  lessonIds: COURSE_LESSONS.slice(index * 3, index * 3 + 3).map((lesson) => lesson.id),
}));

export function courseLesson(id: string): CourseLesson {
  const lesson = COURSE_LESSONS.find((candidate) => candidate.id === id);
  if (!lesson) throw new Error(`Unknown course lesson: ${id}`);
  return lesson;
}

export function isCourseLessonOpen(id: string, _progress: Readonly<Record<string, unknown>>): boolean {
  courseLesson(id);
  return true;
}
