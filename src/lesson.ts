import type { StrumDirection } from "./music";
import { lessonTrust } from "./lesson-trust";

export type ChordName = "C" | "F" | "G" | "G7" | "Am";
export type LessonPhase = "preview" | "lines" | "full" | "complete";
export type LessonMaterialType = "melody" | "accompaniment" | "exercise";
export type LessonSourceStatus = "source-backed" | "original" | "unverified";

export interface LessonSource {
  title: string;
  url: string;
  supports: string;
}

export interface LessonProvenance {
  type: LessonMaterialType;
  tuning: readonly ["G4", "C4", "E4", "A4"];
  arrangementVersion: string;
  status: LessonSourceStatus;
  sources: readonly LessonSource[];
  playable: boolean;
}

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
  practiceLineCount?: number;
  melodyFlow?: "phrases" | "continuous";
}

export interface LessonBackingChordEvent {
  chord: ChordName;
  beat: number;
  durationBeats: number;
}

export interface LessonSong {
  id: "lathe-di-chadar" | "khaab" | "sargam" | "twinkle-twinkle" | "yellow" | "im-yours" | "hedwigs-theme";
  title: string;
  artist: string;
  genre: string;
  rights: "Traditional" | "Chord study" | "Melody study";
  rightsDetail: string;
  key: string;
  meter: string;
  beatsPerBar: number;
  searchTerms: string;
  skillLabel?: string;
  lines: readonly SongLine[];
  chapters: readonly LessonChapter[];
  provenance: LessonProvenance;
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

const YELLOW_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Verse pulse",
    title: "Place the three verse chords",
    description: "Learn the beginner C–G–F movement with one relaxed down-strum on every beat. Let each chord ring before the next change.",
    bpm: 68,
    guidedPattern: "D · D · D · D",
    fullPattern: "D · D · D · D",
    guidedEvents: strums(["down", "down", "down", "down"]),
    fullEvents: strums(["down", "down", "down", "down"]),
  },
  {
    id: 2,
    shortTitle: "Starry picking",
    title: "Turn each chord into four clear notes",
    description: "Hold the same shapes and pick strings 3, 2, 1, 2. Keep the top note light so the chord change stays calm and spacious.",
    bpm: 76,
    guidedPattern: "3 · 2 · 1 · 2",
    fullPattern: "3 · 2 · 1 · 2",
    guidedEvents: plucks([1, 2, 3, 2]),
    fullEvents: plucks([1, 2, 3, 2]),
  },
  {
    id: 3,
    shortTitle: "Island glow",
    title: "Open the chorus into an island strum",
    description: "Begin with D · D-U · U, then add the final D-U. Keep your hand travelling through the silent spaces.",
    bpm: 87,
    guidedPattern: "D · D-U · U",
    fullPattern: "D · D-U · U-D-U",
    guidedEvents: liftedGuide(),
    fullEvents: flowingStrum(),
  },
] as const;

const IM_YOURS_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Four-chord loop",
    title: "Make C–G–Am–F feel automatic",
    description: "Give each chord four steady down-strums. Prepare the next shape early and keep the final F as relaxed as the opening C.",
    bpm: 60,
    guidedPattern: "D · D · D · D",
    fullPattern: "D · D · D · D",
    guidedEvents: strums(["down", "down", "down", "down"]),
    fullEvents: strums(["down", "down", "down", "down"]),
  },
  {
    id: 2,
    shortTitle: "Sunny picking",
    title: "Hear the loop one string at a time",
    description: "Pick strings 3, 2, 1, 2 over every chord. The pattern stays unchanged while the C–G–Am–F harmony moves beneath it.",
    bpm: 66,
    guidedPattern: "3 · 2 · 1 · 2",
    fullPattern: "3 · 2 · 1 · 2",
    guidedEvents: plucks([1, 2, 3, 2]),
    fullEvents: plucks([1, 2, 3, 2]),
  },
  {
    id: 3,
    shortTitle: "Island strum",
    title: "Add the familiar laid-back bounce",
    description: "Learn D · D-U · U first, then complete D · D-U · U-D-U. The empty eighth-note spaces create the groove.",
    bpm: 70,
    guidedPattern: "D · D-U · U",
    fullPattern: "D · D-U · U-D-U",
    guidedEvents: liftedGuide(),
    fullEvents: flowingStrum(),
  },
] as const;

const HEDWIG_CHAPTERS: readonly LessonChapter[] = [
  {
    id: 1,
    shortTitle: "Find the motif",
    title: "Find the first four notes",
    description: "Just the opening four notes. Start on string 3, fret 2, and let the long note ring. This chapter finishes after the motif.",
    bpm: 54,
    guidedPattern: "D · G · B♭ · A",
    fullPattern: "Listen · pick · let it ring",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
    practiceLineCount: 1,
    melodyFlow: "continuous",
  },
  {
    id: 2,
    shortTitle: "Connect phrases",
    title: "Carry the melody across the strings",
    description: "Learn three four-note phrases and a two-note ending, then join them in a gentle three-beat pulse.",
    bpm: 64,
    guidedPattern: "1 · 2 · 3 / 1 · 2 · 3",
    fullPattern: "Four phrases · one flowing pulse",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
  },
  {
    id: 3,
    shortTitle: "Full opening",
    title: "Play the short opening in one take",
    description: "Play all 14 notes without stopping at phrase boundaries. Keep the pickup light and let the ending fade.",
    bpm: 76,
    guidedPattern: "Soft pickup · steady waltz",
    fullPattern: "The short G-minor opening",
    guidedEvents: [],
    fullEvents: [],
    technique: "melody",
    melodyFlow: "continuous",
  },
] as const;

export const LESSON_SONGS: readonly LessonSong[] = [
  {
    id: "lathe-di-chadar",
    provenance: {
      type: "accompaniment",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings study v1.0",
      status: "unverified",
      sources: [],
      playable: false,
    },
    title: "Lathe Di Chadar",
    artist: "Punjabi folk",
    genre: "Wedding folk",
    rights: "Traditional",
    rightsDetail: "Unverified Four Strings folk study · not the original recording or melody",
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
    provenance: {
      type: "accompaniment",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings study v1.0",
      status: "unverified",
      sources: [],
      playable: false,
    },
    title: "Khaab",
    artist: "Akhil · 2016",
    genre: "Punjabi pop",
    rights: "Chord study",
    rightsDetail: "Unverified lyric-free chord study · lyrics and melody not included · not the original recording or melody",
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
    provenance: {
      type: "exercise",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings C-major ascent v1.0",
      status: "original",
      sources: [],
      playable: true,
    },
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
    provenance: {
      type: "melody",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings beginner melody v1.0",
      status: "source-backed",
      playable: true,
      sources: [
        {
          title: "3 Easy Songs You Can Fingerpick on Ukulele Today",
          url: "https://ukuleletricks.com/ukulele-fingerpicking-nursery-rhymes/",
          supports: "Twinkle as a beginner solo fingerpicking piece with a simple quarter-note rhythm and open strings.",
        },
        {
          title: "Lesson 2: Master Smooth Chord Changes",
          url: "https://ukuleletricks.com/learn-to-play-ukulele/lesson-2-master-smooth-chord-changes/",
          supports: "C, F and G7 chord shapes and their use in a beginner Twinkle chord-change lesson.",
        },
      ],
    },
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
  {
    id: "yellow",
    provenance: {
      type: "accompaniment",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings lyric-free chord study v1.0",
      status: "source-backed",
      playable: true,
      sources: [
        {
          title: "Yellow by Coldplay — Ukulele Chords & Tabs",
          url: "https://ukutabs.com/c/coldplay/yellow/",
          supports: "A rookie gCEA arrangement in C, the C–G–F verse, F–Am–G chorus, island strum and approximately 87 BPM.",
        },
      ],
    },
    title: "Yellow",
    artist: "Coldplay · 2000",
    genre: "Alternative rock",
    rights: "Chord study",
    rightsDetail: "Lyric-free accompaniment study in C · not the original recording or melody",
    key: "C",
    meter: "4/4",
    beatsPerBar: 4,
    searchTerms: "yellow coldplay rock pop stars beginner island strum chord study",
    skillLabel: "C · G · F · Am",
    lines: [
      { label: "Verse A · open the phrase", native: "Begin softly on C", chords: ["C"] },
      { label: "Verse B · add the lift", native: "Move cleanly to G", chords: ["G"] },
      { label: "Verse C · let it settle", native: "Resolve the verse on F", chords: ["F"] },
      { label: "Chorus turn · widen the sound", native: "Connect F → Am → G", chords: ["F", "Am", "G"] },
    ],
    chapters: YELLOW_CHAPTERS,
  },
  {
    id: "im-yours",
    provenance: {
      type: "accompaniment",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings lyric-free chord study v1.0",
      status: "source-backed",
      playable: true,
      sources: [
        {
          title: "I’m Yours — Ukulele Chords and Tutorial",
          url: "https://acousticbridge.com/im-yours-ukulele-chords/",
          supports: "The beginner transposition to C and its repeating C–G–Am–F harmony; the original recording does not feature ukulele.",
        },
        {
          title: "I’m Yours Ukulele Tutorial — Jason Mraz",
          url: "https://raysukulele.com/ukulele-tutorials/im-yours-jason-mraz/",
          supports: "Standard GCEA tuning, the C–G–Am–F progression and the D–D-U–U-D-U island strum.",
        },
      ],
    },
    title: "I’m Yours",
    artist: "Jason Mraz · 2008",
    genre: "Acoustic pop",
    rights: "Chord study",
    rightsDetail: "Lyric-free C–G–Am–F accompaniment study · lyrics and melody not included · not the original recording or melody",
    key: "C",
    meter: "4/4",
    beatsPerBar: 4,
    searchTerms: "i'm yours im yours jason mraz acoustic pop beginner island strum chord study",
    skillLabel: "C · G · Am · F",
    lines: [
      { label: "Loop step 1 · find home", native: "Begin on C", chords: ["C"] },
      { label: "Loop step 2 · create lift", native: "Move to G", chords: ["G"] },
      { label: "Loop step 3 · soften the colour", native: "Move to A minor", chords: ["Am"] },
      { label: "Loop step 4 · complete the cycle", native: "Resolve on F, then return to C", chords: ["F"] },
    ],
    chapters: IM_YOURS_CHAPTERS,
  },
  {
    id: "hedwigs-theme",
    provenance: {
      type: "melody",
      tuning: ["G4", "C4", "E4", "A4"],
      arrangementVersion: "Four Strings simplified G-minor opening v1.0",
      status: "source-backed",
      playable: true,
      sources: [
        {
          title: "Hedwig’s Theme — Uke Can Do It",
          url: "https://uke-can-do-it.com/musictab-pdfs/movietv-themes/harry-potter-hedwigs-theme-ukulele/",
          supports: "A G-minor ukulele transposition whose opening stays within the first five frets; fingerstyle is recommended.",
        },
        {
          title: "Hedwig’s Theme — Hoffman Academy",
          url: "https://app.hoffmanacademy.com/lessons/piano/hedwigs-theme/video/",
          supports: "The opening melody pitches, transposed here from E minor to G minor for a low-fret ukulele path.",
        },
      ],
    },
    title: "Hedwig’s Theme",
    artist: "John Williams · Harry Potter",
    genre: "Film melody",
    rights: "Melody study",
    rightsDetail: "unofficial short, simplified fingerpicking study · no original recording or published score included",
    key: "Gm",
    meter: "3/4",
    beatsPerBar: 3,
    searchTerms: "harry potter hedwig theme john williams wizard film g minor fingerpicking melody",
    skillLabel: "Low-fret fingerpicking",
    lines: [
      {
        label: "The opening whisper",
        native: "Light pickup · let G ring",
        chords: [],
        beats: 3,
        notes: melody([[3, 2, 0, undefined, 0.5], [2, 3, 0.5, undefined, 1.5], [1, 1, 2, undefined, 0.5], [1, 0, 2.5, undefined, 0.5]]),
      },
      {
        label: "The high answer",
        native: "Reach fret 5 on string 1",
        chords: [],
        beats: 3,
        notes: melody([[2, 3, 0, undefined, 1.5], [1, 5, 1.5, undefined, 0.5], [1, 3, 2, undefined, 0.5], [1, 0, 2.5, undefined, 0.5]]),
      },
      {
        label: "The little twist",
        native: "Listen for the unusual F♯",
        chords: [],
        beats: 3,
        notes: melody([[2, 3, 0, undefined, 1.5], [1, 1, 1.5, undefined, 0.5], [1, 0, 2, undefined, 0.5], [2, 2, 2.5, undefined, 0.5]]),
      },
      {
        label: "The held ending",
        native: "A♭ leads back to high D",
        chords: [],
        beats: 3,
        notes: melody([[2, 4, 0, undefined, 1], [1, 5, 1, undefined, 2]]),
      },
    ],
    chapters: HEDWIG_CHAPTERS,
  },
] as const;

export function lessonEvents(chapter: LessonChapter, phase: LessonPhase): readonly LessonGesture[] {
  return phase === "full" || phase === "complete" ? chapter.fullEvents : chapter.guidedEvents;
}

export function isMelodyChapter(chapter: LessonChapter): boolean {
  return chapter.technique === "melody";
}

export function lessonChapterLines(song: LessonSong, chapter: LessonChapter): readonly SongLine[] {
  return chapter.practiceLineCount === undefined ? song.lines : song.lines.slice(0, chapter.practiceLineCount);
}

export function lessonLineEvents(
  line: SongLine,
  chapter: LessonChapter,
  phase: LessonPhase,
): readonly LessonGesture[] {
  return isMelodyChapter(chapter) ? line.notes ?? [] : lessonEvents(chapter, phase);
}

export function lessonPlaybackEvents(
  line: SongLine,
  chapter: LessonChapter,
  phase: LessonPhase,
  demoPlaying: boolean,
): readonly LessonGesture[] {
  return lessonLineEvents(line, chapter, demoPlaying ? "full" : phase === "preview" ? "lines" : phase);
}

export function lessonLineBeats(line: SongLine, chapter: LessonChapter): number {
  if (!isMelodyChapter(chapter)) return Math.max(1, line.chords.length) * 4;
  if (line.beats) return line.beats;
  const notes = line.notes ?? [];
  return Math.max(1, ...notes.map((note) => note.beat + (note.durationBeats ?? 1)));
}

export function lessonBackingChordEvents(line: SongLine, chapter: LessonChapter): LessonBackingChordEvent[] {
  if (!isMelodyChapter(chapter) || !chapter.backing || line.chords.length === 0) return [];
  const durationBeats = lessonLineBeats(line, chapter) / line.chords.length;
  return line.chords.map((chord, index) => ({ chord, beat: index * durationBeats, durationBeats }));
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

export function canPracticeLessonSong(song: LessonSong): boolean {
  return song.provenance.playable && lessonTrust(song).status !== "unverified";
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
