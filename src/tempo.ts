export class BeatSchedule {
  private nextAt = 0;
  private nextBeat = 1;
  private running = false;

  constructor(public bpm: number) {}

  start(at: number): void {
    this.nextAt = at;
    this.nextBeat = 1;
    this.running = true;
  }

  stop(): void { this.running = false; }

  due(now: number, ahead: number): Array<{ at: number; beat: number; accent: boolean }> {
    const result: Array<{ at: number; beat: number; accent: boolean }> = [];
    if (!this.running) return result;
    const beatSeconds = 60 / this.bpm;
    if (this.nextAt < now - .05) {
      const skipped = Math.ceil((now - .05 - this.nextAt) / beatSeconds);
      this.nextAt += skipped * beatSeconds;
      this.nextBeat = (this.nextBeat - 1 + skipped) % 4 + 1;
    }
    while (this.nextAt <= now + ahead) {
      result.push({ at: this.nextAt, beat: this.nextBeat, accent: this.nextBeat === 1 });
      this.nextBeat = this.nextBeat % 4 + 1;
      this.nextAt += beatSeconds;
    }
    return result;
  }

  setBpm(bpm: number, at: number): void {
    this.bpm = Math.max(40, Math.min(220, Math.round(bpm)));
    if (this.running) this.start(at);
  }

  retimeNextBeat(bpm: number, afterBeatAt: number): void {
    this.bpm = Math.max(40, Math.min(220, Math.round(bpm)));
    if (this.running) this.nextAt = afterBeatAt + 60 / this.bpm;
  }
}

export function nextGentleTempo(current: number, base: number, random: () => number = Math.random): number {
  const step = 2 + Math.floor(random() * 3);
  const direction = random() < .5 ? -1 : 1;
  const low = Math.max(40, base - 10);
  const high = Math.min(180, base + 10);
  const candidate = current + direction * step;
  return Math.max(low, Math.min(high, candidate < low || candidate > high ? current - direction * step : candidate));
}

export class TapTempo {
  private taps: number[] = [];

  push(at: number): number | null {
    if (this.taps.length && at - this.taps.at(-1)! > 2000) this.taps = [];
    this.taps.push(at);
    if (this.taps.length > 5) this.taps.shift();
    if (this.taps.length < 2) return null;
    const gaps = this.taps.slice(1).map((time, index) => time - this.taps[index]).filter((gap) => gap >= 250 && gap <= 1500);
    if (!gaps.length) return null;
    return Math.max(40, Math.min(220, Math.round(60_000 / (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length))));
  }
}
