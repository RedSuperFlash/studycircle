import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';

const dist = resolve('dist');
const mime = {
  html: 'text/html',
  js: 'text/javascript',
  css: 'text/css',
  svg: 'image/svg+xml',
  png: 'image/png',
  webmanifest: 'application/manifest+json',
  woff2: 'font/woff2',
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith('/studycircle/')) {
    res.writeHead(404).end();
    return;
  }
  const target = resolve(dist, path.slice('/studycircle/'.length) || 'index.html');
  if (!target.startsWith(dist + sep)) {
    res.writeHead(400).end();
    return;
  }
  try {
    const data = await readFile(target);
    res
      .writeHead(200, {
        'Content-Type': mime[target.split('.').pop()] || 'application/octet-stream',
      })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const site = 'http://127.0.0.1:' + server.address().port + '/studycircle/';
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(site + '#/study?tab=Planner');
  await page
    .getByRole('heading', { name: 'Study planner', exact: true })
    .waitFor({ timeout: 15000 });
  const manifest = await (await page.request.get(site + 'manifest.webmanifest')).json();
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons)
    assert.ok((await page.request.get(new URL(icon.src, site).href)).ok());
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const entries = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map((r) => new URL(r.url).pathname),
        ),
      )
    ).flat();
  });
  assert.deepEqual(entries, ['/studycircle/offline.html']);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'You’re offline' }).waitFor({ timeout: 10000 });
  assert.deepEqual(errors, []);
  console.log(
    'Production subpath, hash navigation, icons, service worker and offline fallback passed.',
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
