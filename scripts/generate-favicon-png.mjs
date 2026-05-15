/** public/favicon.svg → PNG (일회성·재생성용) */
import { chromium } from 'playwright';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgUrl = pathToFileURL(join(root, 'public', 'favicon.svg')).href;

const sizes = [
  { out: 'favicon.png', size: 32 },
  { out: 'apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { out, size } of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0A0A0E">
      <img src="${svgUrl}" width="${size}" height="${size}" alt="" />
    </body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.screenshot({
    path: join(root, 'public', out),
    clip: { x: 0, y: 0, width: size, height: size },
  });
  console.log(`wrote public/${out} (${size}×${size})`);
}

await browser.close();
