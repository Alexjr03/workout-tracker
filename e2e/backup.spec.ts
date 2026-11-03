import { expect, test } from '@playwright/test';

function countStore(store: string) {
  return new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('workout-tracker');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction(store).objectStore(store).count();
      request.onsuccess = () => {
        open.result.close();
        resolve(request.result);
      };
    };
  });
}

// Desktop WebKit has no file Share Sheet; take the download path like an older iPhone would.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined });
  });
});

test('export → wipe → import restores the data', async ({ page }, testInfo) => {
  // Something to back up: a cardio session.
  await page.goto('/');
  await page
    .getByRole('button', { name: /^(Start )?Cardio$/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'StairMaster' }).click();
  await page.getByRole('button', { name: 'Save cardio' }).click();
  await expect(page.getByRole('heading', { name: 'Cardio done' })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^workout-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = testInfo.outputPath('backup.json');
  await download.saveAs(file);
  await expect(page.getByText('Last backup: today')).toBeVisible();

  // Wipe everything (Dexie closes its connection on the delete request), then start fresh.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('workout-tracker');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
  await page.goto('/#/settings');
  await expect(page.getByText('Last backup: never')).toBeVisible();
  expect(await page.evaluate(countStore, 'cardio')).toBe(0);

  await page.getByLabel('Import backup').setInputFiles(file);
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('1 sessions, 0 sets, 1 cardio');
  await dialog.getByRole('button', { name: 'Replace all data' }).click();
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await expect(page.getByText('Last backup: today')).toBeVisible();
  expect(await page.evaluate(countStore, 'cardio')).toBe(1);
  expect(await page.evaluate(countStore, 'sessions')).toBe(1);
});

test('a file that is not a backup is rejected', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Import backup').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(page.getByText('This file is not a Workout backup.')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
