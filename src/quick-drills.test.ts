import { describe, expect, it } from "vitest";
import { PulseDrill, NoteConfirmation } from "./coach";

describe("beginner pulse gaps", () => {
  it("grades the last gap, without carrying forward an earlier delay", () => {
    const drill = new PulseDrill();
    expect(drill.push(1000).grade).toBe("start");
    expect(drill.push(2200).grade).toBe("late");
    const hit = drill.push(3033);
    expect(hit.grade).toBe("on-time");
    expect(hit.gapMs).toBe(833);
    expect(drill.push(3500).grade).toBe("early");
  });
  it("restarts after a pause and excludes the start from the summary", () => {
    const drill = new PulseDrill();
    drill.push(0);
    drill.push(833);
    expect(drill.push(5000).grade).toBe("restart");
    expect(drill.hits).toHaveLength(1);
    for (let i = 1; i <= 7; i++) drill.push(5000 + i * 833);
    expect(drill.summary()).toEqual({ steady: 7, early: 0, late: 0, averageGapMs: 833 });
    drill.push(12000);
    expect(drill.hits).toHaveLength(8);
    drill.reset();
    expect(drill.hits).toHaveLength(0);
  });
});

describe("string confirmation", () => {
  it("keeps evidence through short quiet gaps but requires seven correct readings", () => {
    const confirmation = new NoteConfirmation();
    for (let i = 0; i < 4; i++) expect(confirmation.push("correct", i * 40)).toBe(false);
    expect(confirmation.push("quiet", 160)).toBe(false);
    expect(confirmation.frames).toBe(4);
    expect(confirmation.push("correct", 200)).toBe(false);
    expect(confirmation.push("correct", 240)).toBe(false);
    expect(confirmation.push("correct", 280)).toBe(true);
  });
  it("resets on a wrong pitch, long silence, or explicit reset", () => {
    const confirmation = new NoteConfirmation();
    confirmation.push("correct", 0);
    confirmation.push("wrong-note", 40);
    expect(confirmation.frames).toBe(0);
    confirmation.push("correct", 80);
    confirmation.push("quiet", 400);
    expect(confirmation.frames).toBe(0);
    confirmation.push("correct", 440);
    confirmation.reset();
    expect(confirmation.frames).toBe(0);
  });
});
