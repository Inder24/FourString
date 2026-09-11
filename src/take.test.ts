import { describe, expect, it } from "vitest";
import { createSavedTake, MAX_TAKE_DURATION_MS, MAX_TAKE_EVENTS, parseSavedTake } from "./take";

describe("saved lesson takes", () => {
  it("keeps a bounded, replayable set of note events", () => {
    const events = Array.from({ length: MAX_TAKE_EVENTS + 4 }, (_, index) => ({
      atMs: index * 250,
      stringIndex: index % 4,
      fret: index % 13,
      velocity: 0.72,
    }));
    const take = createSavedTake("sargam", 1, 80_000, events);
    expect(take.events).toHaveLength(MAX_TAKE_EVENTS);
    expect(take.durationMs).toBe(MAX_TAKE_DURATION_MS);
    expect(parseSavedTake(JSON.stringify(take))).toEqual(take);
  });

  it("rejects malformed local data", () => {
    expect(parseSavedTake(null)).toBeNull();
    expect(parseSavedTake("not-json")).toBeNull();
    expect(parseSavedTake(JSON.stringify({ version: 1, songId: "x", chapterId: 1, events: [{ nope: true }] }))).toBeNull();
  });
});
