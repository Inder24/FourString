import { describe, expect, it } from "vitest";
import { findSampleRegion, normalizeVelocity, playbackRateFor, SAMPLE_REGIONS } from "./audio";

describe("sample mapping", () => {
  it("covers every note used by the twelve-fret high-G instrument", () => {
    for (let midi = 60; midi <= 81; midi += 1) {
      const region = findSampleRegion(midi);
      expect(midi).toBeGreaterThanOrEqual(region.lowMidi);
      expect(midi).toBeLessThanOrEqual(region.highMidi);
    }
  });

  it("retains the SFZ fine-tuning correction", () => {
    const g4 = findSampleRegion(67);
    expect(g4.url).toBe("/audio/G4.flac");
    expect(playbackRateFor(67, g4)).toBeCloseTo(2 ** (-1 / 1200), 8);
  });

  it("uses an exact octave playback ratio", () => {
    const artificialRegion = { url: "test", rootMidi: 60, lowMidi: 60, highMidi: 72, tuneCents: 0 };
    expect(playbackRateFor(72, artificialRegion)).toBeCloseTo(2, 10);
  });

  it("ships the thirteen CC0 pitch regions and clamps voice gain", () => {
    expect(SAMPLE_REGIONS).toHaveLength(13);
    expect(normalizeVelocity(-1)).toBe(0.08);
    expect(normalizeVelocity(2)).toBe(0.92);
  });
});
