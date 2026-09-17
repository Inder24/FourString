import { expect, test } from '@playwright/test';

async function openHedwig(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Songs', exact: true }).click();
  await page.locator('#song-search').fill('harry potter');
  await page.locator('.song-result[data-song-id="hedwigs-theme"]').click();
}

async function playOpeningFour(page: import('@playwright/test').Page): Promise<void> {
  for (const [stringIndex, fret, key] of [
    [1, 2, 'Digit3'], [2, 3, 'Digit2'], [3, 1, 'Digit1'], [3, 1, 'Digit1'],
  ] as const) {
    await page.locator(`.fret-cell[data-string="${stringIndex}"][data-fret="${fret}"]`).click();
    await page.keyboard.press(key);
  }
}

test('Hedwig chapter 1 teaches only its four-note motif, then completes', async ({ page }) => {
  await openHedwig(page);
  await expect(page.locator('.lesson-line')).toHaveCount(4);
  await expect(page.locator('#lesson-arrangement-summary')).toContainText('14 notes');
  await expect(page.locator('.lesson-line').nth(1)).toBeVisible();
  await expect(page.locator('.lesson-note')).toHaveCount(14);
  await page.getByRole('link', { name: 'See full arrangement' }).click();
  await expect(page).toHaveURL(/#lesson-score$/);
  await expect(page.getByRole('button', { name: 'Hear 4-note demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Hear 4-note demo' }).click();
  await page.getByRole('button', { name: 'Stop demo' }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await playOpeningFour(page);
  await expect(page.locator('#lesson-progress')).toContainText('Chapter complete');
  await expect(page.locator('#lesson-cue')).toHaveAttribute('data-state', 'complete');
});

test('Hedwig chapter 3 keeps a single 14-note run across the former four-note boundary', async ({ page }) => {
  await openHedwig(page);
  await page.getByRole('button', { name: /Full opening/ }).click();
  await expect(page.locator('.lesson-line')).toHaveCount(4);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#lesson-progress')).toContainText('note 1 of 14');
  await playOpeningFour(page);
  await expect(page.locator('#lesson-progress')).toContainText('note 5 of 14');
  await expect(page.locator('#lesson-cue-frets')).toContainText('2,3 · G4');
  await expect(page.locator('#lesson-cue-beat')).toContainText('Note 5 of 14');
});

test('Hedwig chapter 3 demo continues into note five without restarting', async ({ page }) => {
  await openHedwig(page);
  await page.getByRole('button', { name: /Full opening/ }).click();
  await page.getByRole('button', { name: 'Hear 14-note demo' }).click();
  await expect(page.locator('#lesson-progress')).toContainText('Demo · note 5 of 14', { timeout: 5000 });
  await expect(page.locator('#lesson-cue-beat')).toContainText('Note 5 of 14');
  await page.getByRole('button', { name: 'Stop demo' }).click();
});

test('Hedwig chapter 2 labels its deliberate musical phrases, including the two-note ending', async ({ page }) => {
  await openHedwig(page);
  await page.getByRole('button', { name: /Connect phrases/ }).click();
  await expect(page.locator('.lesson-line')).toHaveCount(4);
  await expect(page.locator('.lesson-line').last().locator('.lesson-note')).toHaveCount(2);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('#lesson-progress')).toContainText('Guided phrase 1 of 4');
});
