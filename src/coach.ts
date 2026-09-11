import { clamp, midiToNoteName } from "./music";
import { centsBetween, type PitchReading, type TuningTarget } from "./tuner";

export type CoachPitchGrade = "quiet" | "wrong-note" | "flat" | "sharp" | "close" | "correct";
export type RhythmGrade = "early" | "late" | "on-time";

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

  constructor(
    private readonly floor = 0.018,
    private readonly cooldownMs = 180,
  ) {}

  push(rms: number, at: number): boolean {
    const rising = rms >= this.floor && (this.previousRms < this.floor * 0.72 || rms > this.previousRms * 1.6);
    const detected = rising && at - this.lastOnsetAt >= this.cooldownMs;
    this.previousRms = rms;
    if (detected) this.lastOnsetAt = at;
    return detected;
  }

  reset(): void {
    this.previousRms = 0;
    this.lastOnsetAt = -Infinity;
  }
}
