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
  await expect(page.locator(".course-ukulele-map img")).toHaveAttribute("src", "/course/ukulele-parts-v1.png");
  await expect(page.locator(".course-concept-visual > span")).toHaveCount(0);
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-course-dock", "compact");
});

test("lesson one teaches parts interactively and uses plain-language stages", async ({ page }) => {
  await page.locator("[data-course-lesson='your-ukulele']").click();
  await expect(page.locator("[data-course-stage]")).toHaveText(["1Learn", "2Listen", "3Find", "4Try", "5Check", "6Finish"]);
  await page.locator("[data-course-part='sound-hole']").click();
  await expect(page.locator("#course-part-detail")).toContainText("Sound hole");

  await page.locator("[data-course-stage='guess']").click();
  await expect(page.getByRole("heading", { name: "Which part lets the ukulele body project the sound?" })).toBeVisible();
  await page.getByRole("button", { name: "Sound hole" }).click();
  await expect(page.locator("#course-evaluation")).toContainText("Correct");
  await expect(page.locator("#course-evaluation")).not.toContainText("Secure");
});

test("rhythm lessons provide an explicit count-in and live attack progress", async ({ page }) => {
  await page.locator("[data-course-lesson='find-the-pulse']").click();
  await page.locator("[data-course-stage='play']").click();
  await expect(page.getByRole("button", { name: "Start 4-beat count-in" })).toBeVisible();
  await expect(page.locator("#course-attempt-guidance")).toContainText("Strum once on each bright pulse");
  await expect(page.locator(".course-rhythm-lane [data-slot]")).toHaveCount(4);
});

test("a single stage click changes both the selected step and activity", async ({ page }) => {
  await page.locator("[data-course-lesson='your-ukulele']").click();
  await page.locator("[data-course-stage='play']").click();
  await expect(page.locator("[data-course-stage='play']")).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { name: "Now you try" })).toBeVisible();
  await expect(page.locator("#course-activity")).toContainText("No microphone needed");
});

test("real-ukulele chord lessons explain their four-string acceptance flow", async ({ page }) => {
  await page.locator("[data-course-lesson='first-chord-family']").click();
  await page.locator("[data-course-stage='play']").click();
  await page.locator("#course-input-real").click();
  await expect(page.locator("#course-attempt-guidance")).toContainText("Hold C, then pick string 4");
  await expect(page.locator(".course-honesty-note")).toContainText("pick strings 4 → 3 → 2 → 1");
  await expect(page.locator(".course-now-try")).toContainText("0 of 4 strings matched");
});

test("all 24 lessons render every activity without generic or missing content", async ({ page }) => {
  const lessonIds = await page.locator("[data-course-lesson]").evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.courseLesson ?? ""));
  for (const lessonId of lessonIds) {
    await page.locator(`[data-course-lesson='${lessonId}']`).click();
    for (const stage of ["see", "hear", "guess", "play", "check", "recap"]) {
      await page.locator(`[data-course-stage='${stage}']`).click();
      await expect(page.locator("#course-activity h3")).not.toHaveText("");
      await expect(page.locator("#course-activity")).not.toContainText("undefined");
      if (stage === "guess") await expect(page.locator("#course-activity h3")).not.toHaveText("What did you hear?");
    }
    await page.locator("#course-back-home").click();
  }
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
  await expect(page.locator("#course-activity")).toContainText("Where did the phrase finally settle?");
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

test("lesson coaching renders Astra text without treating it as markup", async ({ page }) => {
  await page.route("**/api/lesson-coach", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        decision: {
          correction: '<img src=x onerror="window.__lessonCoachInjected=true">Keep the pulse even.',
          evidence: "Only 50% of attacks were on time.",
        },
      }),
    });
  });
  await page.evaluate(() => {
    localStorage.setItem("four-strings-course-foundations-v1", JSON.stringify({
      schemaVersion: 1,
      courseId: "foundations-v1",
      lastLessonId: "find-the-pulse",
      lessons: {
        "find-the-pulse": {
          attempts: 1,
          completedAt: "2026-09-23T00:00:00.000Z",
          secureAt: null,
          bestResult: {
            attempted: true,
            secure: false,
            accuracy: 0.5,
            evidence: { onTimeRate: 0.5 },
            retryHint: "Keep the pulse even.",
          },
        },
      },
    }));
  });
  await page.reload();
  await page.locator("#nav-lessons").click();
  await page.locator("[data-course-lesson='find-the-pulse']").click();
  await page.locator("[data-course-stage='recap']").click();
  await page.locator("#course-ask-astra").click();

  const coaching = page.locator(".course-astra-card");
  await expect(coaching).toContainText("<img src=x");
  await expect(coaching.locator("img")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-lesson-coach-injected", "true");
  await expect.poll(() => page.evaluate(() => Boolean((window as Window & { __lessonCoachInjected?: boolean }).__lessonCoachInjected))).toBe(false);
});
