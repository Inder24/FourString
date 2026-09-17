import type { AudioEngine } from './audio';
import { BeatSchedule, TapTempo, nextGentleTempo } from './tempo';

export class TempoPanel {
  private readonly schedule = new BeatSchedule(72);
  private readonly tap = new TapTempo();
  private timer = 0;
  private visualTimers: number[] = [];
  private cancelSounds: Array<() => void> = [];
  private playing = false;
  private sound: 'click' | 'drum' = 'drum';
  private baseBpm = 72;
  private variationEnabled = false;
  private variationCycle = 4;
  private beatsInCycle = 0;
  private lastScheduledAt: number | null = null;

  constructor(private readonly root: HTMLElement, private readonly audio: AudioEngine, private readonly ensureAudio: () => Promise<boolean>) {
    this.element<HTMLButtonElement>('#tempo-start').addEventListener('click', () => void (this.playing ? this.stop() : this.start()));
    this.element<HTMLInputElement>('#tempo-speed').addEventListener('input', (event) => this.setBpm(Number((event.target as HTMLInputElement).value)));
    this.element<HTMLInputElement>('#tempo-variation').addEventListener('change', (event) => {
      this.variationEnabled = (event.target as HTMLInputElement).checked;
      this.beatsInCycle = 0;
      if (!this.variationEnabled && this.playing && this.lastScheduledAt !== null) {
        this.schedule.retimeNextBeat(this.baseBpm, this.lastScheduledAt);
      } else if (!this.variationEnabled) {
        this.schedule.bpm = this.baseBpm;
      }
      this.render();
    });
    this.element<HTMLSelectElement>('#tempo-variation-cycle').addEventListener('change', (event) => {
      this.variationCycle = Number((event.target as HTMLSelectElement).value);
      this.beatsInCycle = 0;
      this.render();
    });
    this.element<HTMLButtonElement>('#tempo-tap').addEventListener('click', () => {
      const bpm = this.tap.push(performance.now());
      if (bpm) this.setBpm(bpm);
      else this.element('#tempo-status').textContent = 'Tap again at the speed you want.';
    });
    for (const sound of ['drum', 'click'] as const) {
      this.element<HTMLButtonElement>(`#tempo-${sound}`).addEventListener('click', () => {
        this.sound = sound;
        this.render();
      });
    }
    this.render();
  }

  leave(): void { this.stop(); }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found = this.root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing tempo control ${selector}`);
    return found;
  }

  private async start(): Promise<void> {
    const button = this.element<HTMLButtonElement>('#tempo-start');
    button.disabled = true;
    this.element('#tempo-status').textContent = 'Preparing the beat…';
    const ready = await this.ensureAudio();
    button.disabled = false;
    if (!ready || this.root.hidden) {
      this.element('#tempo-status').textContent = ready ? 'Open Tempo to play.' : 'Sound could not start. Try again.';
      return;
    }
    this.playing = true;
    this.beatsInCycle = 0;
    this.lastScheduledAt = null;
    this.schedule.bpm = this.baseBpm;
    this.schedule.start(this.audio.currentTime + .06);
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
    this.render();
  }

  private tick(): void {
    const now = this.audio.currentTime;
    for (const event of this.schedule.due(now, .11)) {
      this.lastScheduledAt = event.at;
      this.cancelSounds.push(this.audio.scheduleMetronomeBeat(event.at, event.beat, this.sound));
      if (this.element<HTMLInputElement>('#tempo-eighths').checked) {
        this.cancelSounds.push(this.audio.scheduleMetronomeBeat(event.at + 30 / this.schedule.bpm, 0, 'click'));
      }
      this.visualTimers.push(window.setTimeout(() => this.showBeat(event.beat), Math.max(0, (event.at - now) * 1000)));
      if (this.variationEnabled && ++this.beatsInCycle === this.variationCycle) {
        this.beatsInCycle = 0;
        this.schedule.retimeNextBeat(nextGentleTempo(this.schedule.bpm, this.baseBpm), event.at);
        this.render();
      }
    }
    if (this.cancelSounds.length > 32) this.cancelSounds.splice(0, this.cancelSounds.length - 32);
  }

  private showBeat(beat: number): void {
    if (!this.playing) return;
    this.element('#tempo-beat-number').textContent = String(beat);
    this.root.querySelectorAll('#tempo-beats span').forEach((light, index) => light.classList.toggle('is-current', index === beat - 1));
  }

  private clearScheduled(): void {
    this.cancelSounds.forEach((cancel) => cancel());
    this.cancelSounds = [];
    this.visualTimers.forEach((timer) => window.clearTimeout(timer));
    this.visualTimers = [];
  }

  private stop(): void {
    this.playing = false;
    this.schedule.stop();
    this.schedule.bpm = this.baseBpm;
    this.beatsInCycle = 0;
    this.lastScheduledAt = null;
    window.clearInterval(this.timer);
    this.clearScheduled();
    this.render();
  }

  private setBpm(bpm: number): void {
    const next = Math.max(40, Math.min(180, Math.round(bpm)));
    this.baseBpm = next;
    this.beatsInCycle = 0;
    this.element<HTMLInputElement>('#tempo-speed').value = String(next);
    if (this.playing) this.clearScheduled();
    this.schedule.setBpm(next, this.audio.currentTime + .06);
    if (this.playing) this.tick();
    this.render();
  }

  private render(): void {
    this.root.dataset.playing = String(this.playing);
    this.element('#tempo-bpm').textContent = String(this.schedule.bpm);
    this.element('#tempo-start').textContent = this.playing ? 'Stop beat' : 'Start beat';
    this.element('#tempo-status').textContent = this.playing ? `${this.schedule.bpm} BPM · ${this.sound === 'drum' ? 'drum pulse' : 'metronome clicks'}${this.variationEnabled ? ' · gently changing' : ''}` : 'Set a tempo, then press Start beat.';
    this.element('#tempo-variation-status').textContent = this.variationEnabled
      ? `Base ${this.baseBpm} BPM · shifts 2–4 BPM every ${this.variationCycle} beats, within ±10 BPM.`
      : 'Steady at your chosen tempo.';
    for (const sound of ['drum', 'click'] as const) {
      const button = this.element<HTMLButtonElement>(`#tempo-${sound}`);
      button.classList.toggle('is-selected', this.sound === sound);
      button.setAttribute('aria-pressed', String(this.sound === sound));
    }
  }
}
