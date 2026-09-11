import { chordMidiNotes, LESSON_CHORDS, type ChordName, type LessonGesture } from "./lesson";
import { getFretPosition, midiToNoteName, UKULELE_STRINGS } from "./music";

export interface GuidanceCopy {
  primary: string;
  secondary: string;
}

const CHORD_HINTS: Readonly<Record<ChordName, GuidanceCopy>> = {
  C: {
    primary: "Keep G, C and E open.",
    secondary: "Place your ring finger on the A string at fret 3.",
  },
  Am: {
    primary: "Anchor the G string at fret 2.",
    secondary: "Use your middle finger; let C, E and A stay open.",
  },
  F: {
    primary: "Keep the C and A strings open.",
    secondary: "Middle finger on G2, index finger on E1.",
  },
  G: {
    primary: "Make a small triangle across C2, E3 and A2.",
    secondary: "Curl your fingertips so the open G string keeps ringing.",
  },
  G7: {
    primary: "Build a compact C2, E1 and A2 triangle.",
    secondary: "Keep the open G clear and relax your thumb behind the neck.",
  },
};

export function chordNoteNames(chord: ChordName): string[] {
  return chordMidiNotes(chord).map(midiToNoteName);
}

export function chordFretLabel(chord: ChordName): string {
  return LESSON_CHORDS[chord].frets
    .map((fret, index) => `${UKULELE_STRINGS[index].id}${fret}`)
    .join(" · ");
}

export function chordHint(chord: ChordName): GuidanceCopy {
  return CHORD_HINTS[chord];
}

export function stringHint(stringIndex: number): GuidanceCopy {
  const string = UKULELE_STRINGS[stringIndex];
  const position = getFretPosition(stringIndex, 0);
  return {
    primary: `Find string ${4 - stringIndex} · ${string.id} and leave it open.`,
    secondary: `Pluck once with your thumb, then listen as ${position.noteName} fades naturally.`,
  };
}

export function gestureHint(gesture: LessonGesture, chord: ChordName): GuidanceCopy {
  if (gesture.kind === "pluck") {
    const string = UKULELE_STRINGS[gesture.stringIndex];
    return {
      primary: `Hold ${chord}; pick string ${4 - gesture.stringIndex} · ${string.id}.`,
      secondary: "Use a small thumb movement and let the other strings stay quiet.",
    };
  }
  return gesture.direction === "down"
    ? {
      primary: `Keep the ${chord} shape; brush down through G–C–E–A.`,
      secondary: "Lead with a loose wrist and keep moving past the last string.",
    }
    : {
      primary: `Keep the ${chord} shape; return lightly through A–E–C–G.`,
      secondary: "The up-strum is a gentle return, not a second heavy stroke.",
    };
}
