import { afterEach, describe, expect, it, vi } from "vitest";
import { TunerEngine } from "./tuner";

afterEach(() => vi.unstubAllGlobals());

describe("shared microphone permission lifecycle", () => {
  it("releases a stream granted after its coach has been left", async () => {
    let grant!: (stream: MediaStream) => void;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { grant = resolve; }) } });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const stop = vi.fn();
    const status = vi.fn();
    const engine = new TunerEngine();
    const pending = engine.start(vi.fn(), status);
    engine.stop();
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await pending;
    expect(stop).toHaveBeenCalledOnce();
    expect(engine.isListening).toBe(false);
    expect(status).toHaveBeenCalledTimes(1);
  });

  it("ignores a late permission rejection after cancellation", async () => {
    let reject!: (error: Error) => void;
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise((_resolve, fail) => { reject = fail; }) } });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const status = vi.fn();
    const engine = new TunerEngine();
    const pending = engine.start(vi.fn(), status);
    engine.stop();
    reject(new DOMException("Denied", "NotAllowedError"));
    await pending;
    expect(status).toHaveBeenCalledTimes(1);
  });
});
