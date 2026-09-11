import { clamp, type StrumDirection } from "./music";
import type { ChordName } from "./lesson";

export type PracticeStageId = "settle" | "shapes" | "changes" | "rhythm" | "song";

export interface PracticeStage {
  id: PracticeStageId;
  number: number;
  label: string;
  title: string;
  description: string;
  durationSeconds: number;
  targetKind: "strings" | "chords" | "rhythm";
  stringTargets?: readonly number[];
  chordTargets?: readonly ChordName[];
  strumTargets?: readonly StrumDirection[];
}

export const TEN_MINUTE_STAGES: readonly PracticeStage[] = [
  {
    id: "settle",
    number: 1,
    label: "Open strings",
    title: "Wake up all four strings",
    description: "Tap G, C, E and A in order. This screen check confirms that every open-string target is selected.",
    durationSeconds: 60,
    targetKind: "strings",
    stringTargets: [0, 1, 2, 3, 0, 1, 2, 3],
  },
  {
    id: "shapes",
    number: 2,
    label: "Clean shapes",
    title: "Place, release, rebuild",
    description: "Build each shape without rushing. A clean chord matters more than speed.",
    durationSeconds: 120,
    targetKind: "chords",
    chordTargets: ["C", "Am", "F", "G"],
  },
  {
    id: "changes",
    number: 3,
    label: "Chord changes",
    title: "Connect the difficult corners",
    description: "Move through the loop twice. Missed screen targets slow the working tempo; correct changes bring it back up.",
    durationSeconds: 180,
    targetKind: "chords",
    chordTargets: ["C", "Am", "F", "G", "C", "Am", "F", "G"],
  },
  {
    id: "rhythm",
    number: 4,
    label: "Steady pulse",
    title: "Make four beats feel inevitable",
    description: "Hold C and play eight even down-strums. The first on-screen strum establishes your pulse.",
    durationSeconds: 150,
    targetKind: "rhythm",
    chordTargets: ["C"],
    strumTargets: ["down", "down", "down", "down", "down", "down", "down", "down"],
  },
  {
    id: "song",
    number: 5,
    label: "Musical finish",
    title: "Turn the drill into music",
    description: "Play the song loop twice without stopping. Keep the pulse more important than perfection.",
    durationSeconds: 90,
    targetKind: "chords",
    chordTargets: ["Am", "F", "C", "G", "Am", "F", "C", "G"],
  },
] as const;

export const TEN_MINUTE_SECONDS = TEN_MINUTE_STAGES.reduce((sum, stage) => sum + stage.durationSeconds, 0);

export type PitchEvidence = "match" | "quiet" | "mismatch";

export interface PitchConfirmationResult {
  matches: number;
  required: number;
  progress: number;
  confirmed: boolean;
}

/**
 * Confirms a played note across a short window while tolerating the tiny gaps
 * that naturally occur between pitch readings during a real string's attack.
 */
export class PracticePitchConfirmation {
  private matches: number[] = [];

  constructor(
    private readonly requiredMatches = 4,
    private readonly windowMs = 650,
    private readonly quietGraceMs = 320,
  ) {}

  observe(evidence: PitchEvidence, at: number): PitchConfirmationResult {
    this.matches = this.matches.filter((matchAt) => at - matchAt <= this.windowMs);

    if (evidence === "mismatch") {
      this.matches = [];
    } else if (evidence === "match") {
      const previous = this.matches.at(-1);
      if (previous !== undefined && at - previous > this.quietGraceMs) this.matches = [];
      if (this.matches.at(-1) !== at) this.matches.push(at);
    } else {
      const previous = this.matches.at(-1);
      if (previous !== undefined && at - previous > this.quietGraceMs) this.matches = [];
    }

    const count = Math.min(this.matches.length, this.requiredMatches);
    return {
      matches: count,
      required: this.requiredMatches,
      progress: count / this.requiredMatches,
      confirmed: count >= this.requiredMatches,
    };
  }

  reset(): void {
    this.matches = [];
  }
}

export function formatPracticeTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function adaptPracticeTempo(currentBpm: number, cleanStreak: number, misses: number): number {
  if (misses >= 2) return clamp(currentBpm - 8, 52, 120);
  if (cleanStreak >= 3) return clamp(currentBpm + 4, 52, 120);
  return currentBpm;
}

export function practiceStageOffsetSeconds(stageIndex: number): number {
  return TEN_MINUTE_STAGES.slice(0, stageIndex).reduce((sum, stage) => sum + stage.durationSeconds, 0);
}
