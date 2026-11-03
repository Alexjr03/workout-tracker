import { expect, test } from '@playwright/test';

function readStore(store: string) {
  return new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open('workout-tracker');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}

test('first launch seeds the routine into IndexedDB, once', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();

  const exercises = await page.evaluate(readStore, 'exercises');
  expect(exercises).toHaveLength(21);
  const [settings] = (await page.evaluate(readStore, 'settings')) as { calorieMax: number }[];
  expect(settings?.calorieMax).toBe(1500);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  expect(await page.evaluate(readStore, 'settings')).toHaveLength(1);
});
