// Renders every ad format to brand/ads/*.png.
//   node brand/ads/src/render.mjs            -> all formats
//   node brand/ads/src/render.mjs led geant  -> only these
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..');
const page = pathToFileURL(path.join(here, 'flyer.html')).href;
const icon = pathToFileURL(path.resolve(here, '../../outforground-app-icon.svg')).href;

const formats = {
  panneau: [2400, 1200], story: [1080, 1920], portrait: [1080, 1350], carre: [1080, 1080],
  icone: [512, 512], led: [1800, 1000], geant: [2860, 1000], sucette: [1400, 2000], banderole: [2500, 400],
};
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(formats);

const browser = await chromium.launch();
for (const f of wanted) {
  const [width, height] = formats[f];
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (f === 'icone') {
    await p.goto(icon);
    await p.evaluate(() => { const s = document.documentElement; s.setAttribute('width', 512); s.setAttribute('height', 512); });
  } else {
    await p.goto(`${page}?f=${f}`);
  }
  if (f !== 'icone') await p.waitForFunction(() => window.__ready === true);
  await p.waitForLoadState('networkidle');
  const file = path.join(out, `outforground-${f}.png`);
  await p.screenshot({ path: file, omitBackground: f === 'icone' });
  console.log(`${file}  ${width}×${height}`);
  await p.close();
}
await browser.close();
