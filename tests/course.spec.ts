import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("four-strings-course-foundations-v1"));
  await page.reload();
  await page.locator("#nav-lessons").click();
});

test("Book One exposes all 24 lessons and Continue opens the first unfinished lesson", async ({ page }) => {
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "lessons");
  await expect(page.getByRole("heading", { name: "Book One · Foundations" })).toBeVisible();
  await expect(page.locator("[data-course-lesson]")).toHaveCount(24);
  await expect(page.locator("[data-course-lesson][disabled]")).toHaveCount(0);
  await expect(page.locator("#course-progress-summary")).toContainText("0 completed · 0 secure");

  await page.locator("#course-continue").click();
  await expect(page.locator("#course-reader")).toBeVisible();
  await expect(page.locator("#course-reader-title")).toHaveText("Your ukulele and you");
  await expect(page.locator("[data-course-stage]")).toHaveCount(6);
  await expect(page.locator("[data-course-stage='see']")).toHaveAttribute("aria-current", "step");
});

test("a self-check lesson becomes Completed and Secure, persists, and can be reset", async ({ page }) => {
  await page.locator("[data-course-lesson='your-ukulele']").click();
  for (let stage = 0; stage < 3; stage += 1) await page.locator("#course-next").click();
  await expect(page.locator("#course-activity")).toContainText("Now you try");
  for (const check of await page.locator("[data-course-check]").all()) await check.check();
  await page.locator("#course-submit").click();
  await page.locator("#course-next").click();
  for (const check of await page.locator("[data-course-check]").all()) await check.check();
  await page.locator("#course-submit").click();
  await expect(page.locator("#course-evaluation")).toContainText("Secure");
  await page.locator("#course-next").click();
  await page.locator("#course-back-home").click();
  await expect(page.locator("#course-progress-summary")).toContainText("1 completed · 1 secure");

  await page.reload();
  await page.locator("#nav-lessons").click();
  await expect(page.locator("[data-course-lesson='your-ukulele']")).toContainText("Secure");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#course-reset").click();
  await expect(page.locator("#course-progress-summary")).toContainText("0 completed · 0 secure");
});

test("input mode is explicit and using the instrument before an ear answer keeps it exploratory", async ({ page }) => {
  await page.locator("[data-course-lesson='find-sa']").click();
  await page.locator("#course-input-real").click();
  await expect(page.locator("#course-input-real")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#course-input-note")).toContainText("microphone");
  await page.locator("#course-input-screen").click();
  await expect(page.locator("#course-input-screen")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#course-next").click();
  await page.locator("#course-next").click();
  await expect(page.locator("#course-activity")).toContainText("What did you hear?");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("four-strings:note", { detail: { midi: 60, stringIndex: 1, fret: 0 } })));
  await expect(page.locator("#course-ear-warning")).toBeVisible();
  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.locator("#course-evaluation")).toContainText("Exploratory");
  await expect(page.locator("#course-evaluation")).toContainText("Try again before touching the instrument");
});

test("leaving Lessons cleans up the reader and restores Play", async ({ page }) => {
  await page.locator("[data-course-lesson='find-the-pulse']").click();
  await page.locator("#nav-play").click();
  await expect(page.locator("#course-workbench")).toBeHidden();
  await expect(page.locator("#instrument-frame")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "strum");
});
