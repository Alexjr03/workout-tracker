#!/usr/bin/env node
// Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
// Usage: node scripts/make-icons.mjs   (needs `npx playwright install webkit`)
import { readFileSync } from 'node:fs';
import { webkit } from '@playwright/test';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const SIZES = [180, 192, 512];

const browser = await webkit.launch();
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: `public/icons/icon-${size}.png` });
  await page.close();
}
await browser.close();
console.log(`make-icons: wrote ${SIZES.map((s) => `icon-${s}.png`).join(', ')}`);
