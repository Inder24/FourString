import { describe, expect, it, vi } from "vitest";
import { RECORDING_MIME_TYPES, supportedRecordingMimeType } from "./attempt-recorder";

describe("attempt recorder", () => {
  it("prefers an Opus recording format when available", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (type: string) => type === RECORDING_MIME_TYPES[0] });
    expect(supportedRecordingMimeType()).toBe("audio/webm;codecs=opus");
    vi.unstubAllGlobals();
  });

  it("allows the browser to choose when no listed format is supported", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => false });
    expect(supportedRecordingMimeType()).toBe("");
    vi.unstubAllGlobals();
  });
});
