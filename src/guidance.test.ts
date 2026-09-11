import { describe, expect, it } from "vitest";

import { chordFretLabel, chordHint, chordNoteNames, gestureHint, stringHint } from "./guidance";

describe("learning guidance", () => {
  it("layers fret and note names for a C chord", () => {
    expect(chordFretLabel("C")).toBe("G0 · C0 · E0 · A3");
    expect(chordNoteNames("C")).toEqual(["G4", "C4", "E4", "C5"]);
  });

  it("gives chord-specific fingering instead of generic help", () => {
    expect(chordHint("F")).toEqual({
      primary: "Keep the C and A strings open.",
      secondary: "Middle finger on G2, index finger on E1.",
    });
  });

  it("names the physical string in note and gesture hints", () => {
    expect(stringHint(0).primary).toContain("string 4 · G");
    expect(gestureHint({ kind: "pluck", stringIndex: 3, beat: 0 }, "Am").primary).toContain("string 1 · A");
  });
});
