import { expect, test } from '@playwright/test';

test('Tempo is a playable independent metronome with tap tempo and stops on navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tempo', exact: true }).click();
  await expect(page.locator('#tempo-workbench')).toBeVisible();
  await page.getByRole('slider', { name: 'Tempo speed' }).fill('100');
  await expect(page.locator('#tempo-bpm')).toHaveText('100');
  await page.getByRole('button', { name: 'Start beat' }).click();
  await expect(page.locator('#tempo-workbench')).toHaveAttribute('data-playing', 'true');
  await expect(page.locator('#tempo-beats .is-current')).toHaveCount(1);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Tempo', exact: true }).click();
  await expect(page.locator('#tempo-workbench')).toHaveAttribute('data-playing', 'false');
  await page.getByRole('button', { name: 'Tap tempo' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Tap tempo' }).click();
  await expect(page.locator('#tempo-bpm')).not.toHaveText('100');
});

test('practice shows a live beat lane and an optional audible cue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.locator('#practice-beat-lane')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hear current tempo' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Hear beat during practice' })).toBeVisible();
  await page.getByRole('button', { name: 'Play on screen' }).click();
  await page.getByRole('button', { name: 'Start session' }).click();
  await expect(page.locator('#practice-beat-lane')).toHaveAttribute('data-running', 'true');
  await expect(page.locator('#practice-beat-lane .is-current')).toHaveCount(1);
  await page.getByRole('button', { name: 'Hear current tempo' }).click();
  await expect(page.locator('#practice-status')).toContainText('Listen to four beats at 72 BPM');
  await expect(page.locator('#practice-status')).toContainText('Your turn.', { timeout: 5_000 });
  await page.getByRole('checkbox', { name: 'Hear beat during practice' }).check();
  await expect(page.getByRole('checkbox', { name: 'Hear beat during practice' })).toBeChecked();
});
