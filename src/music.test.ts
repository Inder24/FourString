import { describe, expect, it } from "vitest";
import {
  appendFingerpickStep,
  FRET_COUNT,
  getCrossedStringIndices,
  getFretPosition,
  getFretGridTemplate,
  getFretWidths,
  MAX_PATTERN_STEPS,
  midiToNoteName,
  UKULELE_STRINGS,
  velocityFromGesture,
} from "./music";

describe("ukulele note mapping", () => {
  it("maps all 52 string and fret positions", () => {
    const positions = UKULELE_STRINGS.flatMap((_, stringIndex) =>
      Array.from({ length: FRET_COUNT + 1 }, (_, fret) => getFretPosition(stringIndex, fret)),
    );

    expect(positions).toHaveLength(52);
    expect(positions.every((position) => position.midi === UKULELE_STRINGS[position.stringIndex].openMidi + position.fret)).toBe(true);
  });

  it("uses standard re-entrant high-G tuning and octave frets", () => {
    expect(UKULELE_STRINGS.map((string) => string.label)).toEqual(["G4", "C4", "E4", "A4"]);
    expect(UKULELE_STRINGS.map((_, index) => getFretPosition(index, 12).noteName)).toEqual([
      "G5",
      "C5",
      "E5",
      "A5",
    ]);
  });

  it("maps common beginner shapes to the correct sounding notes", () => {
    const chord = (frets: number[]) => frets.map((fret, index) => getFretPosition(index, fret).midi);
    expect(chord([0, 0, 0, 3])).toEqual([67, 60, 64, 72]); // C
    expect(chord([2, 0, 1, 0])).toEqual([69, 60, 65, 69]); // F
    expect(chord([0, 2, 3, 2])).toEqual([67, 62, 67, 71]); // G
    expect(chord([2, 0, 0, 0])).toEqual([69, 60, 64, 69]); // Am
  });

  it("formats note names with octaves", () => {
    expect(midiToNoteName(60)).toBe("C4");
    expect(midiToNoteName(66)).toBe("F♯4");
    expect(midiToNoteName(70)).toBe("B♭4");
  });
});

describe("physical fret geometry and strums", () => {
  it("creates twelve progressively narrowing fret widths", () => {
    const widths = getFretWidths();
    expect(widths).toHaveLength(12);
    expect(widths.reduce((total, width) => total + width, 0)).toBeCloseTo(0.5, 10);
    widths.slice(1).forEach((width, index) => expect(width).toBeLessThan(widths[index]));
  });

  it("normalizes fret tracks to fill the available neck", () => {
    const tracks = getFretGridTemplate().split(" ").slice(1).map((track) => Number.parseFloat(track));
    expect(tracks.reduce((sum, track) => sum + track, 0)).toBeCloseTo(1, 5);
  });

  it("returns every string crossed in both directions", () => {
    expect(getCrossedStringIndices(0, 3)).toEqual([1, 2, 3]);
    expect(getCrossedStringIndices(3, 0)).toEqual([2, 1, 0]);
    expect(getCrossedStringIndices(2, 2)).toEqual([]);
  });

  it("keeps gesture velocity in a musical range", () => {
    expect(velocityFromGesture(0, 20)).toBe(0.58);
    expect(velocityFromGesture(500, 10)).toBe(0.9);
    expect(velocityFromGesture(1, 10, 0.5)).toBeCloseTo(0.69);
  });
});

describe("fingerpicking patterns", () => {
  it("keeps repeated positions in their selected order", () => {
    const note = getFretPosition(3, 3);
    const steps = appendFingerpickStep(appendFingerpickStep([], note), note);

    expect(steps).toHaveLength(2);
    expect(steps.map((step) => `${step.stringId}:${step.fret}`)).toEqual(["A:3", "A:3"]);
  });

  it("caps a pattern at fifteen notes", () => {
    const note = getFretPosition(0, 2);
    let steps = [note].slice(0, 0);
    for (let index = 0; index < MAX_PATTERN_STEPS + 3; index += 1) {
      steps = appendFingerpickStep(steps, note);
    }

    expect(steps).toHaveLength(MAX_PATTERN_STEPS);
  });
});
