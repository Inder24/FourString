export const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export function supportedRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return RECORDING_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType)) ?? "";
}

export class AttemptRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  get isSupported(): boolean {
    return typeof MediaRecorder !== "undefined";
  }

  get isRecording(): boolean {
    return this.recorder?.state === "recording";
  }

  start(stream: MediaStream): boolean {
    if (!this.isSupported || this.isRecording) return false;
    this.chunks = [];
    const mimeType = supportedRecordingMimeType();
    try {
      this.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      this.recorder.addEventListener("dataavailable", this.handleData);
      this.recorder.start(200);
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.cleanup();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const finish = () => {
        const type = recorder.mimeType || this.chunks[0]?.type || "audio/webm";
        const blob = this.chunks.length ? new Blob(this.chunks, { type }) : null;
        this.cleanup();
        resolve(blob);
      };
      recorder.addEventListener("stop", finish, { once: true });
      recorder.addEventListener("error", () => {
        this.cleanup();
        resolve(null);
      }, { once: true });
      recorder.stop();
    });
  }

  discard(): void {
    const recorder = this.recorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.addEventListener("stop", () => this.cleanup(), { once: true });
      recorder.stop();
      return;
    }
    this.cleanup();
  }

  private readonly handleData = (event: BlobEvent): void => {
    if (event.data.size) this.chunks.push(event.data);
  };

  private cleanup(): void {
    this.recorder?.removeEventListener("dataavailable", this.handleData);
    this.recorder = null;
    this.chunks = [];
  }
}
