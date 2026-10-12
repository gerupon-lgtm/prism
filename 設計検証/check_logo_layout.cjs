// Checks the real browser layout of the adopted logo preview. No device claims.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}
const library = argument('--playwright-path');
if (!library) throw new Error('Pass --playwright-path pointing to an installed playwright-core package.');
const cache = argument('--browser-cache');
if (cache) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const playwright = require(path.resolve(library));
const root = path.resolve(__dirname, '..', '画面案', 'ロゴ');
const output = path.resolve(__dirname, 'ロゴ');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.ttf': 'font/ttf' };
const report = { previewVersion: '0.1.0', evidence: 'Desktop browser engines with simulated viewport sizes; not real-device acceptance.', results: [] };
const sizes = [[320, 480], [360, 640], [390, 664], [430, 780], [480, 240], [568, 260], [844, 310], [768, 1024], [1280, 800], [240, 160]];

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measure(page, engine, label) {
  const result = await page.evaluate(() => {
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const prism = document.querySelector('h1');
    const notes = document.querySelector('h2');
    const a = getComputedStyle(prism), b = getComputedStyle(notes);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      stage: bounds(document.querySelector('.logo-stage')),
      content: [bounds(prism), bounds(notes), bounds(document.querySelector('footer'))],
      fontSizes: [parseFloat(a.fontSize), parseFloat(b.fontSize)],
      colors: [a.color, b.color, getComputedStyle(document.body).backgroundColor],
      fonts: [...document.fonts].map(font => ({ weight: font.weight, status: font.status })),
      scale: Number(getComputedStyle(document.querySelector('.logo-container')).getPropertyValue('--logo-scale')),
      version: document.querySelector('[data-preview-version]').textContent,
      clipping: [...document.querySelectorAll('html,body,.preview,.logo-stage,.logo-container')].some(element => {
        const style = getComputedStyle(element);
        return [style.overflowX, style.overflowY].some(value => value === 'hidden' || value === 'clip');
      })
    };
  });
  assert(result.document.width <= result.viewport.width, `${engine} ${label}: horizontal overflow`);
  assert(result.document.height <= result.viewport.height, `${engine} ${label}: vertical overflow`);
  assert(!result.clipping, 'Overflow must fit rather than be hidden.');
  for (const rect of result.content) {
    assert(rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= result.viewport.width + 0.5 && rect.bottom <= result.viewport.height + 0.5, `${engine} ${label}: content outside viewport`);
  }
  for (const rect of result.content.slice(0, 2)) {
    const stage = result.stage;
    assert(rect.left >= stage.left - 0.5 && rect.right <= stage.right + 0.5 && rect.top >= stage.top - 0.5 && rect.bottom <= stage.bottom + 0.5, `${engine} ${label}: logo outside allotted space`);
  }
  assert(result.fontSizes.every(size => size > 0));
  assert(Math.abs(result.fontSizes[0] / result.fontSizes[1] - 96 / 36) < 0.005, 'Preserve original text proportions.');
  assert.deepEqual(result.colors, ['rgb(223, 185, 110)', 'rgb(198, 163, 85)', 'rgb(6, 11, 20)']);
  assert.equal(result.version, 'v0.1.0');
  assert(result.fonts.length === 2 && result.fonts.every(font => font.status === 'loaded'), 'Use both supplied Montserrat weights.');
  assert(result.scale > 0 && result.scale <= 1);
  report.results.push({ engine, label, ...result });
}

const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404).end(); }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/prism_notes_logo_preview.html`;
  try {
    for (const engine of ['chromium', 'webkit']) {
      const browser = await playwright[engine].launch({ headless: true });
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2 });
        // Preview assets must be local; external font dependencies must not sneak in.
        await context.route('**/*', route => {
          if (new URL(route.request().url()).hostname !== '127.0.0.1') route.abort();
          else route.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          await settle(page);
          await measure(page, engine, `${width}x${height}`);
          if (engine === 'chromium' && [[390, 664], [568, 260]].some(size => size[0] === width && size[1] === height)) {
            await page.screenshot({ path: path.join(output, `logo-${width}x${height}-v0.1.0.png`) });
          }
        }
        // A fresh load whose fonts arrive late must re-fit after the font swap.
        const delayed = await context.newPage();
        await delayed.route('**/*.ttf?*', async route => {
          await new Promise(resolve => setTimeout(resolve, 250));
          await route.continue();
        });
        await delayed.goto(url);
        await settle(delayed);
        await measure(delayed, engine, 'delayed-fonts-390x664');
        assert.deepEqual(errors, []);
        console.log(`PASS ${engine}: ${sizes.length} viewport changes + delayed fonts`);
        await context.close();
      } finally { await browser.close(); }
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure = error.message;
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'logo-layout-report-v0.1.0.json'), JSON.stringify(report, null, 2) + '\n');
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
