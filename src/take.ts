export const MAX_TAKE_EVENTS = 320;
export const MAX_TAKE_DURATION_MS = 60_000;

export interface TakeNoteEvent {
  atMs: number;
  stringIndex: number;
  fret: number;
  velocity: number;
}

export interface SavedTake {
  version: 1;
  songId: string;
  chapterId: number;
  durationMs: number;
  events: TakeNoteEvent[];
}

export function createSavedTake(
  songId: string,
  chapterId: number,
  durationMs: number,
  events: readonly TakeNoteEvent[],
): SavedTake {
  return {
    version: 1,
    songId,
    chapterId,
    durationMs: clamp(Math.round(durationMs), 0, MAX_TAKE_DURATION_MS),
    events: events.slice(0, MAX_TAKE_EVENTS).map((event) => ({
      atMs: clamp(Math.round(event.atMs), 0, MAX_TAKE_DURATION_MS),
      stringIndex: clamp(Math.round(event.stringIndex), 0, 3),
      fret: clamp(Math.round(event.fret), 0, 12),
      velocity: clamp(event.velocity, 0.1, 1),
    })),
  };
}

export function parseSavedTake(value: string | null): SavedTake | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SavedTake>;
    if (
      parsed.version !== 1 ||
      typeof parsed.songId !== "string" ||
      !Number.isInteger(parsed.chapterId) ||
      !Array.isArray(parsed.events)
    ) return null;
    const validEvents = parsed.events.filter((event): event is TakeNoteEvent =>
      typeof event === "object" &&
      event !== null &&
      Number.isFinite((event as TakeNoteEvent).atMs) &&
      Number.isFinite((event as TakeNoteEvent).stringIndex) &&
      Number.isFinite((event as TakeNoteEvent).fret) &&
      Number.isFinite((event as TakeNoteEvent).velocity),
    );
    if (validEvents.length !== parsed.events.length) return null;
    return createSavedTake(
      parsed.songId,
      parsed.chapterId as number,
      Number(parsed.durationMs) || 0,
      validEvents,
    );
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
