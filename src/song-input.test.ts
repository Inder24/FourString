import { describe, expect, it } from "vitest";
import { RealMelodyConfirmation, RealStrumCounter } from "./song-input";

describe("real ukulele song input", () => {
  it("requires a new attack before accepting a repeated melody pitch", () => {
    const confirmation = new RealMelodyConfirmation(2, 180);
    expect(confirmation.update(261.6, 261.63, 0.04, 0)).toMatchObject({ accepted: false, stableFrames: 1 });
    expect(confirmation.update(261.7, 261.63, 0.04, 30)).toMatchObject({ accepted: true });
    confirmation.nextExpected(261.63);
    expect(confirmation.update(261.6, 261.63, 0.04, 80)).toEqual({ accepted: false, stableFrames: 0 });
    expect(confirmation.update(null, 261.63, 0.004, 260)).toEqual({ accepted: false, stableFrames: 0 });
    expect(confirmation.update(261.6, 261.63, 0.04, 280)).toMatchObject({ accepted: false, stableFrames: 1 });
    expect(confirmation.update(261.7, 261.63, 0.04, 310)).toMatchObject({ accepted: true });
  });

  it("arms immediately when the next melody target changes pitch", () => {
    const confirmation = new RealMelodyConfirmation(2, 180);
    confirmation.update(261.6, 261.63, 0.04, 0);
    expect(confirmation.update(261.7, 261.63, 0.04, 30)).toMatchObject({ accepted: true });
    confirmation.nextExpected(293.66);
    expect(confirmation.update(293.6, 293.66, 0.04, 60)).toMatchObject({ accepted: false, stableFrames: 1 });
    expect(confirmation.update(293.7, 293.66, 0.04, 90)).toMatchObject({ accepted: true });
  });

  it("counts separated strum attacks and ignores sustained sound", () => {
    const counter = new RealStrumCounter(0.02, 180);
    expect(counter.update(0.01, 0)).toBe(false);
    expect(counter.update(0.04, 20)).toBe(true);
    expect(counter.update(0.05, 60)).toBe(false);
    expect(counter.update(0.005, 220)).toBe(false);
    expect(counter.update(0.04, 260)).toBe(true);
  });
});
