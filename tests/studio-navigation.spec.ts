import { expect, test } from "@playwright/test";

test("Songs is a direct Learn destination without losing Practice drills", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("#nav-lessons")).toBeVisible();
  await page.locator("#nav-lessons").click();
  await expect(page.locator("#course-workbench")).toBeVisible();
  await expect(page.locator("#nav-lessons")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#nav-songs")).toBeVisible();
  await page.locator("#nav-songs").click();
  await expect(page.locator("#lesson-workbench")).toBeVisible();
  await expect(page.locator("#nav-songs")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#nav-practice").click();
  await expect(page.locator("#practice-workbench")).toBeVisible();
  await page.locator("#mode-coach").click();
  await expect(page.locator("#coach-workbench")).toBeVisible();
  await expect(page.locator("#nav-practice")).toHaveAttribute("aria-pressed", "true");
  if (!isMobile) await expect(page.locator("#rail-tools")).toBeVisible();
});

test("phone Tools opens its three destinations and closes after selection", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The compact Tools menu is for phones");
  await page.goto("/");
  const tools = page.locator("#nav-tools");
  await expect(tools).toBeVisible();
  await expect(tools).toContainText("More");
  await expect(page.locator("#mode-ai-coach")).toBeHidden();
  await expect(tools).toHaveAttribute("aria-expanded", "false");
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#rail-tools")).toBeVisible();
  await expect(page.locator("#mobile-mode-ai-coach")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear frets" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Volume" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute sound" })).toBeVisible();
  await expect(page.locator(".help-menu summary")).toBeVisible();
  await page.locator("#mode-tempo").click();
  await expect(page.locator("#tempo-workbench")).toBeVisible();
  await expect(tools).toHaveAttribute("aria-pressed", "true");
  await expect(tools).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#rail-tools")).toBeHidden();
});

test("phone navigation is Play, Lessons, Practice, Songs, More and lessons keep a compact instrument dock", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Phone navigation contract");
  await page.goto("/");
  const labels = await page.locator(".control-ribbon .mode-button:visible > span").allTextContents();
  expect(labels.map((label) => label.trim())).toEqual(["PlayJump in and play", "LessonsBook One foundations", "PracticeBuild your skills", "SongsPlay real music", "More"]);
  await page.locator("#nav-lessons").click();
  await page.locator("#course-continue").click();
  await expect(page.locator("#instrument-frame")).toBeInViewport();
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-course-dock", "compact");
  await page.locator("#course-instrument-toggle").click();
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-course-dock", "expanded");
  await expect(page.locator("#fretboard")).toBeVisible();
});

test("Lessons remains keyboard reachable and reduced motion removes its arrival animation", async ({ page, isMobile }) => {
  test.skip(isMobile, "Run once on desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#nav-lessons").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#course-workbench")).toBeVisible();
  await expect(page.locator("#course-home, .course-home")).toHaveCSS("animation-name", "none");
});

test("desktop gives the live instrument a canvas beside a fixed studio rail", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop layout contract");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const rail = page.locator(".control-ribbon");
  await expect(rail).toHaveCSS("position", "fixed");
  const railBox = await rail.boundingBox();
  const instrumentBox = await page.locator("#instrument-frame").boundingBox();
  expect(railBox).not.toBeNull();
  expect(instrumentBox).not.toBeNull();
  expect(railBox!.width).toBeGreaterThanOrEqual(220);
  expect(instrumentBox!.x).toBeGreaterThanOrEqual(railBox!.width);
  expect(instrumentBox!.width).toBeGreaterThan(760);
});

test("tablet and landscape preserve navigation without page-wide horizontal scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "Viewport sweep runs once in desktop Chromium");
  for (const viewport of [{ width: 1024, height: 768 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#nav-songs")).toBeVisible();
    await expect(page.locator("#mode-tuner")).toBeVisible();
    await expect(page.locator("#strum-surface")).toBeVisible();
    const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  }
});
