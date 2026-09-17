import { VISUAL_CUES, type VisualCue } from "./strumming-motion";
import { loopSlotCount } from "./rhythm-grid";
import { sanitizeCaptureEvidence, type CaptureEvidence } from "./capture-quality";

export type RhythmPatternId = "steady-downs" | "alternating-pulse" | "island-rhythm";
export type RhythmDirection = "down" | "up";
export type TimingGrade = "early" | "late" | "on-time" | "missed";
export type CoachingIssue = "rushing" | "dragging" | "uneven" | "missed_hits" | "extra_hits";

export interface RhythmStroke {
  slot: number;
  direction: RhythmDirection;
}

export interface RhythmPattern {
  id: RhythmPatternId;
  title: string;
  level: string;
  description: string;
  notation: string;
  bpm: number;
  strokes: readonly RhythmStroke[];
}

export interface ExpectedRhythmEvent {
  eventIndex: number;
  slot: number;
  cycle: number;
  direction: RhythmDirection;
  atMs: number;
}

export interface AlignedRhythmHit extends ExpectedRhythmEvent {
  detectedAtMs: number | null;
  deltaMs: number | null;
  grade: TimingGrade;
}

export interface SlotTiming {
  slot: number;
  deltaMs: number | null;
  missed: number;
  samples: number;
}

export interface FocusRegion {
  startSlot: number;
  endSlot: number;
}

export interface AttemptMetrics {
  bpm: number;
  expectedCount: number;
  detectedCount: number;
  meanAbsoluteErrorMs: number;
  meanBiasMs: number;
  timingVariationMs: number;
  onTime: number;
  early: number;
  late: number;
  missed: number;
  extra: number;
  globalOffsetMs: number;
  toleranceMs: number;
  alignedHits: readonly AlignedRhythmHit[];
  slotTiming: readonly SlotTiming[];
  worstRegion: FocusRegion;
}

export interface RhythmAttempt {
  captureQuality?: CaptureEvidence;
  detectedAtMs?: readonly number[];
  id: string;
  patternId: RhythmPatternId;
  kind: "baseline" | "retry";
  bpm: number;
  repetitions: number;
  focus: FocusRegion | null;
  metrics: AttemptMetrics;
  recordingUrl: string | null;
}

export interface CoachingDecision {
  issue: CoachingIssue;
  correction: string;
  evidence: string;
  focusStartSlot: number;
  focusEndSlot: number;
  retryBpm: 50 | 55 | 60 | 65 | 70;
  repetitions: 2 | 3;
  visualCue: VisualCue;
}

export interface CoachAttemptSummary {
  captureQuality: CaptureEvidence | null;
  patternId: RhythmPatternId;
  patternTitle: string;
  notation: string;
  bpm: number;
  retryCount: number;
  metrics: {
    expectedCount: number;
    detectedCount: number;
    meanAbsoluteErrorMs: number;
    meanBiasMs: number;
    timingVariationMs: number;
    onTime: number;
    early: number;
    late: number;
    missed: number;
    extra: number;
    toleranceMs: number;
    slotTiming: readonly SlotTiming[];
    worstRegion: FocusRegion;
  };
  previousAttempt: {
    meanAbsoluteErrorMs: number;
    onTime: number;
    missed: number;
    extra: number;
  } | null;
}

export interface ImprovementResult {
  status: "improved" | "nearly" | "retry";
  beforeErrorMs: number;
  afterErrorMs: number;
  improvementPercent: number;
  beforeOnTimePercent: number;
  afterOnTimePercent: number;
}

export const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  {
    id: "steady-downs",
    title: "Steady downs",
    level: "Start here",
    description: "Four relaxed down-strums. Give every beat the same amount of space.",
    notation: "D · D · D · D",
    bpm: 70,
    strokes: [
      { slot: 0, direction: "down" },
      { slot: 2, direction: "down" },
      { slot: 4, direction: "down" },
      { slot: 6, direction: "down" },
    ],
  },
  {
    id: "alternating-pulse",
    title: "Alternating pulse",
    level: "Build control",
    description: "Keep the hand moving evenly through eight down and up strokes.",
    notation: "D U D U D U D U",
    bpm: 70,
    strokes: Array.from({ length: 8 }, (_, slot) => ({
      slot,
      direction: slot % 2 === 0 ? "down" as const : "up" as const,
    })),
  },
  {
    id: "island-rhythm",
    title: "Island rhythm",
    level: "Add syncopation",
    description: "Let the silent spaces stay open while your hand keeps travelling.",
    notation: "D – D U – U D U",
    bpm: 70,
    strokes: [
      { slot: 0, direction: "down" },
      { slot: 2, direction: "down" },
      { slot: 3, direction: "up" },
      { slot: 5, direction: "up" },
      { slot: 6, direction: "down" },
      { slot: 7, direction: "up" },
    ],
  },
] as const;

const RETRY_TEMPOS = new Set([50, 55, 60, 65, 70]);

export function rhythmPattern(patternId: RhythmPatternId): RhythmPattern {
  return RHYTHM_PATTERNS.find((pattern) => pattern.id === patternId) ?? RHYTHM_PATTERNS[0];
}

export function buildExpectedEvents(
  pattern: RhythmPattern,
  bpm: number,
  repetitions = 2,
  focus: FocusRegion | null = null,
): ExpectedRhythmEvent[] {
  const slotMs = 30_000 / bpm;
  const startSlot = focus?.startSlot ?? 0;
  const endSlot = focus?.endSlot ?? 7;
  const strokes = pattern.strokes.filter((stroke) => stroke.slot >= startSlot && stroke.slot <= endSlot);
  const loopMs = loopSlotCount(focus) * slotMs;
  const events: ExpectedRhythmEvent[] = [];
  for (let cycle = 0; cycle < repetitions; cycle += 1) {
    strokes.forEach((stroke) => {
      events.push({
        eventIndex: events.length,
        slot: stroke.slot,
        cycle,
        direction: stroke.direction,
        atMs: cycle * loopMs + (stroke.slot - startSlot) * slotMs,
      });
    });
  }
  return events;
}

export function analyzeRhythmAttempt(
  expectedEvents: readonly ExpectedRhythmEvent[],
  detectedAtMs: readonly number[],
  bpm: number,
): AttemptMetrics {
  const beatMs = 60_000 / bpm;
  const toleranceMs = Math.round(Math.max(70, beatMs * 0.14));
  const expectedTimes = expectedEvents.map((event) => event.atMs);
  const detected = [...detectedAtMs].filter(Number.isFinite).sort((a, b) => a - b);
  const initial = alignTimes(expectedTimes, detected, 0, toleranceMs);
  const initialOffsets = initial.pairs.map(({ expectedIndex, detectedIndex }) => detected[detectedIndex] - expectedTimes[expectedIndex]);
  const slotMs = beatMs / 2;
  const globalOffsetMs = clamp(median(initialOffsets), -slotMs * 0.45, slotMs * 0.45);
  const alignment = alignTimes(expectedTimes, detected, globalOffsetMs, toleranceMs);
  const matches = new Map(alignment.pairs.map((pair) => [pair.expectedIndex, pair.detectedIndex]));

  const alignedHits = expectedEvents.map<AlignedRhythmHit>((event, expectedIndex) => {
    const detectedIndex = matches.get(expectedIndex);
    if (detectedIndex === undefined) return { ...event, detectedAtMs: null, deltaMs: null, grade: "missed" };
    const detectedTime = detected[detectedIndex];
    const deltaMs = Math.round(detectedTime - globalOffsetMs - event.atMs);
    const grade: TimingGrade = Math.abs(deltaMs) <= toleranceMs
      ? "on-time"
      : deltaMs < 0 ? "early" : "late";
    return { ...event, detectedAtMs: detectedTime, deltaMs, grade };
  });

  const deltas = alignedHits.flatMap((hit) => hit.deltaMs === null ? [] : [hit.deltaMs]);
  const absoluteErrors = deltas.map(Math.abs);
  const meanBiasMs = deltas.length ? average(deltas) : 0;
  const variation = deltas.length
    ? Math.sqrt(average(deltas.map((delta) => (delta - meanBiasMs) ** 2)))
    : toleranceMs * 2;
  const slotTiming = Array.from({ length: 8 }, (_, slot): SlotTiming => {
    const hits = alignedHits.filter((hit) => hit.slot === slot);
    const slotDeltas = hits.flatMap((hit) => hit.deltaMs === null ? [] : [hit.deltaMs]);
    return {
      slot,
      deltaMs: slotDeltas.length ? Math.round(average(slotDeltas)) : null,
      missed: hits.filter((hit) => hit.grade === "missed").length,
      samples: slotDeltas.length,
    };
  });

  return {
    bpm,
    expectedCount: expectedEvents.length,
    detectedCount: detected.length,
    meanAbsoluteErrorMs: Math.round(absoluteErrors.length ? average(absoluteErrors) : toleranceMs * 2),
    meanBiasMs: Math.round(meanBiasMs),
    timingVariationMs: Math.round(variation),
    onTime: alignedHits.filter((hit) => hit.grade === "on-time").length,
    early: alignedHits.filter((hit) => hit.grade === "early").length,
    late: alignedHits.filter((hit) => hit.grade === "late").length,
    missed: alignment.missed.length,
    extra: alignment.extra.length,
    globalOffsetMs: Math.round(globalOffsetMs),
    toleranceMs,
    alignedHits,
    slotTiming,
    worstRegion: findWorstRegion(expectedEvents, slotTiming, toleranceMs),
  };
}

export function summarizeAttemptForCoach(
  pattern: RhythmPattern,
  attempt: RhythmAttempt,
  retryCount: number,
  previousAttempt: RhythmAttempt | null,
): CoachAttemptSummary {
  const metrics = attempt.metrics;
  return {
    patternId: pattern.id,
    patternTitle: pattern.title,
    captureQuality: sanitizeCaptureEvidence(attempt.captureQuality),
    notation: pattern.notation,
    bpm: attempt.bpm,
    retryCount,
    metrics: {
      expectedCount: metrics.expectedCount,
      detectedCount: metrics.detectedCount,
      meanAbsoluteErrorMs: metrics.meanAbsoluteErrorMs,
      meanBiasMs: metrics.meanBiasMs,
      timingVariationMs: metrics.timingVariationMs,
      onTime: metrics.onTime,
      early: metrics.early,
      late: metrics.late,
      missed: metrics.missed,
      extra: metrics.extra,
      toleranceMs: metrics.toleranceMs,
      slotTiming: metrics.slotTiming,
      worstRegion: metrics.worstRegion,
    },
    previousAttempt: previousAttempt
      ? {
          meanAbsoluteErrorMs: previousAttempt.metrics.meanAbsoluteErrorMs,
          onTime: previousAttempt.metrics.onTime,
          missed: previousAttempt.metrics.missed,
          extra: previousAttempt.metrics.extra,
        }
      : null,
  };
}

export function validateCoachingDecision(value: unknown, pattern: RhythmPattern): CoachingDecision | null {
  if (!isRecord(value)) return null;
  const issues: readonly CoachingIssue[] = ["rushing", "dragging", "uneven", "missed_hits", "extra_hits"];
  if (!issues.includes(value.issue as CoachingIssue)) return null;
  if (typeof value.correction !== "string" || value.correction.trim().length < 3 || value.correction.length > 180) return null;
  if (typeof value.evidence !== "string" || value.evidence.trim().length < 3 || value.evidence.length > 180) return null;
  if (!Number.isInteger(value.focusStartSlot) || !Number.isInteger(value.focusEndSlot)) return null;
  const focusStartSlot = Number(value.focusStartSlot);
  const focusEndSlot = Number(value.focusEndSlot);
  if (focusStartSlot < 0 || focusEndSlot > 7 || focusEndSlot < focusStartSlot) return null;
  const span = focusEndSlot - focusStartSlot + 1;
  if (span < 2 || span > 4) return null;
  if (pattern.strokes.filter((stroke) => stroke.slot >= focusStartSlot && stroke.slot <= focusEndSlot).length < 2) return null;
  if (typeof value.retryBpm !== "number" || !RETRY_TEMPOS.has(value.retryBpm)) return null;
  if (value.repetitions !== 2 && value.repetitions !== 3) return null;
  if (typeof value.visualCue !== "string" || !Object.hasOwn(VISUAL_CUES, value.visualCue)) return null;
  return {
    issue: value.issue as CoachingIssue,
    correction: value.correction.trim(),
    evidence: value.evidence.trim(),
    focusStartSlot,
    focusEndSlot,
    retryBpm: Number(value.retryBpm) as CoachingDecision["retryBpm"],
    repetitions: value.repetitions,
    visualCue: value.visualCue as VisualCue,
  };
}

/** A new focus needs evidence covering that whole region, not an unrelated retry. */
export function comparisonTakeForFocus(previous: RhythmAttempt, baseline: RhythmAttempt, focus: FocusRegion): RhythmAttempt {
  return !previous.focus || (previous.focus.startSlot <= focus.startSlot && previous.focus.endSlot >= focus.endSlot)
    ? previous : baseline;
}

export function compareAttempts(
  baseline: RhythmAttempt,
  retry: RhythmAttempt,
  focus: FocusRegion,
): ImprovementResult {
  const beforeHits = baseline.metrics.alignedHits.filter((hit) => hit.slot >= focus.startSlot && hit.slot <= focus.endSlot);
  const afterHits = retry.metrics.alignedHits;
  const beforeErrorMs = focusedError(beforeHits, baseline.metrics.toleranceMs);
  const afterErrorMs = focusedError(afterHits, retry.metrics.toleranceMs);
  const improvementPercent = beforeErrorMs === 0
    ? 0
    : Math.round(((beforeErrorMs - afterErrorMs) / beforeErrorMs) * 100);
  const beforeOnTimePercent = percentOnTime(beforeHits);
  const afterOnTimePercent = percentOnTime(afterHits);
  const enteredTolerance = afterErrorMs <= retry.metrics.toleranceMs && retry.metrics.missed === 0;
  const improved = improvementPercent >= 15 || enteredTolerance;
  const nearly = !improved && (improvementPercent > 0 || afterOnTimePercent > beforeOnTimePercent);
  return {
    status: improved ? "improved" : nearly ? "nearly" : "retry",
    beforeErrorMs,
    afterErrorMs,
    improvementPercent,
    beforeOnTimePercent,
    afterOnTimePercent,
  };
}

export class AdaptiveOnsetDetector {
  private calibration: number[] = [];
  private floor = 0.018;
  private previousRms = 0;
  private lastOnsetAt = -Infinity;
  private peakRms = 0;
  private troughRms = Infinity;
  private rearmed = false;

  addCalibrationSample(rms: number): void {
    if (Number.isFinite(rms) && rms >= 0) this.calibration.push(rms);
    if (this.calibration.length > 240) this.calibration.shift();
  }

  finishCalibration(): number {
    this.floor = clamp(median(this.calibration) * 3.2, 0.012, 0.12);
    this.previousRms = 0;
    this.lastOnsetAt = -Infinity;
    this.peakRms = 0;
    this.troughRms = Infinity;
    this.rearmed = false;
    return this.floor;
  }

  push(rms: number, at: number): boolean {
    if (Number.isFinite(this.lastOnsetAt)) {
      this.peakRms = Math.max(this.peakRms, rms);
      this.troughRms = Math.min(this.troughRms, rms);
      if (rms <= this.peakRms * .82) this.rearmed = true;
    }
    const freshAttack = this.rearmed && rms >= this.troughRms * 1.23
      && rms - this.troughRms >= this.floor * .35;
    const rising = rms >= this.floor && (this.previousRms < this.floor * 0.7 || rms > this.previousRms * 1.55 || freshAttack);
    const detected = rising && at - this.lastOnsetAt >= 150;
    this.previousRms = rms;
    if (detected) {
      this.lastOnsetAt = at;
      this.peakRms = rms;
      this.troughRms = rms;
      this.rearmed = false;
    }
    return detected;
  }

  reset(): void {
    this.calibration = [];
    this.floor = 0.018;
    this.previousRms = 0;
    this.lastOnsetAt = -Infinity;
    this.peakRms = 0;
    this.troughRms = Infinity;
    this.rearmed = false;
  }
}

function alignTimes(
  expected: readonly number[],
  detected: readonly number[],
  offsetMs: number,
  toleranceMs: number,
): { pairs: Array<{ expectedIndex: number; detectedIndex: number }>; missed: number[]; extra: number[] } {
  const rows = expected.length + 1;
  const columns = detected.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(Infinity));
  const moves = Array.from({ length: rows }, () => Array<"match" | "miss" | "extra" | null>(columns).fill(null));
  costs[0][0] = 0;
  for (let i = 1; i < rows; i += 1) {
    costs[i][0] = i * 1.15;
    moves[i][0] = "miss";
  }
  for (let j = 1; j < columns; j += 1) {
    costs[0][j] = j;
    moves[0][j] = "extra";
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const delta = Math.abs(detected[j - 1] - offsetMs - expected[i - 1]);
      const matchCost = costs[i - 1][j - 1] + Math.min(3, delta / toleranceMs);
      const missCost = costs[i - 1][j] + 1.15;
      const extraCost = costs[i][j - 1] + 1;
      const lowest = Math.min(matchCost, missCost, extraCost);
      costs[i][j] = lowest;
      moves[i][j] = lowest === matchCost ? "match" : lowest === missCost ? "miss" : "extra";
    }
  }

  const pairs: Array<{ expectedIndex: number; detectedIndex: number }> = [];
  const missed: number[] = [];
  const extra: number[] = [];
  let i = expected.length;
  let j = detected.length;
  while (i > 0 || j > 0) {
    const move = moves[i][j];
    if (move === "match") {
      pairs.push({ expectedIndex: i - 1, detectedIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (move === "miss") {
      missed.push(i - 1);
      i -= 1;
    } else {
      extra.push(j - 1);
      j -= 1;
    }
  }
  return { pairs: pairs.reverse(), missed: missed.reverse(), extra: extra.reverse() };
}

function findWorstRegion(
  expectedEvents: readonly ExpectedRhythmEvent[],
  slotTiming: readonly SlotTiming[],
  toleranceMs: number,
): FocusRegion {
  const activeSlots = [...new Set(expectedEvents.map((event) => event.slot))].sort((a, b) => a - b);
  if (activeSlots.length < 2) return { startSlot: activeSlots[0] ?? 0, endSlot: Math.min(7, (activeSlots[0] ?? 0) + 1) };
  let best = { startSlot: activeSlots[0], endSlot: activeSlots[1], score: -Infinity };
  for (let startIndex = 0; startIndex < activeSlots.length - 1; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < activeSlots.length; endIndex += 1) {
      const startSlot = activeSlots[startIndex];
      const endSlot = activeSlots[endIndex];
      const span = endSlot - startSlot + 1;
      if (span > 4) break;
      const relevant = slotTiming.filter((slot) => slot.slot >= startSlot && slot.slot <= endSlot && activeSlots.includes(slot.slot));
      const score = average(relevant.map((slot) => Math.abs(slot.deltaMs ?? toleranceMs * 1.8) + slot.missed * toleranceMs));
      if (score > best.score) best = { startSlot, endSlot, score };
    }
  }
  return { startSlot: best.startSlot, endSlot: best.endSlot };
}

function focusedError(hits: readonly AlignedRhythmHit[], toleranceMs: number): number {
  if (!hits.length) return toleranceMs * 2;
  return Math.round(average(hits.map((hit) => hit.deltaMs === null ? toleranceMs * 2 : Math.abs(hit.deltaMs))));
}

function percentOnTime(hits: readonly AlignedRhythmHit[]): number {
  if (!hits.length) return 0;
  return Math.round((hits.filter((hit) => hit.grade === "on-time").length / hits.length) * 100);
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function average(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
