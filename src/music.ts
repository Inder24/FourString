export type StringId = "G" | "C" | "E" | "A";
export type PlayMode = "strum" | "explore";
export type StrumDirection = "down" | "up";

export interface UkuleleString {
  id: StringId;
  openMidi: number;
  label: string;
}

export interface FretPosition {
  stringId: StringId;
  stringIndex: number;
  fret: number;
  midi: number;
  noteName: string;
}

export const UKULELE_STRINGS: readonly UkuleleString[] = [
  { id: "G", openMidi: 67, label: "G4" },
  { id: "C", openMidi: 60, label: "C4" },
  { id: "E", openMidi: 64, label: "E4" },
  { id: "A", openMidi: 69, label: "A4" },
] as const;

export const FRET_COUNT = 12;
export const MAX_PATTERN_STEPS = 30;

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function midiToNoteName(midi: number): string {
  const pitch = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${pitch}${octave}`;
}

export function getFretPosition(stringIndex: number, fret: number): FretPosition {
  const string = UKULELE_STRINGS[stringIndex];
  if (!string) {
    throw new RangeError(`Unknown string index: ${stringIndex}`);
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > FRET_COUNT) {
    throw new RangeError(`Fret must be an integer from 0 to ${FRET_COUNT}`);
  }

  const midi = string.openMidi + fret;
  return {
    stringId: string.id,
    stringIndex,
    fret,
    midi,
    noteName: midiToNoteName(midi),
  };
}

export function appendFingerpickStep(
  steps: readonly FretPosition[],
  step: FretPosition,
  limit = MAX_PATTERN_STEPS,
): FretPosition[] {
  if (steps.length >= limit) return [...steps];
  return [...steps, { ...step }];
}

export function getFretWidths(fretCount = FRET_COUNT): number[] {
  const positions = Array.from({ length: fretCount + 1 }, (_, index) => 1 - 2 ** (-index / 12));
  return positions.slice(1).map((position, index) => position - positions[index]);
}

export function getFretGridTemplate(): string {
  const widths = getFretWidths();
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const fretTracks = widths.map((width) => `${(width / totalWidth).toFixed(6)}fr`).join(" ");
  return `72px ${fretTracks}`;
}

export function getCrossedStringIndices(previous: number, next: number): number[] {
  if (previous === next) return [];
  const step = next > previous ? 1 : -1;
  const crossed: number[] = [];
  for (let index = previous + step; step > 0 ? index <= next : index >= next; index += step) {
    crossed.push(index);
  }
  return crossed;
}

export function velocityFromGesture(pixels: number, elapsedMs: number, pressure = 0): number {
  if (pressure > 0 && pressure <= 1) {
    return clamp(0.48 + pressure * 0.42, 0.48, 0.9);
  }
  const speed = elapsedMs > 0 ? pixels / elapsedMs : 0;
  return clamp(0.58 + speed * 0.16, 0.58, 0.9);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
