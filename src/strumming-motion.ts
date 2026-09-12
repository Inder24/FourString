import type { FocusRegion, RhythmPattern } from "./adaptive-coach";
import { loopSlotCount } from "./rhythm-grid";

/** Same spacing used by the sampled strum: GCEA down, AECG up. */
export const STRING_CROSSING_MS = 24;
export const GUIDE_STRING_Y = [98, 118, 138, 158] as const;

export const VISUAL_CUES = {
  "even-swing": "Keep a small, even pendulum in your wrist.",
  "relax-return": "Let your hand return gently; do not hurry the next stroke.",
  "follow-pulse": "Aim for each bright arrow as the pulse reaches it.",
  "air-stroke": "Keep moving on the hollow arrows, just clear of the strings.",
} as const;
export type VisualCue = keyof typeof VISUAL_CUES;

export interface StrummingFrame {
  slot: number;
  cycle: number;
  progress: number;
  direction: "down" | "up";
  silent: boolean;
  returning: boolean;
  handY: number;
  contactString: number | null;
}

/** Every subdivision has a hand movement, including the unsounded ones. */
export function strummingFrame(
  pattern: RhythmPattern,
  bpm: number,
  elapsedMs: number,
  focus: FocusRegion | null = null,
): StrummingFrame {
  const first = focus?.startSlot ?? 0;
  const last = focus?.endSlot ?? 7;
  const span = loopSlotCount(focus);
  const slotMs = 30_000 / bpm;
  const step = Math.floor(Math.max(0, elapsedMs) / slotMs);
  const slot = first + step % span;
  const within = Math.max(0, elapsedMs) % slotMs;
  const direction = slot % 2 === 0 ? "down" : "up";
  const silent = slot > last || !pattern.strokes.some((stroke) => stroke.slot === slot);
  const crossing = STRING_CROSSING_MS * 3;
  // The fingertips reach each string exactly when that sample starts.
  let y = 98 + Math.min(crossing + 20, within) / STRING_CROSSING_MS * 20;
  if (direction === "up") y = 256 - y;
  const nextSlot = slot === first + span - 1 ? first : slot + 1;
  const returning = nextSlot % 2 === slot % 2 && within > slotMs * 0.5;
  // Odd-length focused loops need an unvoiced return before repeating.
  if (returning) {
    const progress = (within - slotMs * 0.5) / (slotMs * 0.5);
    const target = direction === "down" ? 78 : 178;
    y += (target - y) * progress;
  } else if (within > crossing + 20 && nextSlot % 2 !== slot % 2) {
    const progress = (within - crossing - 20) / (slotMs - crossing - 20);
    const target = direction === "down" ? 158 : 98;
    y += (target - y) * progress;
  }
  const order = Math.floor(within / STRING_CROSSING_MS);
  return {
    slot,
    cycle: Math.floor(step / span),
    progress: Math.min(1, (slot + .5 + within / slotMs) / 8),
    direction,
    silent,
    returning,
    handY: y,
    contactString: !silent && within <= crossing + 18
      ? direction === "down" ? Math.min(3, order) : 3 - Math.min(3, order)
      : null,
  };
}

/** Map a detected attack onto the same rail, keeping each repetition separate. */
export function heardMarker(atMs: number, bpm: number, focus: FocusRegion | null): { cycle: number; progress: number } {
  const first = focus?.startSlot ?? 0;
  const span = loopSlotCount(focus);
  const slots = Math.max(0, atMs) / (30_000 / bpm);
  return { cycle: Math.floor(slots / span), progress: Math.min(1, (first + .5 + slots % span) / 8) };
}
