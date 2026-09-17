import { clamp, midiToNoteName } from "./music";
import { centsBetween, type PitchReading, type TuningTarget } from "./tuner";

export type CoachPitchGrade = "quiet" | "wrong-note" | "flat" | "sharp" | "close" | "correct";
export type RhythmGrade = "early" | "late" | "on-time";

export interface PulseGap {
  grade: RhythmGrade | "start" | "restart";
  gapMs: number | null;
}

/** Beginner exercise: each new interval is a fresh chance to find the pulse. */
export class PulseDrill {
  readonly hits: PulseGap[] = [];
  readonly targetMs = 60_000 / 72;
  private lastAt: number | null = null;

  push(at: number): PulseGap {
    if (this.hits.length >= 8) return this.hits[7];
    const gapMs = this.lastAt === null ? null : at - this.lastAt;
    const restart = gapMs !== null && gapMs > this.targetMs * 3;
    if (restart) this.reset();
    const hit: PulseGap = {
      grade: restart ? "restart" : gapMs === null ? "start"
        : Math.abs(gapMs - this.targetMs) <= this.targetMs * 0.16 ? "on-time"
        : gapMs < this.targetMs ? "early" : "late",
      gapMs: restart ? null : gapMs,
    };
    this.lastAt = at;
    this.hits.push(hit);
    return hit;
  }

  summary() {
    const gaps = this.hits.filter((hit) => hit.gapMs !== null);
    return {
      steady: gaps.filter((hit) => hit.grade === "on-time").length,
      early: gaps.filter((hit) => hit.grade === "early").length,
      late: gaps.filter((hit) => hit.grade === "late").length,
      averageGapMs: gaps.length ? Math.round(gaps.reduce((sum, hit) => sum + hit.gapMs!, 0) / gaps.length) : 0,
    };
  }

  reset(): void {
    this.hits.length = 0;
    this.lastAt = null;
  }
}

export class NoteConfirmation {
  frames = 0;
  private lastCorrectAt = -Infinity;

  push(grade: CoachPitchGrade, at: number): boolean {
    if (at - this.lastCorrectAt > 250) this.frames = 0;
    if (grade === "correct") {
      this.frames += 1;
      this.lastCorrectAt = at;
    } else if (grade !== "quiet") {
      this.reset();
    }
    return this.frames >= 7;
  }

  reset(): void {
    this.frames = 0;
    this.lastCorrectAt = -Infinity;
  }
}

export interface CoachPitchFeedback {
  grade: CoachPitchGrade;
  cents: number | null;
  heardMidi: number | null;
  heardNote: string;
  accuracy: number;
}

export interface RhythmFeedback {
  grade: RhythmGrade;
  deltaMs: number;
  accuracy: number;
}

export function frequencyToMidi(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

export function evaluateCoachPitch(
  reading: PitchReading | null,
  target: TuningTarget,
  correctToleranceCents = 14,
): CoachPitchFeedback {
  if (!reading || reading.rms < 0.008 || reading.confidence < 0.6) {
    return { grade: "quiet", cents: null, heardMidi: null, heardNote: "—", accuracy: 0 };
  }

  const heardMidi = frequencyToMidi(reading.frequency);
  const heardNote = midiToNoteName(heardMidi);
  const cents = centsBetween(reading.frequency, target.frequency);
  if (Math.abs(heardMidi - target.midi) > 1 || Math.abs(cents) > 100) {
    return { grade: "wrong-note", cents, heardMidi, heardNote, accuracy: 0 };
  }

  const accuracy = clamp(1 - Math.abs(cents) / 50, 0, 1);
  if (Math.abs(cents) <= correctToleranceCents) {
    return { grade: "correct", cents, heardMidi, heardNote, accuracy };
  }
  if (Math.abs(cents) <= 28) {
    return { grade: "close", cents, heardMidi, heardNote, accuracy };
  }
  return { grade: cents < 0 ? "flat" : "sharp", cents, heardMidi, heardNote, accuracy };
}

export function gradeRhythmHit(hitAt: number, anchorAt: number, bpm: number, beatIndex?: number): RhythmFeedback {
  const beatMs = 60_000 / bpm;
  const expectedBeat = beatIndex ?? Math.round((hitAt - anchorAt) / beatMs);
  const expectedAt = anchorAt + expectedBeat * beatMs;
  const deltaMs = hitAt - expectedAt;
  const tolerance = beatMs * 0.16;
  return {
    grade: Math.abs(deltaMs) <= tolerance ? "on-time" : deltaMs < 0 ? "early" : "late",
    deltaMs,
    accuracy: clamp(1 - Math.abs(deltaMs) / (beatMs / 2), 0, 1),
  };
}

export class OnsetDetector {
  private previousRms = 0;
  private lastOnsetAt = -Infinity;
  private peakRms = 0;
  private troughRms = Infinity;
  private rearmed = false;

  constructor(
    private readonly floor = 0.018,
    private readonly cooldownMs = 180,
  ) {}

  push(rms: number, at: number): boolean {
    if (Number.isFinite(this.lastOnsetAt)) {
      this.peakRms = Math.max(this.peakRms, rms);
      this.troughRms = Math.min(this.troughRms, rms);
      if (rms <= this.peakRms * .82) this.rearmed = true;
    }
    const freshAttack = this.rearmed && rms >= this.troughRms * 1.23
      && rms - this.troughRms >= this.floor * .35;
    const rising = rms >= this.floor && (this.previousRms < this.floor * 0.72 || rms > this.previousRms * 1.6 || freshAttack);
    const detected = rising && at - this.lastOnsetAt >= this.cooldownMs;
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
    this.previousRms = 0;
    this.lastOnsetAt = -Infinity;
    this.peakRms = 0;
    this.troughRms = Infinity;
    this.rearmed = false;
  }
}
