import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the letter is the ceremony opening and precedes the formal flow', async () => {
  const html = await read('index.html');
  const ready = html.indexOf('id="ready"');
  const letter = html.indexOf('id="letter"');
  const formal = html.indexOf('id="formal-flow"');

  assert.ok(ready > -1, 'ready view is missing');
  assert.ok(letter > ready, 'letter must follow ready view');
  assert.ok(formal > letter, 'formal flow must follow letter');
  assert.match(html, /给瑶瑶爸爸妈妈的一封信/);
  assert.match(html, /继续订婚流程/);
});

test('removed pre-arrival and post-arrival steps stay removed', async () => {
  const html = await read('index.html');

  for (const text of ['男方提聘礼上门', '女方备宴迎客', '毓灵到家']) {
    assert.doesNotMatch(html, new RegExp(text));
  }
});

test('formal and day schedule labels are exact and separate', async () => {
  const app = await read('app.js');

  for (const text of ['父母回应', '递彩礼', '弟妹红包', '一起致谢', '全家合影', '礼成开饭']) {
    assert.match(app, new RegExp(text));
  }
  for (const text of ['一起吃饭', '饭后喝茶', '临行红包', '13:30返程']) {
    assert.match(app, new RegExp(text));
  }
  assert.match(app, /engagement-ceremony-v2/);
});

test('the page includes privacy, accessibility, and offline hooks', async () => {
  const [html, app, worker] = await Promise.all([
    read('index.html'),
    read('app.js'),
    read('service-worker.js'),
  ]);

  assert.match(html, /noindex, nofollow, noarchive/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /<section[^>]*data-view[^>]*aria-hidden="true"/);
  assert.match(app, /wakeLock\.request/);
  assert.match(app, /serviceWorker\.register/);
  for (const asset of ['./', './index.html', './styles.css', './app.js']) {
    assert.match(worker, new RegExp(asset.replaceAll('.', '\\.')));
  }
});

test('the full letter remains in server-rendered HTML', async () => {
  const html = await read('index.html');

  assert.match(html, /我是小艾/);
  assert.match(html, /风筝线永远都在国内/);
  assert.match(html, /望叔叔阿姨的批准/);
  assert.match(html, /2026年8月2日/);
  assert.match(html, /艾毓灵/);
  assert.match(html, /现场话术/);
});

test('versioned state rejects the whole malformed payload and clamps reader scale', async () => {
  const { clampFontScale, normalizeState } = await import('../app.js');
  const normalized = normalizeState({
    formalChecks: [true],
    scheduleChecks: [true, false, true, false],
    letterOpened: true,
    readerFontScale: 9,
  });

  assert.deepEqual(normalized.formalChecks, [false, false, false, false, false, false]);
  assert.deepEqual(normalized.scheduleChecks, [false, false, false, false]);
  assert.equal(normalized.letterOpened, false);
  assert.equal(normalized.readerFontScale, 1);
  assert.equal(normalizeState({
    formalChecks: [false, false, false, false, false, false],
    scheduleChecks: [false, false, false, false],
    letterOpened: false,
    readerFontScale: '1.2',
  }).readerFontScale, 1);
  assert.equal(clampFontScale(0.2), 0.9);
  assert.equal(clampFontScale(2), 1.3);
  assert.equal(clampFontScale(1.17), 1.2);
});

test('two clicks open the letter, move focus, and formal activation checks the item', async () => {
  const html = await read('index.html');
  const dom = new JSDOM(html, { url: 'https://example.test/' });
  let wakeRequests = 0;

  dom.window.scrollTo = () => {};
  dom.window.matchMedia = () => ({ matches: true });
  dom.window.requestAnimationFrame = (callback) => callback();
  Object.defineProperty(dom.window.navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async () => {
        wakeRequests += 1;
        return {
          addEventListener: () => {},
          release: async () => {},
        };
      },
    },
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.localStorage = dom.window.localStorage;

  await import(`../app.js?dom-test=${Date.now()}`);

  document.querySelector('[data-action="go-ready"]').click();
  assert.ok(document.querySelector('#ready').classList.contains('is-active'));

  document.querySelector('[data-action="start-ceremony"]').click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 5));
  const letter = document.querySelector('#letter');
  assert.ok(letter.classList.contains('is-active'));
  assert.equal(document.activeElement, letter.querySelector('h2'));
  assert.equal(wakeRequests, 1);

  document.querySelector('[data-action="continue-flow"]').click();
  document.querySelector('#formalList .check-item').click();
  const firstFormal = document.querySelector('#formalList .check-item');
  assert.equal(firstFormal.getAttribute('aria-checked'), 'true');
  assert.ok(document.querySelector('#formalCardDialog').hasAttribute('open'));

  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.navigator;
  delete globalThis.localStorage;
});
