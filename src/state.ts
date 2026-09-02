import type { PlayMode } from "./music";
import { FRET_COUNT, UKULELE_STRINGS } from "./music";

export interface HeldFret {
  stringIndex: number;
  fret: number;
}

export interface InstrumentStateSnapshot {
  mode: PlayMode;
  latchedFrets: readonly number[];
  heldFrets: ReadonlyMap<number, HeldFret>;
  focusedCell: HeldFret;
  volume: number;
  muted: boolean;
}

export class InstrumentState {
  mode: PlayMode = "strum";
  readonly latchedFrets = [0, 0, 0, 0];
  readonly heldFrets = new Map<number, HeldFret>();
  focusedCell: HeldFret = { stringIndex: 0, fret: 0 };
  volume = 0.72;
  muted = false;

  setMode(mode: PlayMode): void {
    this.mode = mode;
    this.heldFrets.clear();
  }

  toggleLatchedFret(stringIndex: number, fret: number): void {
    validatePosition(stringIndex, fret);
    this.latchedFrets[stringIndex] = this.latchedFrets[stringIndex] === fret ? 0 : fret;
    this.focusedCell = { stringIndex, fret };
  }

  holdFret(pointerId: number, stringIndex: number, fret: number): void {
    validatePosition(stringIndex, fret);
    this.heldFrets.set(pointerId, { stringIndex, fret });
    this.focusedCell = { stringIndex, fret };
  }

  releasePointer(pointerId: number): void {
    this.heldFrets.delete(pointerId);
  }

  clearHeldFrets(): void {
    this.heldFrets.clear();
  }

  clearAll(): void {
    this.latchedFrets.fill(0);
    this.heldFrets.clear();
  }

  getEffectiveFret(stringIndex: number): number {
    validatePosition(stringIndex, 0);
    let fret = this.latchedFrets[stringIndex];
    for (const held of this.heldFrets.values()) {
      if (held.stringIndex === stringIndex) {
        fret = Math.max(fret, held.fret);
      }
    }
    return fret;
  }

  moveFocus(stringDelta: number, fretDelta: number): HeldFret {
    this.focusedCell = {
      stringIndex: wrap(this.focusedCell.stringIndex + stringDelta, UKULELE_STRINGS.length),
      fret: wrap(this.focusedCell.fret + fretDelta, FRET_COUNT + 1),
    };
    return this.focusedCell;
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  snapshot(): InstrumentStateSnapshot {
    return {
      mode: this.mode,
      latchedFrets: [...this.latchedFrets],
      heldFrets: new Map(this.heldFrets),
      focusedCell: { ...this.focusedCell },
      volume: this.volume,
      muted: this.muted,
    };
  }
}

function validatePosition(stringIndex: number, fret: number): void {
  if (!Number.isInteger(stringIndex) || stringIndex < 0 || stringIndex >= UKULELE_STRINGS.length) {
    throw new RangeError(`Unknown string index: ${stringIndex}`);
  }
  if (!Number.isInteger(fret) || fret < 0 || fret > FRET_COUNT) {
    throw new RangeError(`Unknown fret: ${fret}`);
  }
}

function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}
