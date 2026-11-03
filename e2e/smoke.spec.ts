import { expect, test } from '@playwright/test';

const TABS = ['Today', 'History', 'Body', 'Food', 'Settings'];

test('app loads on Today', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('tabs are at least 56px tall and reachable at the bottom', async ({ page }) => {
  await page.goto('/');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');
  for (const name of TABS) {
    const box = await page.getByRole('link', { name }).boundingBox();
    if (!box) throw new Error(`No box for ${name}`);
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(box.y).toBeGreaterThan(viewport.height * 0.75);
  }
});

test('manifest is linked and installable fields are set', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  if (!href) throw new Error('No manifest link');
  const manifest = await (await request.get(href)).json();
  expect(manifest).toMatchObject({ name: 'Workout', display: 'standalone' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /180/);
});
