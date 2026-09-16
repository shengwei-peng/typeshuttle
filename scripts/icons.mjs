// Renders the extension icons in assets/icons from the SVG sources.
// assets/logo-small.svg is drawn on a 16 px grid for the toolbar sizes; assets/logo.svg is used for larger sizes.
// The 128 px icon keeps a 16 px transparent margin, as the Chrome Web Store asks.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const ICONS = [
  { size: 16, source: 'assets/logo-small.svg', artwork: 16 },
  { size: 32, source: 'assets/logo-small.svg', artwork: 32 },
  { size: 48, source: 'assets/logo.svg', artwork: 48 },
  { size: 128, source: 'assets/logo.svg', artwork: 96 },
];

const pageFor = (svg, { size, artwork }) => `<!doctype html>
<style>html,body{margin:0;background:transparent}body{width:${size}px;height:${size}px;display:grid;place-items:center}
img{width:${artwork}px;height:${artwork}px;display:block}</style>
<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" alt="">`;

const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const svg = await readFile(path.join(root, icon.source), 'utf8');
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
    await page.setContent(pageFor(svg, icon));
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(root, 'assets/icons', `icon-${icon.size}.png`), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Rendered ${ICONS.length} icons into assets/icons`);
