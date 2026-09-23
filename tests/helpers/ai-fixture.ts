import { expect, type Page } from '@playwright/test';
// Synthetic signals only: these tests never request the computer's microphone.
export async function installTeachingFixture(page: Page) {
  await page.route("**/api/adaptive-coach/status", route => route.fulfill({ json: { configured: true } }));
  await page.route("**/api/adaptive-coach", route => route.fulfill({ json: { decision: {
    issue: "uneven", correction: "Keep the ending evenly spaced.", evidence: "The ending varied more than the opening.",
    focusStartSlot: 4, focusEndSlot: 6, retryBpm: 60, repetitions: 2, visualCue: "relax-return",
  } } }));
  await page.addInitScript(() => {
    const fixture = { rms: .001, starts: [] as number[], stops: [] as number[], stoppedTracks: 0 };
    Object.assign(window, { teachingFixture: fixture });
    class Param { value = 1; setValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} exponentialRampToValueAtTime() {} }
    class Node extends EventTarget {
      gain = new Param(); threshold = new Param(); knee = new Param(); ratio = new Param();
      attack = new Param(); release = new Param(); frequency = new Param(); playbackRate = new Param();
      connect<T>(target: T) { return target; } disconnect() {}
      start(at: number) { fixture.starts.push(at); }
      stop(at: number) { fixture.stops.push(at); }
    }
    class Context {
      state = "running"; sampleRate = 48_000; destination = new Node();
      get currentTime() { return performance.now() / 1000; }
      createGain() { return new Node(); } createDynamicsCompressor() { return new Node(); }
      createBufferSource() { return new Node(); } createOscillator() { return new Node(); }
      createMediaStreamSource() { return new Node(); }
      createAnalyser() { return { fftSize: 4096, smoothingTimeConstant: 0,
        getFloatTimeDomainData(buffer: Float32Array) { buffer.fill(fixture.rms); } }; }
      async decodeAudioData() { return {}; } async resume() {} async close() {}
    }
    class Recorder extends EventTarget {
      static isTypeSupported() { return true; }
      state = "inactive"; mimeType = "audio/webm";
      start() { this.state = "recording"; }
      stop() { this.state = "inactive";
        this.dispatchEvent(new BlobEvent("dataavailable", { data: new Blob(["synthetic take"]) }));
        this.dispatchEvent(new Event("stop")); }
    }
    Object.defineProperty(window, "AudioContext", { value: Context, configurable: true });
    Object.defineProperty(window, "MediaRecorder", { value: Recorder, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => ({
      getTracks: () => [{ stop() { fixture.stoppedTracks++; } }],
    }) }, configurable: true });
  });
  await page.clock.install();
  await page.goto("/");
  await openAiCoach(page);
  await expect(page.locator("#ai-connection")).toContainText("API key configured");
}

export async function openAiCoach(page: Page): Promise<void> {
  if (!(await page.locator("#mode-ai-coach").isVisible())) {
    const more = page.locator("#nav-tools");
    if (await more.getAttribute("aria-expanded") === "false") await more.click();
    await page.locator("#mobile-mode-ai-coach").click();
    return;
  }
  await page.locator("#mode-ai-coach").click();
}

export async function completeCalibration(page: Page): Promise<void> {
  await expect(page.locator('#ai-calibration')).toBeVisible();
  await page.clock.runFor(1500);
  await page.evaluate(() => { (window as any).teachingFixture.rms = .09; });
  await page.clock.runFor(80);
  await page.evaluate(() => { (window as any).teachingFixture.rms = .001; });
  await page.locator('#ai-calibration-continue').click();
}

export async function captureStrums(page: Page, count: number, gapMs: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => { (window as any).teachingFixture.rms = .09; });
    await page.clock.runFor(32);
    await page.evaluate(() => { (window as any).teachingFixture.rms = .001; });
    await page.clock.runFor(gapMs - 32);
  }
}
