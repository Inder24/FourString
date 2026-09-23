import { chordMidiNotes, type ChordName } from './lesson';
import { midiToNoteName } from './music';

export const CHECKABLE_CHORDS = ['C', 'Am', 'F', 'G', 'G7'] as const satisfies readonly ChordName[];
export type CheckableChord = typeof CHECKABLE_CHORDS[number];

export interface TranscribedNote {
  pitchMidi: number;
  amplitude: number;
  durationSeconds: number;
  startTimeSeconds: number;
}

export interface ChordCheckResult {
  status: 'match' | 'different' | 'uncertain';
  likelyChord: CheckableChord | null;
  heardNotes: string[];
  expectedNotes: string[];
  missingNotes: string[];
  matchCount: number;
}

const classOf = (midi: number): number => ((midi % 12) + 12) % 12;
const expectedClasses = (chord: CheckableChord): number[] => [...new Set(chordMidiNotes(chord).map(classOf))]
  .sort((left, right) => left - right);
const noteLabel = (pitchClass: number): string => midiToNoteName(60 + pitchClass).replace(/\d$/, '');

export function classifyChordNotes(target: CheckableChord, notes: readonly TranscribedNote[]): ChordCheckResult {
  const heardClasses = [...new Set(notes
    .filter((note) => note.durationSeconds >= 0.10 && note.amplitude >= 0.10 && note.startTimeSeconds <= 1.8)
    .filter((note) => note.pitchMidi >= 48 && note.pitchMidi <= 84)
    .map((note) => classOf(note.pitchMidi)))];
  const expected = expectedClasses(target);
  const missing = expected.filter((pitchClass) => !heardClasses.includes(pitchClass));
  const candidates = CHECKABLE_CHORDS.map((chord) => {
    const classes = expectedClasses(chord);
    const matched = classes.filter((pitchClass) => heardClasses.includes(pitchClass)).length;
    const extra = heardClasses.filter((pitchClass) => !classes.includes(pitchClass)).length;
    return { chord, matched, extra, complete: matched === classes.length && extra <= 1 };
  }).sort((a, b) => Number(b.complete) - Number(a.complete) || b.matched - a.matched || a.extra - b.extra);
  const winner = candidates[0];
  const next = candidates[1];
  const unique = winner.complete && (!next.complete || winner.extra < next.extra);
  return {
    status: !unique ? 'uncertain' : winner.chord === target ? 'match' : 'different',
    likelyChord: unique ? winner.chord : null,
    heardNotes: heardClasses.map(noteLabel),
    expectedNotes: expected.map(noteLabel),
    missingNotes: missing.map(noteLabel),
    matchCount: expected.length - missing.length,
  };
}
