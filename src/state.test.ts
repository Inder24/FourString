import { describe, expect, it } from "vitest";
import { InstrumentState } from "./state";

describe("InstrumentState", () => {
  it("latches one mouse fret per string and toggles it off", () => {
    const state = new InstrumentState();
    state.toggleLatchedFret(0, 2);
    expect(state.getEffectiveFret(0)).toBe(2);
    state.toggleLatchedFret(0, 4);
    expect(state.getEffectiveFret(0)).toBe(4);
    state.toggleLatchedFret(0, 4);
    expect(state.getEffectiveFret(0)).toBe(0);
  });

  it("tracks simultaneous pointer-held frets", () => {
    const state = new InstrumentState();
    state.holdFret(11, 0, 2);
    state.holdFret(12, 1, 3);
    state.holdFret(13, 2, 1);
    expect(state.getEffectiveFret(0)).toBe(2);
    expect(state.getEffectiveFret(1)).toBe(3);
    expect(state.getEffectiveFret(2)).toBe(1);
    state.releasePointer(12);
    expect(state.getEffectiveFret(1)).toBe(0);
  });

  it("uses the highest held or latched fret on a string", () => {
    const state = new InstrumentState();
    state.toggleLatchedFret(3, 3);
    state.holdFret(21, 3, 2);
    state.holdFret(22, 3, 7);
    expect(state.getEffectiveFret(3)).toBe(7);
    state.releasePointer(22);
    expect(state.getEffectiveFret(3)).toBe(3);
  });

  it("clears transient holds when changing modes", () => {
    const state = new InstrumentState();
    state.holdFret(5, 1, 5);
    state.setMode("explore");
    expect(state.heldFrets.size).toBe(0);
    expect(state.mode).toBe("explore");
  });

  it("wraps keyboard focus around the grid", () => {
    const state = new InstrumentState();
    expect(state.moveFocus(-1, -1)).toEqual({ stringIndex: 3, fret: 12 });
    expect(state.moveFocus(1, 1)).toEqual({ stringIndex: 0, fret: 0 });
  });
});
