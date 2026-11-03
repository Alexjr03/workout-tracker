import { expect, test } from '@playwright/test';

// Checkpoint C: a whole session in the iPhone browser.

test('complete a full Upper A session with rest timers and finish', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /^(Start )?Upper A$/ })
    .first()
    .click();

  const complete = page.getByRole('button', { name: 'Complete set' });
  const weight = page.getByRole('textbox', { name: 'Weight' });
  // Where the runner is: exercise + set label, or the end state.
  const position = () =>
    page.evaluate(
      () =>
        document
          .querySelector('.runner-target')
          ?.textContent?.replace(/Swap|\s+/g, ' ')
          .trim() ?? '',
    );
  await expect(complete).toBeVisible();

  let sets = 0;
  while (await complete.isVisible()) {
    const before = await position();
    if ((await weight.inputValue()) === '') await weight.fill('20');
    await complete.click();
    sets += 1;
    // Each completed set starts a rest timer and moves on to the next set (or the end).
    await expect(page.getByRole('timer').or(page.getByText('All sets done.'))).toBeVisible();
    await expect.poll(position).not.toBe(before);
    expect(sets).toBeLessThan(25);
  }

  await expect(page.getByText('All sets done.')).toBeVisible();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.getByRole('heading', { name: 'Upper A done' })).toBeVisible();
  // Program starts today, so this is ramp-up: every set (3+3+3+3+2+2), last ones optional but done.
  await expect(page.getByText(/^16 of 16 sets · \d+ min$/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Resume/ })).toHaveCount(0);
});

test('log a cardio session', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: /^(Start )?Cardio$/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'StairMaster' }).click();
  await page.getByRole('button', { name: 'Increase Minutes' }).click();
  await page.getByRole('button', { name: 'Save cardio' }).click();
  await expect(page.getByRole('heading', { name: 'Cardio done' })).toBeVisible();
  await expect(page.getByText('StairMaster · 35 min')).toBeVisible();
});
