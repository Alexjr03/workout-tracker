import { expect, test } from '@playwright/test';

// SPEC › workout-logging: everything needed for the next set fits on an iPhone SE screen.
test.use({ viewport: { width: 375, height: 667 } });

test('runner fits on a 375×667 screen with Complete set in the thumb zone', async ({ page }) => {
  await page.goto('/');
  // Upper A is either today's scheduled session or in the "different session" list.
  await page
    .getByRole('button', { name: /^(Start )?Upper A$/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Bench press' })).toBeVisible();

  const controls = [
    page.getByRole('heading', { name: 'Bench press' }),
    page.getByText(/^Set 1 of \d$/),
    page.getByText(/reps · leave/),
    page.getByRole('textbox', { name: 'Weight' }),
    page.getByRole('textbox', { name: 'Reps' }),
    page.getByRole('button', { name: 'Complete set' }),
  ];
  for (const control of controls) {
    const box = await control.boundingBox();
    if (!box) throw new Error('control not rendered');
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(667);
  }
  for (const name of ['Decrease Weight', 'Increase Weight', 'Decrease Reps', 'Increase Reps']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.width, name).toBeGreaterThanOrEqual(56);
    expect(box?.height, name).toBeGreaterThanOrEqual(56);
  }
  const complete = await page.getByRole('button', { name: 'Complete set' }).boundingBox();
  expect(complete?.y).toBeGreaterThan((667 * 2) / 3);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(667);

  // With the rest timer and Undo showing, everything still fits.
  await page.getByRole('button', { name: 'Complete set' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo last set' })).toBeVisible();
  const after = await page.getByRole('button', { name: 'Complete set' }).boundingBox();
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeLessThanOrEqual(667);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(667);
});

test('a completed set survives a reload', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /^(Start )?Upper A$/ })
    .first()
    .click();
  await expect(page.getByText(/^Set 1 of \d$/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete set' }).click();
  await expect(page.getByText(/^Set 2 of \d$/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bench press' })).toBeVisible();
  await expect(page.getByText(/^Set 2 of \d$/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('10');
});

test('values typed for a set survive a reload', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /^(Start )?Upper A$/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Complete set' }).click();
  await expect(page.getByText(/^Set 2 of \d$/)).toBeVisible();
  await page.getByRole('button', { name: 'Increase Weight' }).click();
  await page.getByRole('button', { name: 'Decrease Reps' }).click();
  await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('12.5');
  await expect(page.getByRole('textbox', { name: 'Reps' })).toHaveValue('9');
  // Drafts are written in the background; wait until the last one has landed.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const open = indexedDB.open('workout-tracker');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const get = open.result
                .transaction('activeSession')
                .objectStore('activeSession')
                .get('active');
              get.onsuccess = () => resolve(get.result?.draftReps);
            };
          }),
      ),
    )
    .toBe(9);

  await page.reload();
  await expect(page.getByText(/^Set 2 of \d$/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('12.5');
  await expect(page.getByRole('textbox', { name: 'Reps' })).toHaveValue('9');
});
