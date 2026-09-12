export interface MelodyConfirmationResult {
  accepted: boolean;
  stableFrames: number;
  cents?: number;
}

export class RealMelodyConfirmation {
  private stableFrames = 0;
  private armed = true;
  private lastAcceptedFrequency: number | null = null;
  private acceptedAt = -Infinity;

  constructor(private readonly requiredFrames = 3, private readonly reattackMs = 180) {}

  nextExpected(frequency: number): void {
    this.stableFrames = 0;
    this.armed = this.lastAcceptedFrequency === null || Math.abs(1200 * Math.log2(frequency / this.lastAcceptedFrequency)) > 35;
  }

  update(frequency: number | null, expectedFrequency: number, rms: number, at: number): MelodyConfirmationResult {
    if (!this.armed) {
      if (rms < 0.008 && at - this.acceptedAt >= this.reattackMs) this.armed = true;
      return { accepted: false, stableFrames: 0 };
    }
    if (!frequency) {
      this.stableFrames = 0;
      return { accepted: false, stableFrames: 0 };
    }
    const cents = 1200 * Math.log2(frequency / expectedFrequency);
    this.stableFrames = Math.abs(cents) <= 35 ? this.stableFrames + 1 : 0;
    if (this.stableFrames < this.requiredFrames) return { accepted: false, stableFrames: this.stableFrames, cents };
    this.lastAcceptedFrequency = expectedFrequency;
    this.acceptedAt = at;
    this.stableFrames = 0;
    this.armed = false;
    return { accepted: true, stableFrames: this.requiredFrames, cents };
  }

  reset(): void {
    this.stableFrames = 0;
    this.armed = true;
    this.lastAcceptedFrequency = null;
    this.acceptedAt = -Infinity;
  }
}

export class RealStrumCounter {
  private above = false;
  private lastAttackAt = -Infinity;

  constructor(private readonly threshold = 0.02, private readonly debounceMs = 180) {}

  update(rms: number, at: number): boolean {
    if (rms < this.threshold * 0.55) this.above = false;
    if (rms < this.threshold || this.above || at - this.lastAttackAt < this.debounceMs) return false;
    this.above = true;
    this.lastAttackAt = at;
    return true;
  }

  reset(): void {
    this.above = false;
    this.lastAttackAt = -Infinity;
  }
}
