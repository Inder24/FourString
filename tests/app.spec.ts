import { expect, test, type Page } from "@playwright/test";
import { completeCalibration, captureStrums } from './helpers/ai-fixture';

async function enableAudio(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Play on screen", exact: true }).click();
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
}

async function openToolsIfCompact(page: Page): Promise<void> {
  const tools = page.locator("#nav-tools");
  if (await tools.isVisible() && await tools.getAttribute("aria-expanded") === "false") await tools.click();
}

async function openTuner(page: Page): Promise<void> {
  await openToolsIfCompact(page);
  await page.locator("#mode-tuner").click();
}

test("loads the real sample instrument and latches a mouse shape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#instrument-title")).toHaveText("Good to see you.");
  await enableAudio(page);

  const cChordAString = page.locator('.fret-cell[data-string="3"][data-fret="3"]');
  await cChordAString.click();
  await expect(cChordAString).toHaveClass(/is-latched/);
  await page.keyboard.press("Space");
  await expect(page.locator("#readout-label")).toHaveText("Last chord");
  await expect(page.locator("#last-note")).toHaveText("Frets 0–0–0–3 · G4 · C4 · E4 · C5");

  await openToolsIfCompact(page);
  await page.getByRole("button", { name: "Clear frets" }).click();
  await expect(cChordAString).not.toHaveClass(/is-latched/);
});

test("explore mode plays a fret immediately", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Fingerpick", exact: true }).click();
  await page.locator('.fret-cell[data-string="1"][data-fret="2"]').click();
  await expect(page.locator("#last-note")).toContainText("D4 · C string · fret 2");
});

test("supports keyboard navigation, plucking, and reverse strum", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="1"]')).toHaveClass(/is-latched/);
  await page.keyboard.press("Digit1");
  await expect(page.locator("#last-note")).toContainText("A string · open");
  await page.keyboard.press("Shift+Space");
  await expect(page.locator("#readout-label")).toHaveText("Last strum");
  await expect(page.locator("#last-note")).toHaveText("Frets 1–0–0–0 · A♭4 · C4 · E4 · A4");
  await page.keyboard.press("Escape");
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="1"]')).not.toHaveClass(/is-latched/);
});

test("updates volume and toggles mute from the utility controls", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await openToolsIfCompact(page);
  await page.getByRole("slider", { name: "Volume" }).fill("35");
  await expect(page.getByRole("slider", { name: "Volume" })).toHaveValue("35");

  await page.getByRole("button", { name: "Mute sound" }).click();
  await expect(page.getByRole("button", { name: "Unmute sound" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#audio-status")).toContainText("Muted");
  await page.getByRole("button", { name: "Unmute sound" }).click();
  await expect(page.getByRole("button", { name: "Mute sound" })).toHaveAttribute("aria-pressed", "false");
});

test("taps the body to play the selected four-string shape together", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.locator('.fret-cell[data-string="0"][data-fret="2"]').click();
  await page.locator('.fret-cell[data-string="2"][data-fret="1"]').click();

  await page.locator("#strum-surface").click();

  await expect(page.locator("#readout-label")).toHaveText("Last chord");
  await expect(page.locator("#note-orb")).toHaveText("4");
  await expect(page.locator("#last-note")).toHaveText("Frets 2–0–1–0 · A4 · C4 · F4 · A4");
});

test("labels all four strings on the neck and body", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".string-identity strong")).toHaveText(["G", "C", "E", "A"]);
  await expect(page.locator(".body-string-name strong")).toHaveText(["G", "C", "E", "A"]);
  await expect(page.locator(".string-identity small")).toHaveText(["4", "3", "2", "1"]);
});

test("groups Play, Learn, and Tools with drills under Practice", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("#nav-play")).toBeVisible();
  await expect(page.locator("#nav-practice")).toBeVisible();
  await expect(page.locator("#nav-songs")).toBeVisible();
  await expect(page.locator("#mode-ai-coach")).toBeVisible();
  if (isMobile) await page.locator("#nav-tools").click();
  await expect(page.locator("#mode-tuner")).toBeVisible();
  await expect(page.locator("#mode-tempo")).toBeVisible();
  await expect(page.locator("#mode-chord-check")).toBeVisible();
  await expect(page.locator("#play-subnav")).toBeVisible();
  await expect(page.locator("#practice-subnav")).toBeHidden();

  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator("#practice-subnav")).toBeVisible();
  await expect(page.getByRole("button", { name: "10-minute session", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await expect(page.locator("#coach-workbench")).toBeVisible();
  await expect(page.locator("#play-subnav")).toBeHidden();
});

test("supports one-hand latching and two-hand touch holds", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  const fret = page.locator('.fret-cell[data-string="3"][data-fret="3"]');

  await page.getByRole("button", { name: "One hand", exact: true }).click();
  await fret.dispatchEvent("pointerdown", { pointerId: 31, pointerType: "touch", pressure: 0.5 });
  await expect(fret).toHaveClass(/is-latched/);

  await page.getByRole("button", { name: "Two hands", exact: true }).click();
  await openToolsIfCompact(page);
  await page.getByRole("button", { name: "Clear frets", exact: true }).click();
  await fret.dispatchEvent("pointerdown", { pointerId: 32, pointerType: "touch", pressure: 0.5 });
  await expect(fret).toHaveClass(/is-held/);
  await fret.dispatchEvent("pointerup", { pointerId: 32, pointerType: "touch", pressure: 0 });
  await expect(fret).not.toHaveClass(/is-held/);
});

test("routes real-ukulele learners directly to tuning", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I have my ukulele", exact: true }).click();
  await expect(page.locator("#tuner-workbench")).toBeVisible();
  await expect(page.locator("#mode-tuner")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByRole("button", { name: "My ukulele", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("starts practice in one click without redirecting to the tuner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "I have my ukulele", exact: true }).click();
  await expect(page.locator("#tuner-workbench")).toBeVisible();

  await page.reload();
  await expect(page.locator("#instrument-title")).toHaveText("Good to see you.");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "On-screen ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start session", exact: true }).click();

  await expect(page.locator("body")).toHaveAttribute("data-app-view", "practice");
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "active");
  await expect(page.locator("#practice-status")).toContainText("Session started");
});

test("counts lesson-one notes through realistic microphone detection gaps", async ({ page }) => {
  await page.route("**/audio/**", (route) => route.abort());
  await page.addInitScript(() => {
    const sampleRate = 48_000;
    class FakeAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      frame = 0;
      getFloatTimeDomainData(buffer: Float32Array) {
        this.frame += 1;
        if (this.frame % 2 === 0) {
          buffer.fill(0);
          return;
        }
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = Math.sin((2 * Math.PI * 391.995 * index) / sampleRate) * 0.4;
        }
      }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = sampleRate;
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      createAnalyser() {
        return new FakeAnalyser();
      }
      async resume() {}
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "My ukulele", exact: true }).click();
  await expect(page.getByRole("button", { name: "My ukulele", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Start session", exact: true }).click();

  await expect(page.locator("body")).toHaveAttribute("data-app-view", "practice");
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-input", "real");
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "active");
  await expect(page.locator("#instrument-frame")).toBeHidden();
  await expect(page.locator("#instrument-frame")).toHaveAttribute("data-audio-ready", "false");
  await expect(page.locator("#practice-insight-kicker")).toHaveText("Live microphone");
  await expect(page.locator("#practice-stage-copy")).toContainText("microphone listens");
  await expect(page.locator("#practice-clean-label")).toHaveText("Heard moves");
  await expect(page.locator("#practice-target")).toContainText("3 · C");
  await expect(page.locator("#practice-progress-detail")).toHaveText("1 of 8 strings complete");
  await expect(page.locator("#practice-mic-feedback")).toHaveAttribute("data-state", "confirmed");
  await expect(page.locator("#practice-mic-note")).toHaveText("G4");
  await expect(page.locator("#practice-mic-detail")).toContainText("next C4");
});

test("keeps real-ukulele practice idle when microphone access is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    });
  });
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "My ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start session", exact: true }).click();

  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "idle");
  await expect(page.locator("#practice-status")).toContainText("Microphone access was denied");
  await expect(page.getByRole("button", { name: "Start session", exact: true })).toBeEnabled();
});

test("offers a distraction-free instrument view that Escape closes", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Enter focus view", exact: true }).click();
  await expect(page.locator("body")).toHaveClass(/is-focus-mode/);
  await page.getByRole("button", { name: "Exit focus view", exact: true }).press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/is-focus-mode/);
});

test("builds, repeats, plays, and stops a fingerpicking pattern", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Fingerpick", exact: true }).click();
  await page.getByRole("button", { name: "Add notes" }).click();

  const cStringD = page.locator('.fret-cell[data-string="1"][data-fret="2"]');
  const aStringC = page.locator('.fret-cell[data-string="3"][data-fret="3"]');
  await cStringD.click();
  await cStringD.click();
  await aStringC.click();

  await expect(page.locator("#pattern-count")).toHaveText("3 / 30");
  await expect(page.locator(".pattern-step")).toHaveCount(3);
  await expect(cStringD.locator(".sequence-badge")).toHaveText("×2");
  await expect(page.locator(".pattern-step").nth(0)).toContainText("3·C");
  await expect(page.locator(".pattern-step").nth(2)).toContainText("1·A");

  await page.getByRole("button", { name: "Play fingerpicking pattern" }).click();
  await expect(page.getByRole("button", { name: "Stop fingerpicking pattern" })).toBeEnabled();
  await expect(page.locator(".pattern-step.is-current")).toHaveCount(1);
  await page.getByRole("button", { name: "Stop fingerpicking pattern" }).click();
  await expect(page.locator(".pattern-step.is-current")).toHaveCount(0);
});

test("undoes and clears fingerpicking steps", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Fingerpick", exact: true }).click();
  await page.getByRole("button", { name: "Add notes" }).click();
  await page.locator('.fret-cell[data-string="0"][data-fret="2"]').click();
  await page.locator('.fret-cell[data-string="1"][data-fret="2"]').click();
  await expect(page.locator(".pattern-step")).toHaveCount(2);

  await page.getByRole("button", { name: "Undo last note" }).click();
  await expect(page.locator(".pattern-step")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear fingerpicking pattern" }).click();
  await expect(page.locator(".pattern-step")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear fingerpicking pattern" })).toBeDisabled();
});

test("limits a fingerpicking pattern to thirty repeated notes", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Fingerpick", exact: true }).click();
  await page.getByRole("button", { name: "Add notes" }).click();

  const repeated = page.locator('.fret-cell[data-string="0"][data-fret="2"]');
  for (let index = 0; index < 31; index += 1) await repeated.click();

  await expect(page.locator("#pattern-count")).toHaveText("30 / 30");
  await expect(page.locator(".pattern-step")).toHaveCount(30);
  await expect(repeated.locator(".sequence-badge")).toHaveText("×30");
});

test("changes the fingerpicking playback tempo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fingerpick", exact: true }).click();
  await page.locator("#pattern-tempo").fill("140");
  await expect(page.locator("#pattern-tempo-value")).toHaveText("140 BPM");
});

test("switches between the searchable lesson library and each course's chapter set", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await expect(page.locator("#lesson-song-title")).toHaveText("Lathe Di Chadar");
  await expect(page.locator(".song-result")).toHaveCount(7);
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Folk pulse", "Folk picking", "Wedding strum"]);
  await expect(page.locator(".lesson-line")).toHaveCount(4);
  await expect(page.locator(".lesson-native").first()).toContainText("ਲੱਠੇ");

  await page.locator('.song-result[data-song-id="khaab"]').click();
  await expect(page.locator("#lesson-song-title")).toHaveText("Khaab");
  await expect(page.locator("#lesson-rights")).toContainText("lyrics and melody not included");
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Dreamy pulse", "Dreamy picking", "Pop flow"]);

  await page.getByRole("button", { name: /Dreamy picking/ }).click();
  await expect(page.getByRole("button", { name: /Dreamy picking/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#lesson-technique-title")).toContainText("Let the minor loop shimmer");
  await page.getByRole("button", { name: /Pop flow/ }).click();
  await expect(page.getByRole("button", { name: /Pop flow/ })).toHaveAttribute("aria-pressed", "true");

  await page.locator("#song-search").fill("sargam");
  await expect(page.locator(".song-result")).toHaveCount(1);
  await expect(page.locator(".song-result")).toContainText("Sa Re Ga Ma");
});

test("teaches the exact Sa Re Ga Ma fingerpicking ascent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="sargam"]').click();

  await expect(page.locator("#lesson-song-title")).toHaveText("Sa Re Ga Ma");
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Find the notes", "Join the pairs", "Smooth ascent"]);
  await expect(page.locator(".lesson-line").first().locator(".lesson-note strong")).toHaveText(["3,0", "3,2"]);
  await expect(page.locator("#lesson-cue-target-label")).toHaveText("Note now");
  await expect(page.locator("#lesson-cue-frets")).toContainText("3,0 · C4");
  await expect(page.locator('.fret-cell[data-string="1"][data-fret="0"]')).toHaveClass(/is-learning-target/);

  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator("#lesson-cue")).toHaveAttribute("data-state", "practice");
  await page.keyboard.press("Digit3");
  await expect(page.locator("#lesson-cue-frets")).toContainText("3,2 · D4");
  await page.locator('.fret-cell[data-string="1"][data-fret="2"]').click();
  await page.keyboard.press("Digit3");
  await expect(page.locator("#lesson-cue-line")).toContainText("Part 2 · Ga · Ma");
});

test("adds Twinkle melody, quick transition, beginner strum, and backing chapter", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="twinkle-twinkle"]').click();

  await expect(page.locator("#lesson-song-title")).toHaveText("Twinkle Twinkle");
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Pick melody", "Easy strum", "Melody + pulse"]);
  await expect(page.locator(".lesson-line").first().locator(".lesson-note strong")).toHaveText(["3,0", "3,0", "2,3", "2,3", "1,0", "1,0", "2,3"]);

  await page.getByRole("button", { name: "Hear 4-line demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop demo", exact: true })).toBeEnabled();
  await expect(page.locator("#lesson-cue")).toHaveAttribute("data-state", "demo");
  await page.getByRole("button", { name: "Stop demo", exact: true }).click();

  await page.getByRole("button", { name: /Easy strum/ }).click();
  await expect(page.locator("#lesson-pattern")).toHaveText("D · D · D · D");
  await expect(page.locator("#lesson-layer-target")).toContainText("C chord");

  await page.getByRole("button", { name: /Melody \+ pulse/ }).click();
  await expect(page.locator("#lesson-technique-title")).toContainText("gentle chord bed");
  await expect(page.locator("#lesson-hear-bar")).toContainText("Hear this phrase");
  await page.locator("#lesson-hear-bar").click();
  await expect(page.locator("#lesson-hear-bar")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#lesson-hear-bar").click();
});

test("plays the short Hedwig fingerpicking study and advances its note cue", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator("#song-search").fill("harry potter");
  await expect(page.locator(".song-result")).toHaveCount(1);
  await page.locator('.song-result[data-song-id="hedwigs-theme"]').click();

  await expect(page.locator("#lesson-song-title")).toHaveText("Hedwig’s Theme");
  await expect(page.locator("#lesson-tempo")).toContainText("3/4");
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Find the motif", "Connect phrases", "Full opening"]);
  await expect(page.locator(".lesson-line").first().locator(".lesson-note strong")).toHaveText(["3,2", "2,3", "1,1", "1,0"]);
  await expect(page.locator("#lesson-cue-frets")).toContainText("3,2 · D4");

  await page.getByRole("button", { name: "Hear 4-note demo", exact: true }).click();
  await expect(page.locator("#lesson-cue")).toHaveAttribute("data-state", "demo");
  await page.getByRole("button", { name: "Stop demo", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.locator('.fret-cell[data-string="1"][data-fret="2"]').click();
  await page.keyboard.press("Digit3");
  await expect(page.locator("#lesson-cue-frets")).toContainText("2,3 · G4");
});

test("adds playable Yellow and I’m Yours three-chapter studies", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();

  await page.locator('.song-result[data-song-id="yellow"]').click();
  await expect(page.locator("#lesson-song-title")).toHaveText("Yellow");
  await expect(page.locator("#lesson-rights")).toContainText("Lyric-free accompaniment study in C");
  await expect(page.locator("#lesson-rights")).toContainText("not the original recording or melody");
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Verse pulse", "Starry picking", "Island glow"]);
  await expect(page.locator(".lesson-chord strong")).toHaveText(["C", "G", "F", "F", "Am", "G"]);
  await page.locator('.chapter-tab[data-chapter="3"]').click();
  await expect(page.locator("#lesson-pattern")).toHaveText("D · D-U · U");
  await expect(page.locator("#lesson-tempo")).toContainText("87 BPM");

  await page.locator('.song-result[data-song-id="im-yours"]').click();
  await expect(page.locator("#lesson-song-title")).toHaveText("I’m Yours");
  await expect(page.locator(".chapter-tab strong")).toHaveText(["Four-chord loop", "Sunny picking", "Island strum"]);
  await expect(page.locator(".lesson-chord strong")).toHaveText(["C", "G", "Am", "F"]);
  await page.locator('.chapter-tab[data-chapter="3"]').click();
  await expect(page.locator("#lesson-pattern")).toHaveText("D · D-U · U");

  await page.getByRole("button", { name: "Hear 4-line demo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop demo", exact: true })).toBeEnabled();
  await expect(page.locator("#lesson-cue")).toHaveAttribute("data-state", "demo");
  await page.getByRole("button", { name: "Stop demo", exact: true }).click();
});

test("records, saves, replays, and clears an on-screen lesson take", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="sargam"]').click();

  await page.getByRole("button", { name: "Record take", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop & save", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Digit3");
  await expect(page.locator("#lesson-take-status")).toContainText("1 note captured");
  await page.getByRole("button", { name: "Stop & save", exact: true }).click();
  await expect(page.locator("#lesson-take-status")).toContainText("saved on this device");

  await page.getByRole("button", { name: "Play saved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop playback", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Stop playback", exact: true }).click();
  await page.locator("#lesson-take-clear").click();
  await expect(page.locator("#lesson-take-status")).toHaveText("No take saved for this chapter");
});

test("loads sound automatically when a song demo or lesson starts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="yellow"]').click();

  await page.getByRole("button", { name: "Hear 4-line demo", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-app-view", "chapters");
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Stop demo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Stop demo", exact: true }).click();

  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator("#lesson-workbench")).toHaveAttribute("data-phase", "lines");
  await expect(page.locator("#lesson-status")).toContainText("Part 1 begins");
});

test("advances a guided song only after the full rhythm gesture", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="yellow"]').click();
  await page.getByRole("button", { name: "Start practice" }).click();
  await page.locator('.fret-cell[data-string="3"][data-fret="3"]').click();
  for (let beat = 0; beat < 4; beat += 1) await page.locator("#strum-surface").click();
  await expect(page.locator(".lesson-line.is-current")).toContainText("Verse B");
  await expect(page.locator("#lesson-status")).toContainText("Part 2 starts on G");
});

test("keeps a visible now-and-next cue through song demo and guided practice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="yellow"]').click();

  await expect(page.locator("#lesson-cue")).toBeInViewport();
  await expect(page.locator("#lesson-cue-chord")).toHaveText("C");
  await expect(page.locator("#lesson-cue-frets")).toHaveText("G 0 · C 0 · E 0 · A 3");
  await expect(page.locator("#lesson-cue-shape .lesson-mini-string")).toHaveCount(4);

  await page.getByRole("button", { name: "Hear 4-line demo" }).click();
  await expect(page.locator("#lesson-cue")).toHaveAttribute("data-state", "demo");
  await expect(page.locator(".lesson-line.is-current")).toHaveCount(0);
  await expect(page.locator(".lesson-line.is-demo")).toHaveCount(1);
  await expect(page.locator("#lesson-cue-mode")).toContainText("follow along");
  await expect(page.locator(".lesson-gesture-step.is-current")).toHaveCount(1);
  await expect(page.locator("#lesson-cue")).toBeInViewport();
  await page.getByRole("button", { name: "Stop demo" }).click();
  await expect(page.locator(".lesson-line.is-current")).toHaveCount(1);

  await page.getByRole("button", { name: "Start practice" }).click();
  await expect(page.locator("#lesson-cue")).toHaveAttribute("data-state", "practice");
  await expect(page.locator("#lesson-cue-mode")).toContainText("Your turn");
  await page.locator('.fret-cell[data-string="3"][data-fret="3"]').click();
  await page.locator("#strum-surface").click();
  await expect(page.locator(".lesson-gesture-step.is-complete")).toHaveCount(1);
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 2 of 4");
  await page.locator("#fretboard").scrollIntoViewIfNeeded();
  await expect(page.locator("#lesson-cue")).toBeInViewport();
});

test("layers practice into a target, reference audio, and a contextual hint", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();

  await expect(page.locator("#practice-layer-target")).toHaveText("4 · G4");
  await expect(page.locator("#practice-layer-notes")).toContainText("392.0 Hz");
  await expect(page.locator("#practice-layer-hint")).toContainText("string 4 · G");
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="0"]')).toHaveClass(/is-learning-target/);
  await expect(page.locator('.body-string-name[data-string="0"]')).toHaveClass(/is-learning-target/);

  await page.locator("#practice-hear-target").click();
  await expect(page.locator("#practice-hear-target")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#practice-reference-status")).toContainText("Playing G4");
  await expect(page.locator("#practice-target")).toContainText("4 · G");
  await page.locator("#practice-hear-target").click();
  await expect(page.locator("#practice-hear-target")).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "50%", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "50%", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
});

test("previews song chord and bar without advancing the learner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="yellow"]').click();

  await expect(page.locator("#lesson-layer-target")).toHaveText("C chord · ↓");
  await expect(page.locator("#lesson-layer-notes")).toContainText("G4 · C4 · E4 · C5");
  await expect(page.locator(".fret-cell.is-learning-target")).toHaveCount(4);
  await page.locator("#lesson-hear-chord").click();
  await expect(page.locator("#lesson-reference-status")).toContainText("Playing C");
  await page.locator("#lesson-hear-chord").click();

  await page.locator("#lesson-hear-bar").click();
  await expect(page.locator("#lesson-hear-bar")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".lesson-gesture-step.is-reference-current")).toHaveCount(1);
  await expect(page.locator("#lesson-cue-beat")).toHaveText("Move 1 of 4");
  await page.locator("#lesson-hear-bar").click();
});

test("labels unverified songs and offers both verified-song input modes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await expect(page.locator("#lesson-rights")).toContainText("Unverified arrangement");
  await expect(page.locator('.song-result[data-song-id="lathe-di-chadar"] .song-result-rights')).toHaveText("Unverified");
  await expect(page.locator("#lesson-demo")).toBeDisabled();
  await expect(page.locator("#lesson-practice")).toBeDisabled();

  await page.locator('.song-result[data-song-id="twinkle-twinkle"]').click();
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await expect(page.locator("#lesson-workbench")).toHaveAttribute("data-input", "real");
  await expect(page.locator("#lesson-input-note")).toContainText("cannot identify the exact ukulele string");
  await expect(page.getByRole("button", { name: "Record take", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "On-screen ukulele", exact: true }).click();
  await expect(page.locator("#lesson-workbench")).toHaveAttribute("data-input", "screen");
  await expect(page.getByRole("button", { name: "Start practice", exact: true })).toBeEnabled();
});

test("ignores hidden on-screen keyboard gestures in real song mode", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => new Promise(() => {}) },
    });
  });
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.locator('.song-result[data-song-id="twinkle-twinkle"]').click();
  await page.getByRole("button", { name: "Real ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await expect(page.locator("#lesson-cue-frets")).toContainText("3,0 · C4");
  const readoutBefore = await page.locator("#last-note").textContent();
  await page.keyboard.press("Digit3");
  await page.keyboard.press("Digit3");
  await expect(page.locator("#lesson-cue-frets")).toContainText("3,0 · C4");
  await expect(page.locator("#last-note")).toHaveText(readoutBefore ?? "");
});

test("plays an unscored coach reference before the learner responds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await expect(page.locator("#coach-layer-target")).toHaveText("Open G4");

  await page.locator("#coach-hear-target").click();
  await expect(page.locator("#coach-reference-status")).toContainText("Playing G4");
  await expect(page.locator("#coach-progress")).toHaveText("String 1 of 4");
  await page.locator("#coach-hear-target").click();

  await page.locator("#coach-toggle").click();
  await page.keyboard.press("Digit4");
  await expect(page.locator("#coach-progress")).toHaveText("String 2 of 4");
});

test("offers a target reference inside the tuner and keeps it out of analysis", async ({ page }) => {
  await page.goto("/");
  await openTuner(page);
  await page.getByRole("button", { name: "3 C", exact: true }).click();
  await expect(page.locator("#tuner-hear-target")).toContainText("Hear C4 reference");
  await page.locator("#tuner-hear-target").click();
  await expect(page.locator("#tuner-reference-note")).toContainText("Playing C4");
  await expect(page.locator("#tuner-hear-target")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#tuner-hear-target").click();
  await expect(page.locator("#tuner-hear-target")).toHaveAttribute("aria-pressed", "false");
});

test("shows a retryable tuner error when microphone permission is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    });
  });
  await page.goto("/");
  await openTuner(page);
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.locator("#tuner-status")).toContainText("Microphone access was denied");
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
});

test("selects every tuner target without leaving the tuner", async ({ page }) => {
  await page.goto("/");
  await openTuner(page);
  for (const target of ["4 G", "3 C", "2 E", "1 A", "Auto"]) {
    const button = page.getByRole("button", { name: target, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("body")).toHaveAttribute("data-app-view", "tuner");
  }
});

test("holds the last tuner reading when a ringing note fades", async ({ page }) => {
  await page.addInitScript(() => {
    const sampleRate = 48_000;
    class FadingAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      frames = 0;
      getFloatTimeDomainData(buffer: Float32Array) {
        this.frames += 1;
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = this.frames <= 10
            ? Math.sin((2 * Math.PI * 391.995 * index) / sampleRate) * 0.4
            : 0;
        }
      }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = sampleRate;
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      createAnalyser() {
        return new FadingAnalyser();
      }
      async resume() {}
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });

  await page.goto("/");
  await openTuner(page);
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.locator("#tuner-note")).toHaveText("G");
  await expect(page.locator("#tuner-meter")).toHaveAttribute("data-signal", "held");
  await expect(page.locator("#tuner-frequency")).toContainText("last reading");
  await expect(page.locator("#tuner-status")).toContainText("Last reading held");
  await expect(page.locator("#tuner-note")).toHaveText("G");
});

test("shows the correct tuning direction and locked-string target", async ({ page }) => {
  await page.addInitScript(() => {
    const sampleRate = 48_000;
    const testWindow = window as typeof window & { __tunerFrequency: number };
    testWindow.__tunerFrequency = 391.995;
    class AdjustableAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      getFloatTimeDomainData(buffer: Float32Array) {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = Math.sin((2 * Math.PI * testWindow.__tunerFrequency * index) / sampleRate) * 0.4;
        }
      }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = sampleRate;
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      createAnalyser() {
        return new AdjustableAnalyser();
      }
      async resume() {}
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });

  await page.goto("/");
  await openTuner(page);
  await page.getByRole("button", { name: "4 G" }).click();
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.locator("#tuner-note")).toHaveText("G");
  await expect(page.locator("#tuner-cents")).toHaveText("In tune");

  await page.evaluate(() => {
    (window as typeof window & { __tunerFrequency: number }).__tunerFrequency = 391.995 * 2 ** (-20 / 1200);
  });
  await expect(page.locator("#tuner-status")).toContainText("G is flat");
  await expect(page.locator("#tuner-cents")).toContainText("-20 cents");

  await page.evaluate(() => {
    (window as typeof window & { __tunerFrequency: number }).__tunerFrequency = 391.995 * 2 ** (20 / 1200);
  });
  await expect(page.locator("#tuner-status")).toContainText("G is sharp");
  await expect(page.locator("#tuner-cents")).toContainText("+20 cents");

  await page.getByRole("button", { name: "3 C" }).click();
  await page.evaluate(() => {
    (window as typeof window & { __tunerFrequency: number }).__tunerFrequency = 261.626;
  });
  await expect(page.locator("#tuner-note")).toHaveText("C");
  await expect(page.locator("#tuner-status")).toContainText("C is in tune");
});

test("offers real-time string and pulse coaching with retryable microphone access", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await page.getByRole("button", { name: "My ukulele", exact: true }).click();
  await expect(page.locator("#coach-goal")).toHaveText("Play G4");
  await page.getByRole("button", { name: "Steady pulse" }).click();
  await expect(page.locator("#coach-goal")).toHaveText("Hold 72 BPM");
  await expect(page.locator("#coach-next")).toHaveText("Next · beat 1");
  await expect(page.locator("#coach-hold")).toBeHidden();
  await page.getByRole("button", { name: "Start coaching" }).click();
  await expect(page.locator("#coach-status")).toContainText("Microphone access was denied");
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
});

test("advances the coach after a stable open-string note", async ({ page }) => {
  await page.addInitScript(() => {
    const sampleRate = 48_000;
    class FakeAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      getFloatTimeDomainData(buffer: Float32Array) {
        for (let index = 0; index < buffer.length; index += 1) {
          buffer[index] = Math.sin((2 * Math.PI * 391.995 * index) / sampleRate) * 0.4;
        }
      }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = sampleRate;
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      createAnalyser() {
        return new FakeAnalyser();
      }
      async resume() {}
      async close() {}
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await page.getByRole("button", { name: "My ukulele", exact: true }).click();
  await page.getByRole("button", { name: "Start coaching" }).click();
  await expect(page.locator("#coach-goal")).toHaveText("Play C4");
  await expect(page.locator("#coach-next")).toHaveText("Next · E4");
  await expect(page.locator('.echo-string[data-coach-string="0"]')).toHaveClass(/is-complete/);
});

test("uses one top instrument switch across Practice and Coach", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.locator("#instrument-source-choice")).toBeVisible();
  await expect(page.locator("#instrument-source-title")).toHaveText("Practice with");
  await page.getByRole("button", { name: "My ukulele", exact: true }).click();

  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await expect(page.locator("#instrument-source-title")).toHaveText("Coach with");
  await expect(page.getByRole("button", { name: "My ukulele", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#instrument-frame")).toBeHidden();

  await page.getByRole("button", { name: "On-screen ukulele", exact: true }).click();
  await expect(page.locator("#coach-workbench")).toHaveAttribute("data-source", "screen");
  await expect(page.locator("#instrument-frame")).toBeVisible();
  await expect(page.locator("#coach-copy")).toContainText("playable strings");
});

test("coaches on-screen strings and pulse without microphone access", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Quick drills", exact: true }).click();
  await page.getByRole("button", { name: "Start coaching", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true", { timeout: 15_000 });
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="0"]')).toHaveClass(/is-coach-target/);
  await page.keyboard.press("Digit4");
  await expect(page.locator("#coach-goal")).toHaveText("Play C4");
  await expect(page.locator('.fret-cell[data-string="1"][data-fret="0"]')).toHaveClass(/is-coach-target/);
  await expect(page.locator("#coach-acceptance")).toContainText("G accepted ✓ — play C next");

  await page.getByRole("button", { name: "Stop coaching", exact: true }).click();
  await page.getByRole("button", { name: "Steady pulse" }).click();
  await page.getByRole("button", { name: "Start coaching", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("#coach-progress")).toHaveText("1 of 8 strums");
  await expect(page.locator("#coach-next")).toHaveText("Next · beat 2");
});

test("runs an adaptive ten-minute session and responds to clean and missed inputs", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Khaab" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "active");

  await page.keyboard.press("Digit4");
  await expect(page.locator("#practice-target")).toContainText("3 · C");
  await page.keyboard.press("Digit3");
  await page.keyboard.press("Digit2");
  await expect(page.locator("#practice-tempo")).toHaveText("76 BPM");

  await page.keyboard.press("Digit4");
  await page.keyboard.press("Digit4");
  await expect(page.locator("#practice-misses")).toHaveText("2");
  await expect(page.locator("#practice-tempo")).toHaveText("68 BPM");

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "paused");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "active");
});

test("completes the opening practice stage, advances, and resets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Start session", exact: true }).click();
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "active", { timeout: 15_000 });

  for (const key of ["Digit4", "Digit3", "Digit2", "Digit1", "Digit4", "Digit3", "Digit2", "Digit1"]) {
    await page.keyboard.press(key);
  }
  await expect(page.getByRole("button", { name: "Next exercise" })).toBeEnabled();
  await page.getByRole("button", { name: "Next exercise" }).click();
  await expect(page.locator("#practice-stage-title")).toContainText("Place, release, rebuild");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator("#practice-workbench")).toHaveAttribute("data-session", "idle");
  await expect(page.getByRole("button", { name: "Start session" })).toBeEnabled();
});

test("tracks multiple touch frets while a separate pointer strums", async ({ page }) => {
  await page.goto("/");
  await enableAudio(page);
  await page.getByRole("button", { name: "Two hands", exact: true }).click();

  await page.locator('.fret-cell[data-string="0"][data-fret="2"]').dispatchEvent("pointerdown", {
    pointerId: 41,
    pointerType: "touch",
    pressure: 0.5,
  });
  await page.locator('.fret-cell[data-string="2"][data-fret="1"]').dispatchEvent("pointerdown", {
    pointerId: 42,
    pointerType: "touch",
    pressure: 0.5,
  });
  await expect(page.locator('.fret-cell[data-string="0"][data-fret="2"]')).toHaveClass(/is-held/);
  await expect(page.locator('.fret-cell[data-string="2"][data-fret="1"]')).toHaveClass(/is-held/);

  const box = await page.locator("#strum-surface").boundingBox();
  if (!box) throw new Error("Strum surface is not visible");
  await page.locator("#strum-surface").dispatchEvent("pointerdown", {
    pointerId: 50,
    pointerType: "touch",
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 0.12,
    pressure: 0.5,
  });
  await page.locator("#strum-surface").dispatchEvent("pointermove", {
    pointerId: 50,
    pointerType: "touch",
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 0.88,
    pressure: 0.5,
  });
  await expect(page.locator("#readout-label")).toHaveText("Last strum");
  await expect(page.locator("#last-note")).toHaveText("Frets 2–0–1–0 · A4 · C4 · F4 · A4");
});

test("shows a retry state when a required audio asset fails", async ({ page }) => {
  await page.route("**/audio/C4.flac", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Play on screen", exact: true }).click();
  await expect(page.locator("#gate-title")).toHaveText("The strings did not load.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  await expect(page.locator("#audio-status")).toHaveAttribute("data-status", "error");
});

test("keeps the instrument usable in portrait", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only responsive assertion");
  await page.goto("/");
  await expect(page.locator("#neck-scroll")).toBeVisible();
  await expect(page.locator("#strum-surface")).toBeVisible();
  const bodyBox = await page.locator("#strum-surface").boundingBox();
  expect(bodyBox?.width).toBeGreaterThan(300);
  const scrollMetrics = await page.locator("#neck-scroll").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
  const layoutMetrics = await page.evaluate(() => {
    const lastFret = document.querySelector<HTMLElement>('.fret-cell[data-string="3"][data-fret="12"]');
    const play = document.querySelector<HTMLElement>("#pattern-play");
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      lastFretWidth: lastFret?.getBoundingClientRect().width ?? 0,
      playHeight: play?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(layoutMetrics.pageWidth).toBeLessThanOrEqual(layoutMetrics.viewportWidth);
  expect(layoutMetrics.lastFretWidth).toBeGreaterThanOrEqual(44);

  await enableAudio(page);
  await page.getByRole("button", { name: "Fingerpick", exact: true }).click();
  expect((await page.locator("#pattern-arm").boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.locator("#pattern-play").boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("renders a decoded sample through an OfflineAudioContext", async ({ page }) => {
  await page.goto("/");
  const peak = await page.evaluate(async () => {
    const decodeContext = new AudioContext();
    const response = await fetch("/audio/C4.flac");
    const decoded = await decodeContext.decodeAudioData(await response.arrayBuffer());
    const frameCount = Math.min(decoded.length, Math.floor(decoded.sampleRate * 0.5));
    const offline = new OfflineAudioContext(1, frameCount, decoded.sampleRate);
    const source = offline.createBufferSource();
    const gain = offline.createGain();
    source.buffer = decoded;
    gain.gain.value = 0.8;
    source.connect(gain).connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    await decodeContext.close();
    let maximum = 0;
    for (const sample of rendered.getChannelData(0)) maximum = Math.max(maximum, Math.abs(sample));
    return maximum;
  });
  expect(peak).toBeGreaterThan(0.01);
  expect(peak).toBeLessThanOrEqual(1);
});

test("shows all AI Coach patterns and a clear API setup state", async ({ page }) => {
  await page.route("**/api/adaptive-coach/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: false }),
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "AI Coach", exact: true }).click();

  await expect(page.locator("#ai-coach-workbench")).toBeVisible();
  await expect(page.locator(".ai-pattern strong")).toHaveText(["Steady downs", "Alternating pulse", "Island rhythm"]);
  await expect(page.locator("#ai-connection")).toContainText("API key needed");
  await expect(page.getByRole("button", { name: "Start first take", exact: true })).toBeDisabled();
  await expect(page.locator("#ai-stage-copy")).toContainText("OPENAI_API_KEY");

  await page.locator('[data-ai-pattern="alternating-pulse"]').click();
  await expect(page.locator('[data-ai-pattern="alternating-pulse"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ai-stage-title")).toHaveText("Alternating pulse");
  await expect(page.locator("#ai-slots .ai-slot")).toHaveCount(8);
});

test("runs the Astra correction, cancelable retry, and before-after loop", async ({ page }) => {
  let sentSummary = "";
  await page.route("**/api/adaptive-coach/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true }),
  }));
  await page.route("**/api/adaptive-coach", async (route) => {
    sentSummary = route.request().postData() ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        decision: {
          issue: "missed_hits",
          correction: "Keep your hand moving and place the second stroke on beat two.",
          evidence: "The middle pair had the largest timing gap.",
          focusStartSlot: 0,
          focusEndSlot: 2,
          retryBpm: 60,
          repetitions: 3,
          visualCue: "follow-pulse",
        },
      }),
    });
  });
  await page.addInitScript(() => {
    class FakeParam {
      value = 1;
      cancelScheduledValues() {}
      setTargetAtTime(value: number) { this.value = value; }
      setValueAtTime(value: number) { this.value = value; }
      exponentialRampToValueAtTime(value: number) { this.value = value; }
    }
    class FakeNode extends EventTarget {
      gain = new FakeParam();
      threshold = new FakeParam();
      knee = new FakeParam();
      ratio = new FakeParam();
      attack = new FakeParam();
      release = new FakeParam();
      frequency = new FakeParam();
      type = "sine";
      buffer: AudioBuffer | null = null;
      playbackRate = new FakeParam();
      connect<T>(destination: T): T { return destination; }
      disconnect() {}
      start() {}
      stop() { this.dispatchEvent(new Event("ended")); }
    }
    class FakeAnalyser {
      fftSize = 4096;
      smoothingTimeConstant = 0;
      getFloatTimeDomainData(buffer: Float32Array) { buffer.fill((window as any).teachingFixture.rms); }
    }
    class FakeAudioContext {
      state = "running";
      sampleRate = 48_000;
      get currentTime() { return performance.now() / 1000; }
      destination = new FakeNode();
      createGain() { return new FakeNode(); }
      createDynamicsCompressor() { return new FakeNode(); }
      createBufferSource() { return new FakeNode(); }
      createOscillator() { return new FakeNode(); }
      createMediaStreamSource() { return new FakeNode(); }
      createAnalyser() { return new FakeAnalyser(); }
      async decodeAudioData() { return {} as AudioBuffer; }
      async resume() {}
      async close() {}
    }
    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported() { return true; }
      state: RecordingState = "inactive";
      mimeType: string;
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        this.mimeType = options?.mimeType ?? "audio/webm";
      }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.dispatchEvent(new BlobEvent("dataavailable", { data: new Blob(["take"], { type: this.mimeType }) }));
        this.dispatchEvent(new Event("stop"));
      }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
    (window as any).teachingFixture = { rms: .001 };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
  });
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "AI Coach", exact: true }).click();
  await expect(page.locator("#ai-connection")).toContainText("API key configured");
  await page.getByRole("button", { name: "Start first take", exact: true }).click();
  await completeCalibration(page);
  await expect(page.locator("body")).toHaveAttribute("data-audio-ready", "true");
  await page.clock.runFor(5000);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "count-in");
  await expect(page.locator("#ai-live-status")).toHaveText("Count-in · 4");

  await page.clock.runFor(3_600);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "recording");
  await captureStrums(page, 8, 800);
  await page.clock.runFor(1100);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "retry-count-in");
  expect(sentSummary).not.toContain("blob:");
  expect(sentSummary).not.toContain("take");
  await expect(page.locator("#ai-correction")).toContainText("Keep your hand moving");

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "correction");
  await page.getByRole("button", { name: "Start focused retry", exact: true }).click();
  await page.clock.runFor(5000);
  await page.clock.runFor(4_100);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "recording");
  await captureStrums(page, 6, 900);
  await page.clock.runFor(1100);
  await expect(page.locator("#ai-coach-workbench")).toHaveAttribute("data-phase", "comparison");
  await expect(page.locator("#ai-before-error")).toContainText("ms");
  await expect(page.locator("#ai-after-error")).toContainText("ms");
  await expect(page.getByRole("button", { name: "Hear first take", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Hear new take", exact: true })).toBeEnabled();
});
