import { describe, expect, it } from "vitest";
import { buildExpectedEvents, RHYTHM_PATTERNS, rhythmPattern } from "./adaptive-coach";
import { GUIDE_STRING_Y, STRING_CROSSING_MS, heardMarker, strummingFrame } from "./strumming-motion";

describe("audio-synchronized teaching motion", () => {
  for (const pattern of RHYTHM_PATTERNS) {
    it(`${pattern.id}: places the fingertip on each sounding string at its scheduled onset`, () => {
      for (const bpm of [50, 60, 70]) {
        for (const event of buildExpectedEvents(pattern, bpm, 2)) {
          for (let order = 0; order < 4; order++) {
            const at = event.atMs + order * STRING_CROSSING_MS + 0.0001;
            const frame = strummingFrame(pattern, bpm, at);
            const index = event.direction === "down" ? order : 3 - order;
            expect(frame.slot).toBe(event.slot);
            expect(frame.cycle).toBe(event.cycle);
            expect(frame.silent).toBe(false);
            expect(frame.contactString).toBe(index);
            expect(frame.handY).toBeCloseTo(GUIDE_STRING_Y[index], 2);
          }
        }
      }
    });
  }

  it("continues down/up air strokes at both island rests without sounding a string", () => {
    const pattern = rhythmPattern("island-rhythm");
    for (const slot of [1, 4]) {
      const frame = strummingFrame(pattern, 60, slot * 500 + 24);
      expect(frame.silent).toBe(true);
      expect(frame.direction).toBe(slot === 1 ? "up" : "down");
      expect(frame.contactString).toBeNull();
    }
  });

  it("resets the eight-slot playhead each bar, not after the full two-bar take", () => {
    const first = strummingFrame(rhythmPattern("steady-downs"), 60, 200);
    const second = strummingFrame(rhythmPattern("steady-downs"), 60, 4200);
    expect(second.progress).toBeCloseTo(first.progress);
    expect(second.cycle).toBe(1);
  });

  it("keeps focus coordinates and provides a silent return for an odd-length loop", () => {
    const pattern = rhythmPattern("steady-downs");
    const focus = { startSlot: 4, endSlot: 6 };
    const returnFrame = strummingFrame(pattern, 60, 1600, focus);
    expect(returnFrame.slot).toBe(7);
    expect(returnFrame.silent).toBe(true);
    expect(returnFrame.contactString).toBeNull();
    const repeated = strummingFrame(pattern, 60, 2000, focus);
    expect(repeated.slot).toBe(4);
    expect(repeated.progress).toBe(.5625);
    expect(repeated.cycle).toBe(1);
    expect(heardMarker(2100, 60, focus)).toEqual({ cycle: 1, progress: .5875 });
  });
});
