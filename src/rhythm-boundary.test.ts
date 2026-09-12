import { expect, it } from "vitest";
import { buildExpectedEvents, rhythmPattern } from "./adaptive-coach";
import { strummingFrame, heardMarker } from "./strumming-motion";

it("preserves a full beat between steady downs at focused loop boundaries", () => {
  const focus = { startSlot: 4, endSlot: 6 };
  for (const bpm of [50, 55, 60, 65, 70]) {
    const events = buildExpectedEvents(rhythmPattern("steady-downs"), bpm, 3, focus);
    for (let i = 1; i < events.length; i++) expect(events[i].atMs - events[i-1].atMs).toBeCloseTo(60000 / bpm);
    const at = 120000 / bpm;
    expect(strummingFrame(rhythmPattern("steady-downs"), bpm, at + .001, focus).cycle).toBe(1);
    expect(heardMarker(at + .001, bpm, focus).cycle).toBe(1);
  }
});

it("keeps the trailing rest silent before the next repetition", () => {
  const frame = strummingFrame(rhythmPattern("steady-downs"), 60, 1600, { startSlot: 4, endSlot: 6 });
  expect(frame.silent).toBe(true);
  expect(frame.cycle).toBe(0);
  expect(frame.contactString).toBeNull();
});
