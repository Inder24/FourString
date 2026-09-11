import type { StrumDirection } from "./music";

export type ChordName = "C" | "F" | "G" | "G7" | "Am";
export type LessonPhase = "preview" | "lines" | "full" | "complete";

export interface LessonChord {
  name: ChordName;
  frets: readonly [number, number, number, number];
}

export interface SongLine {
  label: string;
  native?: string;
  chords: readonly ChordName[];
  notes?: readonly MelodyNote[];
  beats?: number;
}

export type LessonGesture =
  | { kind: "strum"; direction: StrumDirection; beat: number }
  | { kind: "pluck"; stringIndex: number; fret?: number; beat: number; durationBeats?: number; solfege?: string; quick?: boolean };

export type MelodyNote = Extract<LessonGesture, { kind: "pluck" }> & { fret: number };

export interface LessonChapter {
  id: number;
  shortTitle: string;
  title: string;
  description: string;
  bpm: number;
  guidedPattern: string;
  fullPattern: string;
  guidedEvents: readonly LessonGesture[];
  fullEvents: readonly LessonGesture[];
  technique?: "chords" | "melody";
  backing?: boolean;
}

export interface LessonSong {
  id: "lathe-di-chadar" | "khaab" | "sargam" | "twinkle-twinkle";
  title: string;
  artist: string;
  genre: string;
  rights: "Traditional" | "Chord study";
  rightsDetail: string;
  key: string;
  meter: string;
  beatsPerBar: number;
  searchTerms: string;
  skillLabel?: string;
  lines: readonly SongLine[];
  chapters: readonly LessonChapter[];
}

export const LESSON_CHORDS: Readonly<Record<ChordName, LessonChord>> = {
  C: { name: "C", frets: [0, 0, 0, 3] },
  F: { name: "F", frets: [2, 0, 1, 0] },
  G: { name: "G", frets: [0, 2, 3, 2] },
  G7: { name: "G7", frets: [0, 2, 1, 2] },
  Am: { name: "Am", frets: [2, 0, 0, 0] },
};

const LATHE_DI_CHADAR_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Folk pulse",
    title: "Settle into the folk pulse",
    description: "One relaxed down-strum per beat. Make the C–Am–F–G changes clean before adding movement.",
    bpm: 72,
    guidedPattern: "D · D · D · D",
    fullPattern: "D · D · D · D",
    guidedEvents: strums(["down", "down", "down", "down"]),
    fullEvents: strums(["down", "down", "down", "down"]),
  },
  {
    id: 2,
    shortTitle: "Folk picking",
    title: "Turn the refrain into a conversation",
    description: "Hold the chord and pick string 3, 2, 1, 2. Keep the upper notes light and even.",
    bpm: 78,
    guidedPattern: "3 · 2 · 1 · 2",
    fullPattern: "3 · 2 · 1 · 2",
    guidedEvents: plucks([1, 2, 3, 2]),
    fullEvents: plucks([1, 2, 3, 2]),
  },
  {
    id: 3,
    shortTitle: "Wedding strum",
    title: "Open into a dancing strum",
    description: "Build D · D-U · U line by line, then connect the full D · D-U · U-D-U groove.",
    bpm: 96,
    guidedPattern: "D · D-U · U",
    fullPattern: "D · D-U · U-D-U",
    guidedEvents: liftedGuide(),
    fullEvents: flowingStrum(),
  },
] as const;

const KHAAB_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Dreamy pulse",
    title: "Hear the four-chord story",
    description: "Move slowly through Am–F–C–G. Four soft down-strums give every change room to land.",
    bpm: 64,
    guidedPattern: "D · D · D · D",
    fullPattern: "D · D · D · D",
    guidedEvents: strums(["down", "down", "down", "down"]),
    fullEvents: strums(["down", "down", "down", "down"]),
  },
  {
    id: 2,
    shortTitle: "Dreamy picking",
    title: "Let the minor loop shimmer",
    description: "Pick 3, 2, 1, 2 over each shape. Listen to how one repeated pattern changes colour with the chord.",
    bpm: 72,
    guidedPattern: "3 · 2 · 1 · 2",
    fullPattern: "3 · 2 · 1 · 2",
    guidedEvents: plucks([1, 2, 3, 2]),
    fullEvents: plucks([1, 2, 3, 2]),
  },
  {
    id: 3,
    shortTitle: "Pop flow",
    title: "Bring the loop up to tempo",
    description: "Start with D · D-U · U, then finish with D · D-U · U-D-U at the song-study tempo.",
    bpm: 80,
    guidedPattern: "D · D-U · U",
    fullPattern: "D · D-U · U-D-U",
    guidedEvents: liftedGuide(),
    fullEvents: flowingStrum(),
  },
] as const;

const SARGAM_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Find the notes",
    title: "Meet Sa through high Sa",
    description: "Follow the coral target one note at a time. Say the syllable as you pick so your ear, voice, and fingers learn it together.",
    bpm: 54,
    guidedPattern: "Sa · Re · Ga · Ma · Pa · Dha · Ni · Sa",
    fullPattern: "Sa → Re → Ga → Ma → Pa → Dha → Ni → Sa",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
  },
  {
    id: 2,
    shortTitle: "Join the pairs",
    title: "Connect two notes without a gap",
    description: "Practise each two-note phrase evenly, then let the four pairs become one continuous climb.",
    bpm: 66,
    guidedPattern: "Sa-Re · Ga-Ma · Pa-Dha · Ni-Sa",
    fullPattern: "3,0 · 3,2 · 2,0 · 2,1 · 2,3 · 1,0 · 1,2 · 1,3",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
  },
  {
    id: 3,
    shortTitle: "Smooth ascent",
    title: "Play the full sargam in one breath",
    description: "Keep every note the same length and volume. The goal is a calm, connected ascent—not speed.",
    bpm: 78,
    guidedPattern: "Sa · Re · Ga · Ma · Pa · Dha · Ni · Sa",
    fullPattern: "C4 → D4 → E4 → F4 → G4 → A4 → B4 → C5",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
  },
] as const;

const TWINKLE_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Pick melody",
    title: "Find the tune one phrase at a time",
    description: "Use the exact string-and-fret path below. The final note in each phrase gets a little extra space to ring.",
    bpm: 68,
    guidedPattern: "Pick · listen · copy",
    fullPattern: "C C G G A A G · F F E E D D C",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
  },
  {
    id: 2,
    shortTitle: "Easy strum",
    title: "Add four steady down-strums",
    description: "Hold each chord for one bar and strum down on 1, 2, 3, 4. Keep the hand moving while the shapes change.",
    bpm: 72,
    guidedPattern: "D · D · D · D",
    fullPattern: "D · D · D · D",
    guidedEvents: strums(["down", "down", "down", "down"]),
    fullEvents: strums(["down", "down", "down", "down"]),
    technique: "chords",
  },
  {
    id: 3,
    shortTitle: "Melody + pulse",
    title: "Hear the melody over a gentle chord bed",
    description: "The reference adds a quiet chord beneath each phrase. Pick the melody above it and keep the pulse relaxed.",
    bpm: 76,
    guidedPattern: "Chord bed + single-note melody",
    fullPattern: "C · F · C · G7 underneath the tune",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
    backing: true,
  },
] as const;

export const LESSON_SONGS: readonly LessonSong[] = [
  {
    id: "lathe-di-chadar",
    title: "Lathe Di Chadar",
    artist: "Punjabi folk",
    genre: "Wedding folk",
    rights: "Traditional",
    rightsDetail: "Traditional folk excerpt · original Four Strings arrangement",
    key: "C",
    meter: "4/4",
    beatsPerBar: 4,
    searchTerms: "lathe latthe chadar punjabi folk wedding traditional",
    lines: [
      { label: "Latthe di chadar", native: "ਲੱਠੇ ਦੀ ਚਾਦਰ", chords: ["C", "Am"] },
      { label: "Utte saleti rang mahiya", native: "ਉੱਤੇ ਸਲੇਟੀ ਰੰਗ ਮਾਹੀਆ", chords: ["F", "G"] },
      { label: "Aavo samne, aavo samne", native: "ਆਵੋ ਸਾਹਮਣੇ, ਆਵੋ ਸਾਹਮਣੇ", chords: ["C", "Am"] },
      { label: "Kolon di russ ke na lang mahiya", native: "ਕੋਲੋਂ ਦੀ ਰੁੱਸ ਕੇ ਨਾ ਲੰਘ ਮਾਹੀਆ", chords: ["F", "G", "C"] },
    ],
    chapters: LATHE_DI_CHADAR_CHAPTERS,
  },
  {
    id: "khaab",
    title: "Khaab",
    artist: "Akhil · 2016",
    genre: "Punjabi pop",
    rights: "Chord study",
    rightsDetail: "Copyright-safe accompaniment study · lyrics and melody not included",
    key: "Am / C",
    meter: "4/4",
    beatsPerBar: 4,
    searchTerms: "khaab akhil punjabi pop dream chord study",
    lines: [
      { label: "Loop A · settle into A minor", native: "Chord study · no lyrics included", chords: ["Am", "F"] },
      { label: "Loop B · open into C major", native: "Keep the same four-beat breath", chords: ["C", "G"] },
      { label: "Connect the four-chord cycle", native: "Listen for Am → F → C → G", chords: ["Am", "F", "C", "G"] },
      { label: "Repeat without breaking the pulse", native: "Full accompaniment loop", chords: ["Am", "F", "C", "G"] },
    ],
    chapters: KHAAB_CHAPTERS,
  },
  {
    id: "sargam",
    title: "Sa Re Ga Ma",
    artist: "Indian solfege starter",
    genre: "Fingerpicking warm-up",
    rights: "Traditional",
    rightsDetail: "Traditional sargam exercise · beginner C-major ascent",
    key: "C",
    meter: "4/4",
    beatsPerBar: 4,
    searchTerms: "sa re ga ma pa dha ni sa sargam indian solfege scale beginner fingerpicking",
    skillLabel: "8-note starter",
    lines: [
      { label: "Sa · Re", native: "सा · रे", chords: [], beats: 3, notes: melody([[3, 0, 0, "Sa"], [3, 2, 1, "Re"]]) },
      { label: "Ga · Ma", native: "ग · म", chords: [], beats: 3, notes: melody([[2, 0, 0, "Ga"], [2, 1, 1, "Ma"]]) },
      { label: "Pa · Dha", native: "प · ध", chords: [], beats: 3, notes: melody([[2, 3, 0, "Pa"], [1, 0, 1, "Dha"]]) },
      { label: "Ni · Sa", native: "नि · सा", chords: [], beats: 3, notes: melody([[1, 2, 0, "Ni"], [1, 3, 1, "Sa"]]) },
    ],
    chapters: SARGAM_CHAPTERS,
  },
  {
    id: "twinkle-twinkle",
    title: "Twinkle Twinkle",
    artist: "Traditional",
    genre: "First melody",
    rights: "Traditional",
    rightsDetail: "Public-domain nursery melody · beginner Four Strings arrangement",
    key: "C",
    meter: "4/4",
    beatsPerBar: 4,
    searchTerms: "twinkle twinkle little star nursery rhyme beginner melody fingerpicking strumming",
    skillLabel: "Pick + strum",
    lines: [
      {
        label: "Twinkle, twinkle, little star",
        chords: ["C", "F", "C"],
        beats: 8,
        notes: melody([[3, 0, 0], [3, 0, 1], [2, 3, 2], [2, 3, 3], [1, 0, 4], [1, 0, 5], [2, 3, 6, undefined, 2]]),
      },
      {
        label: "How I wonder what you are",
        chords: ["F", "C", "G7", "C"],
        beats: 8,
        notes: melody([[2, 1, 0], [2, 1, 1], [2, 0, 2], [2, 0, 3], [3, 2, 4], [3, 2, 5], [3, 0, 6, undefined, 2]]),
      },
      {
        label: "Up above the world so high",
        chords: ["C", "F", "C", "G7"],
        beats: 7,
        notes: melody([[2, 3, 0], [2, 3, 1], [2, 1, 1.5, undefined, 0.5, true], [2, 1, 2], [2, 0, 3], [2, 0, 4], [3, 2, 5, undefined, 2]]),
      },
      {
        label: "Like a diamond in the sky",
        chords: ["C", "F", "C", "G7", "C"],
        beats: 7,
        notes: melody([[2, 3, 0], [2, 3, 1], [2, 1, 2], [2, 0, 3], [2, 0, 4], [3, 2, 5, undefined, 2]]),
      },
    ],
    chapters: TWINKLE_CHAPTERS,
  },
] as const;

export function lessonEvents(chapter: LessonChapter, phase: LessonPhase): readonly LessonGesture[] {
  return phase === "full" || phase === "complete" ? chapter.fullEvents : chapter.guidedEvents;
}

export function isMelodyChapter(chapter: LessonChapter): boolean {
  return chapter.technique === "melody";
}

export function lessonLineEvents(
  line: SongLine,
  chapter: LessonChapter,
  phase: LessonPhase,
): readonly LessonGesture[] {
  return isMelodyChapter(chapter) ? line.notes ?? [] : lessonEvents(chapter, phase);
}

export function lessonLineBeats(line: SongLine, chapter: LessonChapter): number {
  if (!isMelodyChapter(chapter)) return Math.max(1, line.chords.length) * 4;
  if (line.beats) return line.beats;
  const notes = line.notes ?? [];
  return Math.max(1, ...notes.map((note) => note.beat + (note.durationBeats ?? 1)));
}

export function matchesChord(frets: readonly number[], chord: ChordName): boolean {
  const expected = LESSON_CHORDS[chord].frets;
  return expected.every((fret, index) => frets[index] === fret);
}

export function chordMidiNotes(chord: ChordName): readonly [number, number, number, number] {
  const opens = [67, 60, 64, 69] as const;
  const frets = LESSON_CHORDS[chord].frets;
  return opens.map((midi, index) => midi + frets[index]) as [number, number, number, number];
}

export function filterLessonSongs(query: string): LessonSong[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...LESSON_SONGS];
  return LESSON_SONGS.filter((song) =>
    `${song.title} ${song.artist} ${song.genre} ${song.searchTerms}`.toLocaleLowerCase().includes(normalized),
  );
}

type MelodyTuple = readonly [
  physicalString: 1 | 2 | 3 | 4,
  fret: number,
  beat: number,
  solfege?: string,
  durationBeats?: number,
  quick?: boolean,
];

function melody(notes: readonly MelodyTuple[]): MelodyNote[] {
  return notes.map(([physicalString, fret, beat, solfege, durationBeats, quick]) => ({
    kind: "pluck",
    stringIndex: 4 - physicalString,
    fret,
    beat,
    ...(solfege ? { solfege } : {}),
    ...(durationBeats ? { durationBeats } : {}),
    ...(quick ? { quick } : {}),
  }));
}

function strums(directions: readonly StrumDirection[]): LessonGesture[] {
  return directions.map((direction, beat) => ({ kind: "strum", direction, beat }));
}

function plucks(strings: readonly number[]): LessonGesture[] {
  return strings.map((stringIndex, index) => ({ kind: "pluck", stringIndex, beat: index }));
}

function liftedGuide(): LessonGesture[] {
  return strumEvents([
    ["down", 0],
    ["down", 1],
    ["up", 1.5],
    ["up", 2.5],
  ]);
}

function flowingStrum(): LessonGesture[] {
  return strumEvents([
    ["down", 0],
    ["down", 1],
    ["up", 1.5],
    ["up", 2.5],
    ["down", 3],
    ["up", 3.5],
  ]);
}

function strumEvents(events: readonly (readonly [StrumDirection, number])[]): LessonGesture[] {
  return events.map(([direction, beat]) => ({ kind: "strum", direction, beat }));
}
