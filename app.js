export const FORMAL_STEPS = [
  { icon: '💬', label: '父母回应' },
  { icon: '🧧', label: '递彩礼' },
  { icon: '💝', label: '弟妹红包' },
  { icon: '🙏', label: '一起致谢' },
  { icon: '📷', label: '全家合影' },
  { icon: '🥢', label: '礼成开饭' },
];

export const DAY_SCHEDULE = [
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
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.3;
const SCALE_STEP = 0.1;

export function createDefaultState() {
  return {
    formalChecks: Array(FORMAL_STEPS.length).fill(false),
    scheduleChecks: Array(DAY_SCHEDULE.length).fill(false),
    letterOpened: false,
    readerFontScale: 1,
  };
}

export function clampFontScale(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  const rounded = Math.round(number * 10) / 10;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, rounded));
}

function validChecks(value, length) {
  return Array.isArray(value)
    && value.length === length
    && value.every((item) => typeof item === 'boolean');
}

export function normalizeState(value) {
  const defaults = createDefaultState();
  if (!value || typeof value !== 'object') return defaults;

  return {
    formalChecks: validChecks(value.formalChecks, FORMAL_STEPS.length)
      ? [...value.formalChecks]
      : defaults.formalChecks,
    scheduleChecks: validChecks(value.scheduleChecks, DAY_SCHEDULE.length)
      ? [...value.scheduleChecks]
      : defaults.scheduleChecks,
    letterOpened: typeof value.letterOpened === 'boolean'
      ? value.letterOpened
      : defaults.letterOpened,
    readerFontScale: value.readerFontScale >= MIN_SCALE && value.readerFontScale <= MAX_SCALE
      ? clampFontScale(value.readerFontScale)
      : defaults.readerFontScale,
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Completion state remains available for this page session.
  }
}

let state = createDefaultState();
let currentView = 'cover';
let currentCardIndex = null;
let wakeLock = null;
let statusTimer = null;

const elements = {};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setReaderStatus(message, timeout = 4200) {
  if (!elements.readerStatus) return;
  window.clearTimeout(statusTimer);
  elements.readerStatus.textContent = message;
  if (message && timeout) {
    statusTimer = window.setTimeout(() => {
      elements.readerStatus.textContent = '';
    }, timeout);
  }
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    setReaderStatus('朗读提示：请暂时关闭手机自动锁屏');
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    setReaderStatus('朗读提示：请暂时关闭手机自动锁屏');
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // A browser may release the lock automatically when the page is hidden.
  }
  wakeLock = null;
}

function showView(id) {
  if (!elements.views.has(id)) return;
  currentView = id;

  for (const [viewId, view] of elements.views) {
    const active = viewId === id;
    view.classList.toggle('is-active', active);
    view.setAttribute('aria-hidden', String(!active));
  }

  if (id === 'letter') {
    requestWakeLock();
  } else {
    releaseWakeLock();
  }

  window.scrollTo({ top: 0, behavior: 'auto' });
}

function openLetter({ animate }) {
  state.letterOpened = true;
  saveState();

  if (!animate) {
    showView('letter');
    return;
  }

  showView('envelope');
  elements.envelopeGraphic.classList.remove('is-opening');
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      elements.envelopeGraphic.classList.add('is-opening');
    });
  });

  const delay = prefersReducedMotion() ? 0 : 720;
  window.setTimeout(() => showView('letter'), delay);
}

function applyFontScale(scale, announce = false) {
  state.readerFontScale = clampFontScale(scale);
  document.documentElement.style.setProperty('--reader-scale', state.readerFontScale);
  saveState();
  if (announce) {
    setReaderStatus(`当前字号 ${Math.round(state.readerFontScale * 100)}%`, 1800);
  }
}

function createCheckButton(item, checked, index, kind) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'check-item';
  button.dataset.kind = kind;
  button.dataset.index = String(index);
  button.setAttribute('role', 'checkbox');
  button.setAttribute('aria-checked', String(checked));
  button.setAttribute('aria-label', `${item.label}，${checked ? '已完成' : '未完成'}`);

  button.innerHTML = `
    <span class="check-number" aria-hidden="true">${kind === 'schedule' ? String(index + 1).padStart(2, '0') : ''}</span>
    <span class="check-icon" aria-hidden="true">${item.icon}</span>
    <span class="check-label">${item.label}</span>
    <span class="check-mark" aria-hidden="true">✓</span>
  `;
  li.append(button);
  return li;
}

function updateProgress() {
  const formalDone = state.formalChecks.filter(Boolean).length;
  const scheduleDone = state.scheduleChecks.filter(Boolean).length;
  elements.formalProgress.textContent = `已完成 ${formalDone}/${FORMAL_STEPS.length}`;
  elements.formalProgressBar.style.width = `${(formalDone / FORMAL_STEPS.length) * 100}%`;
  elements.scheduleProgress.textContent = `已完成 ${scheduleDone}/${DAY_SCHEDULE.length}`;
}

function renderChecklists() {
  elements.formalList.replaceChildren(
    ...FORMAL_STEPS.map((item, index) => createCheckButton(
      item,
      state.formalChecks[index],
      index,
      'formal',
    )),
  );
  elements.scheduleList.replaceChildren(
    ...DAY_SCHEDULE.map((item, index) => createCheckButton(
      item,
      state.scheduleChecks[index],
      index,
      'schedule',
    )),
  );
  updateProgress();
}

function renderCueLines() {
  const fragment = document.createDocumentFragment();
  for (const [label, copy] of CUE_LINES) {
    const item = document.createElement('div');
    item.className = 'cue-item';
    const heading = document.createElement('b');
    const paragraph = document.createElement('p');
    heading.textContent = label;
    paragraph.textContent = copy;
    item.append(heading, paragraph);
    fragment.append(item);
  }
  elements.cueLines.replaceChildren(fragment);
}

function toggleCheck(kind, index) {
  const key = kind === 'formal' ? 'formalChecks' : 'scheduleChecks';
  if (!Number.isInteger(index) || index < 0 || index >= state[key].length) return;
  state[key][index] = !state[key][index];
  saveState();
  renderChecklists();
}

function openFormalCard(index) {
  const item = FORMAL_STEPS[index];
  if (!item) return;
  currentCardIndex = index;
  elements.formalCardNumber.textContent = `第 ${index + 1} 项`;
  elements.formalCardIcon.textContent = item.icon;
  elements.formalCardTitle.textContent = item.label;
  elements.formalCardCheck.textContent = state.formalChecks[index] ? '取消完成' : '标记完成';
  elements.formalCardCheck.dataset.index = String(index);
  if (typeof elements.formalCardDialog.showModal === 'function') {
    elements.formalCardDialog.showModal();
  } else {
    elements.formalCardDialog.setAttribute('open', '');
  }
}

function closeFormalCard() {
  if (typeof elements.formalCardDialog.close === 'function') {
    elements.formalCardDialog.close();
  } else {
    elements.formalCardDialog.removeAttribute('open');
  }
  currentCardIndex = null;
}

const actions = {
  'go-ready': () => showView('ready'),
  'go-cover': () => showView('cover'),
  'direct-letter': () => openLetter({ animate: false }),
  'start-ceremony': () => openLetter({ animate: true }),
  'continue-flow': () => showView('formal-flow'),
  'show-schedule': () => showView('day-schedule'),
  'show-closing': () => showView('closing'),
  'reread-letter': () => openLetter({ animate: false }),
  'font-decrease': () => applyFontScale(state.readerFontScale - SCALE_STEP, true),
  'font-increase': () => applyFontScale(state.readerFontScale + SCALE_STEP, true),
  'close-card': closeFormalCard,
};

function handleClick(event) {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const action = actions[actionButton.dataset.action];
    if (action) action();
    return;
  }

  const checkButton = event.target.closest('.check-item');
  if (checkButton) {
    const index = Number.parseInt(checkButton.dataset.index, 10);
    if (checkButton.dataset.kind === 'formal') {
      openFormalCard(index);
    } else {
      toggleCheck('schedule', index);
    }
  }
}

function cacheElements() {
  elements.views = new Map(
    [...document.querySelectorAll('[data-view]')].map((view) => [view.dataset.view, view]),
  );
  elements.envelopeGraphic = document.querySelector('#envelopeGraphic');
  elements.readerStatus = document.querySelector('#readerStatus');
  elements.formalList = document.querySelector('#formalList');
  elements.scheduleList = document.querySelector('#scheduleList');
  elements.formalProgress = document.querySelector('#formalProgress');
  elements.formalProgressBar = document.querySelector('#formalProgressBar');
  elements.scheduleProgress = document.querySelector('#scheduleProgress');
  elements.cueLines = document.querySelector('#cueLines');
  elements.formalCardDialog = document.querySelector('#formalCardDialog');
  elements.formalCardNumber = document.querySelector('#formalCardNumber');
  elements.formalCardIcon = document.querySelector('#formalCardIcon');
  elements.formalCardTitle = document.querySelector('#formalCardTitle');
  elements.formalCardCheck = document.querySelector('#formalCardCheck');
}

function init() {
  state = loadState();
  cacheElements();
  applyFontScale(state.readerFontScale);
  renderChecklists();
  renderCueLines();
  document.addEventListener('click', handleClick);

  elements.formalCardCheck.addEventListener('click', () => {
    if (currentCardIndex === null) return;
    toggleCheck('formal', currentCardIndex);
    openFormalCard(currentCardIndex);
  });

  elements.formalCardDialog.addEventListener('click', (event) => {
    if (event.target === elements.formalCardDialog) closeFormalCard();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentView === 'letter' && !wakeLock) {
      requestWakeLock();
    }
  });

  showView('cover');
  document.documentElement.classList.add('js-ready');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

if (typeof document !== 'undefined') {
  init();
}
