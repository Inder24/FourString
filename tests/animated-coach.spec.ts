import { test, expect, type Page } from "@playwright/test";

import { installTeachingFixture, completeCalibration, captureStrums } from './helpers/ai-fixture';

test("prepares for five seconds then shows the audible countdown and PLAY", async ({ page }) => {
  await installTeachingFixture(page);
  await expect(page.locator("#ai-slots")).not.toContainText("↑");
  await page.getByRole("button", { name: "Start first take", exact: true }).click();
  await completeCalibration(page);
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true");
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "preparing");
  await expect(page.locator("#ai-start-count")).toHaveText("5");
  await page.clock.runFor(5000);
  await expect(page.locator("#ai-start-count")).toHaveText("4");
  await page.clock.runFor(860);
  await expect(page.locator("#ai-start-count")).toHaveText("3");
  await page.clock.runFor(2580);
  await expect(page.locator("#ai-start-count")).toHaveText("PLAY");
  await page.evaluate(() => { (window as any).teachingFixture.rms = .16; });
  await page.clock.runFor(48);
  await expect(page.locator("#ai-hit-count")).toHaveText("1 heard");
});

test("optional chord changes update the teaching diagram", async ({ page }) => {
  await installTeachingFixture(page);
  await page.getByLabel("Practise chord changes").check();
  await page.getByRole("button", { name: "Watch & hear", exact: true }).click();
  await expect(page.locator("[data-guide-chord]")).toContainText("C");
  await page.clock.runFor(1900);
  await expect(page.locator("[data-guide-chord]")).toContainText("F");
  await page.clock.runFor(1700);
  await expect(page.locator("[data-guide-chord]")).toContainText("G");
});

for (const [pattern, count] of [["steady-downs", 32], ["alternating-pulse", 64], ["island-rhythm", 48]] as const) {
  test(`animated ${pattern} schedules only sounded strokes and cancels future voices`, async ({ page }) => {
    await installTeachingFixture(page);
    await page.locator(`[data-ai-pattern="${pattern}"]`).click();
    await page.getByRole("button", { name: "Watch & hear", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).teachingFixture.starts.length)).toBe(count);
    const starts = await page.evaluate(() => (window as any).teachingFixture.starts as number[]);
    expect(starts[1] - starts[0]).toBeCloseTo(.024, 4);
    await page.clock.runFor(650);
    await expect(page.locator("#ai-strumming-guide")).toHaveAttribute("data-direction", "up");
    await expect(page.locator("#ai-strumming-guide")).toHaveAttribute("data-silent", pattern === "alternating-pulse" ? "false" : "true");
    await expect(page.locator("[data-guide-cycle]")).toContainText("loop 1 / 2");
    await page.clock.runFor(3000);
    await expect(page.locator("[data-guide-cycle]")).toContainText("loop 2 / 2");
    await page.getByRole("button", { name: "Stop example", exact: true }).click();
    await expect(page.locator("#ai-strumming-guide")).toHaveAttribute("data-moving", "false");
    expect(await page.evaluate(() => (window as any).teachingFixture.stops.length)).toBeGreaterThanOrEqual(count);
    await page.clock.runFor(8000);
    await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "setup");
  });
}

test("attributes AI coaching without labeling local-only destinations", async ({ page }, testInfo) => {
  await installTeachingFixture(page);
  await expect(page.locator(".ai-coach-header").getByText("Powered by GPT-6 Astra", { exact: true })).toBeVisible();
  await expect(page.locator("#ai-connection")).toContainText("API key configured");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".ai-coach-header").screenshot({ path: testInfo.outputPath("attribution-header.png") });
  for (const name of ["Play", "Practice", "Quick drills", "Tune"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText("Powered by GPT-6 Astra", { exact: true }).filter({ visible: true })).toHaveCount(0);
  }
});

test("shows live attacks, watches Astra's slower focus, counts in, and compares", async ({ page }, testInfo) => {
  await installTeachingFixture(page);
  await page.locator("#ai-chord-changes").check();
  await page.getByRole("button", { name: "Start first take", exact: true }).click();
  await completeCalibration(page);
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true");
  await page.clock.runFor(5000);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "count-in");
  await expect(page.locator("#ai-live-status")).toHaveText("Count-in · 4");
  await page.clock.runFor(3650);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "recording");
  await page.evaluate(() => { (window as any).teachingFixture.rms = .09; });
  await page.clock.runFor(30);
  await page.evaluate(() => { (window as any).teachingFixture.rms = .001; });
  await expect(page.locator(".ai-heard-marker")).toHaveCount(1);
  await expect(page.locator("#ai-hit-count")).toContainText("1 heard");
  await page.clock.runFor(200);
  await captureStrums(page, 4, 850);
  await page.clock.runFor(3300);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "retry-count-in");
  await expect(page.locator("#ai-correction-panel").getByText("Powered by GPT-6 Astra", { exact: true })).toBeVisible();
  if (page.viewportSize()!.width <= 1100) {
    await expect(page.locator(".ai-guide-correction").getByText("Powered by GPT-6 Astra", { exact: true })).toBeVisible();
    await page.locator(".ai-guide-correction").screenshot({ path: testInfo.outputPath("attribution-inline.png") });
  }
  await page.locator("#ai-correction-panel").screenshot({ path: testInfo.outputPath("attribution-correction.png") });
  await page.evaluate(() => { (window as any).teachingFixture.starts = []; });
  await page.clock.runFor(9000);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "retry-count-in");
  await page.clock.runFor(1100);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "focused-demo");
  await expect(page.locator("#ai-tempo")).toHaveText("60");
  await page.clock.runFor(100);
  await expect(page.locator("[data-guide-chord]")).toContainText("F");
  await expect(page.locator("[data-guide-next]")).toContainText("C");
  await expect(page.locator("[data-guide-cue]")).toContainText("return gently");
  await expect(page.locator("#ai-live-signal")).toContainText("Mic off");
  await expect(page.locator(".ai-slot.is-focus")).toHaveCount(3);
  const focusedStarts = await page.evaluate(() => (window as any).teachingFixture.starts as number[]);
  expect(focusedStarts[4] - focusedStarts[0]).toBeCloseTo(1, 4);
  expect(focusedStarts[8] - focusedStarts[4]).toBeCloseTo(1, 4);
  await page.clock.runFor(4200);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "preparing");
  await page.clock.runFor(5000);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "count-in");
  await page.clock.runFor(4200);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "recording");
  await captureStrums(page, 4, 1000);
  await page.clock.runFor(400);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "comparison");
  await expect(page.locator("#ai-play-first")).toBeEnabled();
  await expect(page.locator("#ai-play-new")).toBeEnabled();
  await expect(page.locator("#ai-tempo-context")).toContainText("Your retry · 60 BPM");
  await expect(page.locator(".ai-trace-row")).toHaveCount(3);
  await expect(page.locator("#ai-comparison-traces")).toContainText("First take · 70 BPM");
  await expect(page.locator("#ai-comparison-traces")).toContainText("New take · 60 BPM");
  await page.locator("#ai-comparison").screenshot({ path: testInfo.outputPath("take-comparison.png") });
  await page.locator("#ai-reset").click();
  await expect(page.locator("#ai-hit-count")).toHaveText("0 heard");
});

test("can cancel a focused demonstration, replay without recording, and leave cleanly", async ({ page }) => {
  await installTeachingFixture(page);
  await page.getByRole("button", { name: "Start first take", exact: true }).click();
  await completeCalibration(page);
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true");
  await page.clock.runFor(5000);
  await expect(page.locator("#ai-live-status")).toHaveText("Count-in · 4");
  await page.clock.runFor(3650);
  await captureStrums(page, 4, 850);
  await page.clock.runFor(3800);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "retry-count-in");
  await page.clock.runFor(10100);
  await page.locator("#ai-cancel").click();
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "correction");
  await page.locator("#ai-watch-focus").click();
  await page.clock.runFor(4400);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "correction");
  await expect(page.locator("#ai-live-signal")).toContainText("Mic off");
  await page.locator("#ai-watch-focus").click();
  await page.getByRole("button", { name: "Tune", exact: true }).click();
  await page.clock.runFor(10000);
  await page.getByRole("button", { name: "AI Coach", exact: true }).click();
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "setup");
  await expect(page.locator("#ai-strumming-guide")).toHaveAttribute("data-moving", "false");
});

test("keeps the guide readable on mobile and honors reduced motion with keyboard controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTeachingFixture(page);
  const guide = await page.locator(".ai-guide-uke").boundingBox();
  expect(guide!.height).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#ai-demo").focus();
  await page.keyboard.press("Enter");
  await page.clock.runFor(650);
  await expect(page.locator("[data-guide-hand]")).toHaveAttribute("transform", "translate(451 78)");
  await expect(page.locator("#ai-playhead")).toHaveCSS("opacity", "0");
  await page.locator("#ai-demo").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "setup");
});
