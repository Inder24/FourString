import { clamp, type StringId } from "./music";

export interface PitchReading {
  frequency: number;
  confidence: number;
  rms: number;
}

export interface SignalFrame {
  rms: number;
  at: number;
}

export interface TuningTarget {
  id: StringId;
  label: string;
  midi: number;
  frequency: number;
  stringIndex: number;
}

export interface TargetedPitch extends PitchReading {
  target: TuningTarget;
  cents: number;
}

export type TunerStatus = "idle" | "requesting" | "listening" | "error";

export const TUNING_TARGETS: readonly TuningTarget[] = [
  tuningTarget("G", "G4", 67, 0),
  tuningTarget("C", "C4", 60, 1),
  tuningTarget("E", "E4", 64, 2),
  tuningTarget("A", "A4", 69, 3),
] as const;

function tuningTarget(id: StringId, label: string, midi: number, stringIndex: number): TuningTarget {
  return { id, label, midi, stringIndex, frequency: 440 * 2 ** ((midi - 69) / 12) };
}

export function centsBetween(frequency: number, targetFrequency: number): number {
  if (frequency <= 0 || targetFrequency <= 0) return Number.NaN;
  return 1200 * Math.log2(frequency / targetFrequency);
}

export function targetPitch(
  reading: PitchReading,
  manualTarget: StringId | null = null,
): TargetedPitch {
  const candidates = manualTarget
    ? TUNING_TARGETS.filter((target) => target.id === manualTarget)
    : TUNING_TARGETS;
  const target = candidates.reduce((closest, candidate) =>
    Math.abs(centsBetween(reading.frequency, candidate.frequency)) <
    Math.abs(centsBetween(reading.frequency, closest.frequency))
      ? candidate
      : closest,
  );
  return { ...reading, target, cents: centsBetween(reading.frequency, target.frequency) };
}

/** Detects a monophonic pitch using the YIN cumulative mean normalized difference. */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  minFrequency = 180,
  maxFrequency = 520,
): PitchReading | null {
  if (samples.length < 256 || sampleRate <= 0) return null;

  let squareSum = 0;
  for (const sample of samples) squareSum += sample * sample;
  const rms = Math.sqrt(squareSum / samples.length);
  if (rms < 0.008) return null;

  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(samples.length / 2));
  const difference = new Float32Array(maxTau + 1);

  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    for (let index = 0; index < samples.length - tau; index += 1) {
      const delta = samples[index] - samples[index + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  const normalized = new Float32Array(maxTau + 1);
  normalized[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    normalized[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }

  let tau = -1;
  for (let candidate = minTau; candidate <= maxTau; candidate += 1) {
    if (normalized[candidate] < 0.18) {
      while (candidate + 1 <= maxTau && normalized[candidate + 1] < normalized[candidate]) {
        candidate += 1;
      }
      tau = candidate;
      break;
    }
  }
  if (tau < 0) return null;

  const left = tau > 1 ? normalized[tau - 1] : normalized[tau];
  const center = normalized[tau];
  const right = tau < maxTau ? normalized[tau + 1] : normalized[tau];
  const denominator = 2 * (2 * center - right - left);
  const refinedTau = denominator === 0 ? tau : tau + (right - left) / denominator;
  const frequency = sampleRate / refinedTau;
  if (!Number.isFinite(frequency) || frequency < minFrequency || frequency > maxFrequency) return null;

  return {
    frequency,
    confidence: clamp(1 - center, 0, 1),
    rms,
  };
}

export function signalRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let squareSum = 0;
  for (const sample of samples) squareSum += sample * sample;
  return Math.sqrt(squareSum / samples.length);
}

export class TunerEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private frame = 0;
  private frequencies: number[] = [];
  private lastDetectedAt = 0;

  get isListening(): boolean {
    return this.stream !== null;
  }

  async start(
    onReading: (reading: PitchReading | null, signal: SignalFrame) => void,
    onStatus: (status: TunerStatus, message: string) => void,
  ): Promise<void> {
    if (this.isListening) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onStatus("error", "Microphone tuning needs a secure browser context.");
      return;
    }

    onStatus("requesting", "Waiting for microphone permission…");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      this.context = new AudioContext({ latencyHint: "interactive" });
      if (this.context.state === "suspended") await this.context.resume();
      this.source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0;
      this.source.connect(this.analyser);
      onStatus("listening", "Listening — play one string and let it ring.");
      this.read(onReading);
    } catch (error) {
      this.stop();
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      onStatus(
        "error",
        denied
          ? "Microphone access was denied. Allow it in browser settings, then try again."
          : "The microphone could not start. Check your input device and try again.",
      );
    }
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.frequencies = [];
    this.lastDetectedAt = 0;
  }

  private read(onReading: (reading: PitchReading | null, signal: SignalFrame) => void): void {
    if (!this.context || !this.analyser) return;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    const reading = detectPitch(samples, this.context.sampleRate);
    const signal = { rms: signalRms(samples), at: performance.now() };
    if (reading) {
      if (signal.at - this.lastDetectedAt > 750) this.frequencies = [];
      this.lastDetectedAt = signal.at;
      this.frequencies.push(reading.frequency);
      if (this.frequencies.length > 7) this.frequencies.shift();
      const sorted = [...this.frequencies].sort((a, b) => a - b);
      onReading({ ...reading, frequency: sorted[Math.floor(sorted.length / 2)] }, signal);
    } else {
      // Real strings naturally produce brief gaps as their overtones decay. Keep the
      // smoothing window through those gaps so the needle does not jump on reacquire.
      if (signal.at - this.lastDetectedAt > 750) this.frequencies = [];
      onReading(null, signal);
    }
    this.frame = requestAnimationFrame(() => this.read(onReading));
  }
}
