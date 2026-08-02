# Engagement Digital Letter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static engagement page so the electronic letter is the ceremony opening, followed by six short formal steps and a separate four-item day schedule.

**Architecture:** Keep the GitHub Pages deployment static, but split the current 1,100-line single file into semantic HTML, focused CSS, interaction/state JavaScript, and a small service worker. The letter remains server-rendered in HTML; JavaScript only adds view transitions, checklist state, font controls, wake lock, and offline enhancement.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Node.js built-in test runner, Service Worker API, Screen Wake Lock API, GitHub Pages.

---

## File map

- Modify `index.html`: semantic views, complete letter content, short ceremony labels, privacy metadata, accessible controls.
- Create `styles.css`: responsive presentation, letter reader, cards, reduced motion, focus and contrast rules.
- Create `app.js`: view navigation, versioned state, checklist rendering, font scale, wake lock, envelope transition, service worker registration.
- Create `service-worker.js`: cache the four static application files after the first successful visit.
- Create `tests/site.test.mjs`: source-level contract tests using only Node built-ins.

### Task 1: Lock the approved information architecture with failing tests

**Files:**
- Create: `tests/site.test.mjs`
- Test: `tests/site.test.mjs`

- [ ] **Step 1: Create the source contract tests**

Create `tests/site.test.mjs` with tests that read the production files and assert the approved structure:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
```

- [ ] **Step 2: Run the tests and verify the intended failure**

Run:

```bash
node --test tests/site.test.mjs
```

Expected: FAIL because `app.js` and `service-worker.js` do not exist and the current `index.html` keeps the letter after the old twelve-step flow.

- [ ] **Step 3: Commit the failing contract tests**

```bash
git add tests/site.test.mjs
git commit -m "test: define electronic letter ceremony contract"
```

### Task 2: Replace the old page with the electronic-letter-first shell

**Files:**
- Modify: `index.html`
- Create: `styles.css`
- Test: `tests/site.test.mjs`

- [ ] **Step 1: Replace `index.html` with semantic views**

The document must contain these views in this exact order:

```html
<main>
  <section id="cover" class="view is-active" data-view="cover">
    <p>贰零贰陆 · 捌月贰日</p><h1>艾毓灵 <span>&amp;</span> 瑶瑶</h1>
    <p>订婚之礼 · 贵溪</p>
    <button data-action="go-ready">仪式开始</button>
    <button data-action="direct-letter">直接看信</button>
  </section>
  <section id="ready" class="view" data-view="ready">
    <h2>开始前确认</h2><ul class="ready-list"></ul>
    <button data-action="start-ceremony">开始仪式</button>
  </section>
  <section id="envelope" class="view" data-view="envelope">
    <h2>给瑶瑶爸爸妈妈的一封信</h2><p>瑶瑶爸爸妈妈 亲启</p>
  </section>
  <section id="letter" class="view reader-view" data-view="letter">
    <div class="reader-toolbar"></div><article class="letter-copy"></article>
    <button data-action="continue-flow">继续订婚流程</button>
  </section>
  <section id="formal-flow" class="view" data-view="formal-flow">
    <h2>今天的订婚仪式</h2><p id="formal-progress"></p><ol id="formal-list"></ol>
    <details class="cue-lines"><summary>现场话术</summary><div id="cue-lines"></div></details>
  </section>
  <section id="day-schedule" class="view" data-view="day-schedule">
    <h2>今天余下安排</h2><p id="schedule-progress"></p><ul id="schedule-list"></ul>
  </section>
  <section id="closing" class="view" data-view="closing">
    <blockquote>风筝线永远都在国内，抓住风筝线的那个手永远都是瑶瑶的手。</blockquote>
    <button data-action="reread-letter">重读这封信</button>
    <button data-action="show-schedule">查看当天安排</button>
  </section>
</main>
```

The `<head>` must link `styles.css`, add the privacy directive, retain responsive viewport metadata, and load `app.js` with `defer`:

```html
<meta name="robots" content="noindex, nofollow, noarchive">
<link rel="stylesheet" href="styles.css">
<script src="app.js" defer></script>
```

The cover uses two actions:

```html
<button class="primary-action" data-action="go-ready">仪式开始</button>
<button class="text-action" data-action="direct-letter">直接看信</button>
```

The ready view contains the three approved checks as static text and one button:

```html
<ul class="ready-list" aria-label="开始前确认">
  <li>人已到齐</li>
  <li>茶已倒好</li>
  <li>手机已静音</li>
</ul>
<button class="primary-action" data-action="start-ceremony">开始仪式</button>
```

The envelope is a transition containing “给瑶瑶爸爸妈妈的一封信” and “亲启”; it has no third confirmation button. The letter view contains the complete existing letter in normal HTML paragraphs, font controls with accessible labels, an `aria-live="polite"` status region, and a final `继续订婚流程` button. The formal-flow and day-schedule views contain empty list containers rendered by `app.js`. The closing view contains only the wind-kite quote, names/date, `重读这封信`, and `查看当天安排`.

- [ ] **Step 2: Create the complete responsive stylesheet**

Create `styles.css` with these design tokens and behavioral rules:

```css
:root {
  --red: #8b1a2b;
  --red-deep: #68121f;
  --gold: #b98752;
  --paper: #fdf8f0;
  --cream: #faf8f5;
  --ink: #211d1a;
  --muted: #6b625b;
  --white: #fff;
  --reader-scale: 1;
}

* { box-sizing: border-box; }
html { color-scheme: light; scroll-behavior: smooth; }
body {
  margin: 0;
  color: var(--ink);
  background: var(--cream);
  font-family: "Songti SC", "Noto Serif SC", serif;
}
button { min-width: 44px; min-height: 44px; font: inherit; }
button:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
.view { min-height: 100svh; padding: 32px 20px; }
.js .view:not(.is-active) { display: none; }
.primary-action {
  border: 0;
  border-radius: 999px;
  padding: 12px 28px;
  color: var(--white);
  background: var(--red);
  box-shadow: 0 8px 24px rgb(139 26 43 / 22%);
}
.text-action {
  border: 0;
  padding: 10px 16px;
  color: var(--red-deep);
  background: transparent;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.letter-copy {
  width: min(680px, 100%);
  margin: 0 auto;
  padding: clamp(28px, 7vw, 56px);
  background: var(--paper);
  font-size: calc(clamp(22px, 5vw, 26px) * var(--reader-scale));
  line-height: 1.82;
}
.letter-copy p { margin: 0 0 1.15em; }
.check-item[aria-checked="true"] .check-mark {
  color: var(--white);
  background: #4f7b4d;
  border-color: #4f7b4d;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
@media (min-width: 760px) { .view { padding: 56px 40px; } }
```

Fill the named button, envelope, card, checklist, reader toolbar, status, and closing selectors so that all content is readable at 320px width and 200% zoom. Do not hide the letter with inline `hidden`; without JavaScript, the document must remain readable in source order.

- [ ] **Step 3: Run the contract tests**

```bash
node --test tests/site.test.mjs
```

Expected: letter/order and removed-text tests PASS; tests requiring `app.js` and `service-worker.js` still FAIL.

- [ ] **Step 4: Commit the static shell**

```bash
git add index.html styles.css
git commit -m "feat: make the electronic letter the ceremony opening"
```

### Task 3: Implement ceremony state, navigation, reading controls, and checklists

**Files:**
- Create: `app.js`
- Test: `tests/site.test.mjs`

- [ ] **Step 1: Add the approved data and validated versioned state**

`app.js` must define the exact items and a safe storage boundary:

```js
document.documentElement.classList.add('js');

const FORMAL_STEPS = [
  { icon: '💬', label: '父母回应' },
  { icon: '🧧', label: '递彩礼' },
  { icon: '💝', label: '弟妹红包' },
  { icon: '🙏', label: '一起致谢' },
  { icon: '📷', label: '全家合影' },
  { icon: '🥢', label: '礼成开饭' },
];

const DAY_SCHEDULE = [
  { icon: '🥢', label: '一起吃饭' },
  { icon: '🍵', label: '饭后喝茶' },
  { icon: '🧧', label: '临行红包' },
  { icon: '🚗', label: '13:30返程' },
];

const CUE_LINES = [
  ['读信前', '叔叔、阿姨，这封信是我专门写给你们的。没有准备纸质信，所以今天我就借着手机，认真念给你们听。'],
  ['父母回应', '叔叔、阿姨，你们也跟我们说几句吧，简单说说就好。'],
  ['递彩礼', '叔叔、阿姨，谢谢你们对瑶瑶和我们的信任。这份彩礼和礼物，是我们两家之前商量好的心意，请你们收下。'],
  ['弟妹红包', '这份是给弟弟妹妹的，一点心意，以后我们就是一家人了。'],
  ['收尾', '谢谢双方爸爸妈妈。今天的仪式就完成了，我们一起拍张全家福，然后开饭。'],
];

const STORAGE_KEY = 'engagement-ceremony-v2';
const defaults = {
  formalChecks: Array(FORMAL_STEPS.length).fill(false),
  scheduleChecks: Array(DAY_SCHEDULE.length).fill(false),
  letterOpened: false,
  readerFontScale: 1,
};
```

`loadState()` accepts only boolean arrays of the exact required lengths and a font scale between `0.9` and `1.3`; otherwise it returns defaults. `saveState()` catches storage exceptions.

- [ ] **Step 2: Implement view navigation and the two-click ceremony start**

Add `showView(id)` that toggles `.is-active`, updates `aria-hidden`, scrolls to the top without animation when reduced motion is preferred, releases wake lock when leaving the letter, and requests it when entering the letter.

Button behavior:

```js
actions['go-ready'] = () => showView('ready');
actions['direct-letter'] = () => openLetter({ animate: false });
actions['start-ceremony'] = () => openLetter({ animate: true });
actions['continue-flow'] = () => showView('formal-flow');
actions['show-schedule'] = () => showView('day-schedule');
actions['show-closing'] = () => showView('closing');
actions['reread-letter'] = () => openLetter({ animate: false });
```

`openLetter({ animate: true })` shows the envelope, marks it opened, waits at most 700ms (or zero under reduced motion), then shows the letter. It never requires a third click.

- [ ] **Step 3: Implement reader font and wake-lock controls**

Use one Wake Lock sentinel and safe degradation:

```js
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    setReaderStatus('请暂时关闭手机自动锁屏');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    setReaderStatus('请暂时关闭手机自动锁屏');
  }
}
```

Font buttons clamp `readerFontScale` to `0.9–1.3`, update `--reader-scale`, announce the percentage in the live region, and persist it.

- [ ] **Step 4: Render and update the two checklists**

Create accessible list buttons with `role="checkbox"`, `aria-checked`, a visible mark, icon and label. Formal item activation toggles the check and opens a full-screen short card containing only number, icon, label, and completion control. Schedule items toggle inline and never open full-screen cards.

Checklist completion updates a compact `已完成 X/6` or `已完成 X/4` label. When `礼成开饭` is checked, make the closing action prominent but do not navigate automatically.

- [ ] **Step 5: Run JavaScript syntax and contract tests**

```bash
node --check app.js
node --test tests/site.test.mjs
```

Expected: `node --check` exits 0. Only the service-worker contract may still fail.

- [ ] **Step 6: Commit the interaction layer**

```bash
git add app.js index.html styles.css tests/site.test.mjs
git commit -m "feat: add ceremony reading and checklist interactions"
```

### Task 4: Add offline enhancement and complete automated verification

**Files:**
- Create: `service-worker.js`
- Modify: `app.js`
- Test: `tests/site.test.mjs`

- [ ] **Step 1: Add the service worker**

Create `service-worker.js`:

```js
const CACHE = 'engagement-ceremony-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
```

- [ ] **Step 2: Register it without blocking the page**

At the end of `app.js` initialization:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
```

- [ ] **Step 3: Run the complete automated checks**

```bash
node --check app.js
node --check service-worker.js
node --test tests/site.test.mjs
git diff --check -- index.html styles.css app.js service-worker.js tests/site.test.mjs
```

Expected: both syntax checks exit 0, all Node tests PASS, and `git diff --check` produces no output.

- [ ] **Step 4: Commit the offline enhancement**

```bash
git add app.js service-worker.js tests/site.test.mjs
git commit -m "feat: keep the ceremony page available offline"
```

### Task 5: Verify the production-shaped static site

**Files:**
- Verify: `index.html`
- Verify: `styles.css`
- Verify: `app.js`
- Verify: `service-worker.js`

- [ ] **Step 1: Start a local HTTP server**

```bash
python -m http.server 4173
```

Expected: server listens on `http://127.0.0.1:4173/`.

- [ ] **Step 2: Verify every deployed resource over HTTP**

```bash
curl -fsS http://127.0.0.1:4173/ -o /tmp/engagement-index.html
curl -fsS http://127.0.0.1:4173/styles.css -o /tmp/engagement-styles.css
curl -fsS http://127.0.0.1:4173/app.js -o /tmp/engagement-app.js
curl -fsS http://127.0.0.1:4173/service-worker.js -o /tmp/engagement-worker.js
```

Expected: all four commands exit 0 and return non-empty files.

- [ ] **Step 3: Run final semantic assertions**

```bash
node --test tests/site.test.mjs
rg -n "男方提聘礼上门|女方备宴迎客|毓灵到家" index.html
```

Expected: all tests PASS; `rg` exits 1 with no matches.

- [ ] **Step 4: Inspect scope and commits**

```bash
git status --short
git log --oneline -5
git diff HEAD^ --check
```

Expected: only intended implementation files are present; no user-owned untracked files were added or changed; the latest commits correspond to the tested implementation.

- [ ] **Step 5: Perform completion verification before reporting success**

Re-run the complete check set from Task 4 Step 3 after any final adjustment. Record the exact passing output in the handoff.
