import { clamp, type StrumDirection } from "./music";

export interface SampleRegion {
  url: string;
  rootMidi: number;
  lowMidi: number;
  highMidi: number;
  tuneCents: number;
}

export const SAMPLE_REGIONS: readonly SampleRegion[] = [
  { url: "/audio/C4.flac", rootMidi: 60, lowMidi: 58, highMidi: 60, tuneCents: -5 },
  { url: "/audio/D4.flac", rootMidi: 62, lowMidi: 61, highMidi: 62, tuneCents: -8 },
  { url: "/audio/E4.flac", rootMidi: 64, lowMidi: 63, highMidi: 64, tuneCents: -2 },
  { url: "/audio/Fs4.flac", rootMidi: 66, lowMidi: 65, highMidi: 66, tuneCents: -11 },
  { url: "/audio/G4.flac", rootMidi: 67, lowMidi: 67, highMidi: 67, tuneCents: -1 },
  { url: "/audio/A4.flac", rootMidi: 69, lowMidi: 68, highMidi: 69, tuneCents: 0 },
  { url: "/audio/B4.flac", rootMidi: 71, lowMidi: 70, highMidi: 71, tuneCents: 0 },
  { url: "/audio/Cs5.flac", rootMidi: 73, lowMidi: 72, highMidi: 73, tuneCents: 0 },
  { url: "/audio/Ds5.flac", rootMidi: 75, lowMidi: 74, highMidi: 75, tuneCents: 3 },
  { url: "/audio/F5.flac", rootMidi: 77, lowMidi: 76, highMidi: 77, tuneCents: 4 },
  { url: "/audio/G5.flac", rootMidi: 79, lowMidi: 78, highMidi: 79, tuneCents: 6 },
  { url: "/audio/A5.flac", rootMidi: 81, lowMidi: 80, highMidi: 82, tuneCents: 8 },
  { url: "/audio/C6.flac", rootMidi: 84, lowMidi: 83, highMidi: 86, tuneCents: 4 },
] as const;

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export function findSampleRegion(midi: number): SampleRegion {
  const mapped = SAMPLE_REGIONS.find((region) => midi >= region.lowMidi && midi <= region.highMidi);
  if (mapped) return mapped;
  return SAMPLE_REGIONS.reduce((closest, region) =>
    Math.abs(region.rootMidi - midi) < Math.abs(closest.rootMidi - midi) ? region : closest,
  );
}

export function playbackRateFor(midi: number, region = findSampleRegion(midi)): number {
  const semitones = midi - region.rootMidi + region.tuneCents / 100;
  return 2 ** (semitones / 12);
}

export function normalizeVelocity(velocity: number): number {
  return clamp(velocity, 0.08, 0.92);
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly activeVoices = new Map<number, ActiveVoice>();
  private volume = 0.72;
  private muted = false;

  get isReady(): boolean {
    return this.context?.state === "running" && this.buffers.size === SAMPLE_REGIONS.length;
  }

  async initialize(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.limiter.threshold.value = -12;
      this.limiter.knee.value = 8;
      this.limiter.ratio.value = 10;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.12;
      this.master.connect(this.limiter).connect(this.context.destination);
      this.applyMasterLevel();
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    if (this.buffers.size !== SAMPLE_REGIONS.length) {
      this.buffers.clear();
      await Promise.all(
        SAMPLE_REGIONS.map(async (region) => {
          const response = await fetch(region.url);
          if (!response.ok) {
            throw new Error(`Could not load ${region.url} (${response.status})`);
          }
          const buffer = await this.context!.decodeAudioData(await response.arrayBuffer());
          this.buffers.set(region.url, buffer);
        }),
      );
    }
  }

  pluckString(stringIndex: number, midi: number, velocity = 0.7, delaySeconds = 0): void {
    if (!this.context || !this.master || !this.isReady) return;

    const startAt = this.context.currentTime + Math.max(0, delaySeconds);
    this.startVoice(stringIndex, midi, velocity, startAt);
  }

  playTogether(midis: readonly number[], velocity = 0.72): void {
    if (!this.context || !this.master || !this.isReady) return;

    const sharedStartAt = this.context.currentTime + 0.006;
    midis.forEach((midi, stringIndex) => {
      this.startVoice(stringIndex, midi, velocity, sharedStartAt);
    });
  }

  strum(midis: readonly number[], direction: StrumDirection, velocity = 0.72): void {
    const indices = direction === "down" ? [0, 1, 2, 3] : [3, 2, 1, 0];
    indices.forEach((stringIndex, order) => {
      const midi = midis[stringIndex];
      if (typeof midi === "number") {
        this.pluckString(stringIndex, midi, velocity, order * 0.024);
      }
    });
  }

  private startVoice(stringIndex: number, midi: number, velocity: number, startAt: number): void {
    if (!this.context || !this.master) return;

    const region = findSampleRegion(midi);
    const buffer = this.buffers.get(region.url);
    if (!buffer) return;

    const now = this.context.currentTime;
    const previous = this.activeVoices.get(stringIndex);
    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(Math.max(previous.gain.gain.value, 0.0001), now);
      previous.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
      previous.source.stop(now + 0.026);
    }

    const source = this.context.createBufferSource();
    const voiceGain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRateFor(midi, region);
    voiceGain.gain.setValueAtTime(0.0001, startAt);
    voiceGain.gain.exponentialRampToValueAtTime(normalizeVelocity(velocity), startAt + 0.004);
    source.connect(voiceGain).connect(this.master);
    source.start(startAt);

    const voice = { source, gain: voiceGain };
    this.activeVoices.set(stringIndex, voice);
    source.addEventListener("ended", () => {
      if (this.activeVoices.get(stringIndex) === voice) {
        this.activeVoices.delete(stringIndex);
      }
      source.disconnect();
      voiceGain.disconnect();
    });
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.applyMasterLevel();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterLevel();
  }

  dispose(): void {
    for (const voice of this.activeVoices.values()) {
      try {
        voice.source.stop();
      } catch {
        // The source may already have ended.
      }
    }
    this.activeVoices.clear();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.limiter = null;
    this.buffers.clear();
  }

  private applyMasterLevel(): void {
    if (!this.context || !this.master) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.012);
  }
}
