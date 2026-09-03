#!/usr/bin/env node
/**
 * Capture the README screenshots from a running dev or prod server.
 *
 *   npm run screenshots                       # against http://localhost:3000
 *   BASE_URL=http://localhost:3100 npm run screenshots
 *
 * Needs a browser: `npx playwright install chromium`.
 *
 * Runs against the demo store, so nothing is written anywhere. The demo
 * session cookie is what the app's proxy looks for.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const SHOTS = [
  { name: '01-dashboard', path: '/home', width: 1440, height: 1400 },
  { name: '02-courses', path: '/courses', width: 1440, height: 1400 },
  { name: '03-course', path: '/courses/ap-statistics', width: 1440, height: 1600 },
  { name: '04-schedule', path: '/courses/ap-statistics/plan', width: 1440, height: 1600 },
  { name: '05-practice', path: '/practice/ap-statistics?mode=mixed', width: 1440, height: 1300 },
  { name: '06-progress', path: '/progress', width: 1440, height: 1500 },
  { name: '07-planner', path: '/planner', width: 1440, height: 1500 },
  { name: '08-exam', path: '/exam', width: 1440, height: 1500 },
  { name: '09-landing', path: '/', width: 1440, height: 1400 },
];

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      [
        'Playwright is not installed.',
        '',
        '  npm i -D playwright',
        '  npx playwright install chromium',
        '',
        'Then start the app (NEXT_PUBLIC_DEMO=1 npm run dev) and re-run.',
      ].join('\n'),
    );
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  /* Demo mode authenticates by cookie — see src/proxy.ts. */
  await context.addCookies([
    {
      name: 'selfap_demo',
      value: '1',
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  /* Let entrance animations settle so nothing is captured mid-transition. */
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const shot of SHOTS) {
    await page.setViewportSize({ width: shot.width, height: 900 });
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const file = join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  · ${shot.name}.png`);
  }

  /* The same app on a phone. */
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: join(OUT, '10-mobile-dashboard.png'), fullPage: true });
  console.log('  · 10-mobile-dashboard.png');

  await browser.close();
  console.log(`\nWrote ${SHOTS.length + 1} images to docs/screenshots/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
