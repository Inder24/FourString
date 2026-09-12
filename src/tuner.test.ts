import { describe, expect, it } from "vitest";
import { centsBetween, detectPitch, signalRms, targetPitch, TUNING_TARGETS } from "./tuner";

function sine(frequency: number, sampleRate = 48_000, length = 4096): Float32Array {
  return Float32Array.from({ length }, (_, index) => Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.5);
}

describe("tuner pitch analysis", () => {
  it.each(TUNING_TARGETS)("detects $label", (target) => {
    const reading = detectPitch(sine(target.frequency), 48_000);
    expect(reading).not.toBeNull();
    expect(reading!.frequency).toBeCloseTo(target.frequency, 0);
    expect(reading!.confidence).toBeGreaterThan(0.85);
  });

  it("ignores silence", () => {
    expect(detectPitch(new Float32Array(4096), 48_000)).toBeNull();
    expect(signalRms(new Float32Array(4096))).toBe(0);
  });

  it("detects melody notes through the twelfth fret", () => {
    expect(detectPitch(sine(523.25), 48_000)?.frequency).toBeCloseTo(523.25, 0);
    expect(detectPitch(sine(880), 48_000)?.frequency).toBeCloseTo(880, 0);
  });

  it("measures cents and supports an explicit string target", () => {
    const a = TUNING_TARGETS[3];
    expect(centsBetween(a.frequency, a.frequency)).toBeCloseTo(0);
    expect(centsBetween(a.frequency * 2 ** (12 / 1200), a.frequency)).toBeCloseTo(12);
    expect(targetPitch({ frequency: 400, confidence: 1, rms: 0.5 }, "A").target.id).toBe("A");
  });
});
