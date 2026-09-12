import { rhythmPattern, type FocusRegion, type RhythmAttempt } from "./adaptive-coach";
import { loopSlotCount } from "./rhythm-grid";

export interface TracePoint { position: number; grade: string; deltaMs: number | null; cycle: number; eventIndex?: number; }

export function takeTracePoints(attempt: RhythmAttempt, focus: FocusRegion): TracePoint[] {
  const span = loopSlotCount(focus);
  const slotMs = 30000 / attempt.bpm;
  const points: TracePoint[] = attempt.metrics.alignedHits.filter(h => h.slot >= focus.startSlot && h.slot <= focus.endSlot).map(h => ({
    position: h.cycle + (h.slot - focus.startSlot + (h.deltaMs ?? 0) / slotMs) / span,
    grade: h.grade, deltaMs: h.deltaMs, cycle: h.cycle, eventIndex: h.eventIndex,
  }));
  const assigned = new Set(attempt.metrics.alignedHits.flatMap(h => h.detectedAtMs === null ? [] : [h.detectedAtMs]));
  for (const at of attempt.detectedAtMs ?? []) {
    if (assigned.has(at)) continue;
    const offset = (at - attempt.metrics.globalOffsetMs) / slotMs;
    const attemptSpan = loopSlotCount(attempt.focus);
    const cycle = Math.max(0, Math.floor(offset / attemptSpan));
    const slot = (attempt.focus?.startSlot ?? 0) + offset - cycle * attemptSpan;
    if (slot < focus.startSlot || slot >= focus.startSlot + span) continue;
    points.push({ position: cycle + (slot - focus.startSlot) / span, grade: "extra", deltaMs: null, cycle });
  }
  return points;
}

/** Onset traces on a shared musical grid, not audio-amplitude waveforms. */
export function renderTakeTraces(root: HTMLElement, first: RhythmAttempt, next: RhythmAttempt, focus: FocusRegion, onSelect?: (attempt: RhythmAttempt, eventIndex: number) => void): void {
  const loops = Math.max(first.repetitions, next.repetitions);
  const span = loopSlotCount(focus);
  const expected: TracePoint[] = [];
  for (let cycle = 0; cycle < loops; cycle++) {
    for (const stroke of rhythmPattern(next.patternId).strokes) {
      if (stroke.slot < focus.startSlot || stroke.slot > focus.endSlot) continue;
      expected.push({ position: cycle + (stroke.slot - focus.startSlot) / span, grade: "expected", deltaMs: 0, cycle });
    }
  }
  const rows = [
    { label: "Expected rhythm", points: expected, repetitions: loops, attempt: null },
    { label: `${first.kind === "baseline" ? "First" : "Previous"} take · ${first.bpm} BPM`, points: takeTracePoints(first, focus), repetitions: first.repetitions, attempt: first },
    { label: `New take · ${next.bpm} BPM`, points: takeTracePoints(next, focus), repetitions: next.repetitions, attempt: next },
  ];
  const heading = document.createElement("p");
  heading.textContent = "Same section, beat-aligned · peaks show strum timing, not volume. Device delay is removed. Select a peak for its offset.";
  root.replaceChildren(heading);
  for (const row of rows) {
    const section = document.createElement("section");
    section.className = "ai-trace-row";
    const label = document.createElement("strong");
    label.textContent = row.label;
    const rail = document.createElement("div");
    rail.className = "ai-trace-rail";
    rail.setAttribute("aria-label", row.label);
    for (let cycle = 0; cycle < loops; cycle++) {
      const block = document.createElement("span");
      block.className = "ai-trace-cycle";
      block.style.left = `${cycle / loops * 100}%`;
      block.style.width = `${100 / loops}%`;
      block.textContent = cycle < row.repetitions ? `Loop ${cycle + 1}` : "No take";
      rail.append(block);
    }
    const detail = document.createElement("small");
    detail.textContent = "Steady = green · early/late = coral · × missed · + extra";
    for (const point of row.points) {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "ai-trace-peak";
      marker.dataset.grade = point.grade;
      marker.style.left = `${Math.max(1, Math.min(99, point.position / loops * 100))}%`;
      marker.textContent = point.grade === "missed" ? "×" : point.grade === "extra" ? "+" : "│";
      const description = `Loop ${point.cycle + 1}: ${point.grade}${point.deltaMs === null ? "" : `, ${point.deltaMs > 0 ? "+" : ""}${point.deltaMs} ms`}`;
      marker.title = description;
      marker.setAttribute("aria-label", description);
      marker.addEventListener("click", () => {
        detail.textContent = description;
        if (row.attempt && point.eventIndex !== undefined && point.grade !== "on-time") onSelect?.(row.attempt, point.eventIndex);
      });
      rail.append(marker);
    }
    section.append(label, rail, detail);
    root.append(section);
  }
}
