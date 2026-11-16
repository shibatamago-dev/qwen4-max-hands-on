// Node DOM-stub harness for Qwen4-Max generated dungeon game.
// Virtual clock: rAF frames advance 50ms each; setTimeout/setInterval are virtual.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/qwen4-max_game.html', 'utf8');
const script = fs.readFileSync(__dirname + '/game_script.js', 'utf8');

// ---------- seeded RNG (mulberry32) ----------
let seed = 1234567;
function rng() {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- element stub ----------
const gradStub = { addColorStop() {} };
const ctxTarget = {};
const ctxStub = new Proxy(ctxTarget, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradStub;
    if (k === 'getImageData') return () => ({ data: [] });
    if (typeof k === 'string') { const f = () => undefined; t[k] = f; return f; }
    return undefined;
  },
  set(t, k, v) { t[k] = v; return true; },
});

class El {
  constructor(tag, id) {
    this.tagName = (tag || 'div').toUpperCase();
    this.id = id || '';
    this.children = [];
    this.style = {};
    this.dataset = {};
    this._text = '';
    this._html = '';
    this._listeners = {};
    this._classes = new Set();
    this.parentNode = null;
    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self._classes.add(x)),
      remove: (...c) => c.forEach(x => self._classes.delete(x)),
      toggle: (c, f) => { if (f === undefined) f = !self._classes.has(c); f ? self._classes.add(c) : self._classes.delete(c); return f; },
      contains: c => self._classes.has(c),
    };
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  prepend(c) { c.parentNode = this; this.children.unshift(c); return c; }
  get lastChild() { return this.children.length ? this.children[this.children.length - 1] : null; }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } }
  addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); }
  removeEventListener() {}
  dispatch(ev, obj) {
    const e = Object.assign({ preventDefault() {}, stopPropagation() {}, target: this, currentTarget: this, clientX: 0, clientY: 0 }, obj || {});
    (this._listeners[ev] || []).slice().forEach(f => f(e));
    return e;
  }
  click() { this.dispatch('click'); }
  querySelector() { if (!this._qs) this._qs = new El('div'); return this._qs; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { width: 640, height: 640, left: 0, top: 0, right: 640, bottom: 640 }; }
  get clientWidth() { return 640; }
  get clientHeight() { return 640; }
  get offsetWidth() { return 640; }
  getContext() { return ctxStub; }
  focus() {} blur() {} setAttribute() {} getAttribute() { return null; }
}

// ---------- build element registry from HTML ----------
const registry = new Map();
const tagRe = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
let m;
while ((m = tagRe.exec(html)) !== null) {
  const attrs = m[2];
  const idM = attrs.match(/id="([^"]+)"/);
  if (!idM) continue;
  const elx = new El(m[1], idM[1]);
  const clM = attrs.match(/class="([^"]*)"/);
  if (clM) elx.className = clM[1];
  registry.set(idM[1], elx);
}
// D-pad buttons (.dbtn[data-dir])
const dpad = [];
const btnRe = /<button([^>]*)>/g;
while ((m = btnRe.exec(html)) !== null) {
  const dirM = m[1].match(/data-dir="([^"]+)"/);
  if (dirM) { const b = new El('button'); b.dataset.dir = dirM[1]; dpad.push(b); }
}

const documentStub = {
  getElementById: id => registry.get(id) || null,
  querySelectorAll: sel => (sel.includes('dbtn') ? dpad : []),
  querySelector: () => new El('div'),
  createElement: tag => new El(tag),
  addEventListener() {},
  body: new El('body'),
  documentElement: new El('html'),
  hidden: false,
};

// ---------- virtual clock ----------
let now = 0;
const timers = new Map();
let tid = 0;
const vSetTimeout = (cb, ms, ...a) => { const id = ++tid; timers.set(id, { at: now + (ms || 0), cb, args: a, interval: 0 }); return id; };
const vSetInterval = (cb, ms, ...a) => { const id = ++tid; timers.set(id, { at: now + (ms || 0), cb, args: a, interval: ms || 0 }); return id; };
const vClear = id => timers.delete(id);
let rafQ = [];
const raf = cb => { rafQ.push(cb); return rafQ.length; };
function pump(frames) {
  for (let i = 0; i < frames; i++) {
    now += 50;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        if (t.interval) t.at = now + t.interval; else timers.delete(id);
        t.cb(...t.args);
      }
    }
    const q = rafQ; rafQ = [];
    for (const cb of q) cb(now);
  }
}

// ---------- sandbox ----------
const winListeners = {};
const store = {};
const sandbox = {
  console,
  document: documentStub,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  setTimeout: vSetTimeout, setInterval: vSetInterval,
  clearTimeout: vClear, clearInterval: vClear,
  requestAnimationFrame: raf,
  performance: { now: () => now },
  ResizeObserver: class { constructor(cb) {} observe() {} unobserve() {} disconnect() {} },
  navigator: { userAgent: 'node-harness' },
  location: { href: 'http://localhost/game.html' },
  devicePixelRatio: 1,
  innerWidth: 800, innerHeight: 800,
  addEventListener: (ev, fn) => { (winListeners[ev] = winListeners[ev] || []).push(fn); },
  removeEventListener() {},
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
for (const [id, elx] of registry) sandbox[id] = elx;

function key(k) {
  const e = { key: k, ctrlKey: false, metaKey: false, altKey: false, preventDefault() {} };
  (winListeners['keydown'] || []).slice().forEach(f => f(e));
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

const E = id => registry.get(id);
const hud = () => ({
  floor: E('floorBadge').textContent,
  hp: E('hpText').textContent,
  kills: parseInt(E('killsVal').textContent || '0', 10),
  score: parseInt(String(E('scoreVal').textContent || '0').replace(/[^\d]/g, ''), 10),
  turns: parseInt(E('turnsVal').textContent || '0', 10),
});
const logs = () => E('logList').children.map(li => li.textContent);

// ---------- run ----------
try {
  vm.createContext(sandbox);
  vm.runInContext('Math.random = ' + rng.toString() + '; Math.random.__isSeeded = true;', sandbox);
  // rng uses outer `seed` closure var name collision: redefine self-contained
  vm.runInContext('Math.random = (function(){ let s = 987654321; return function(){ s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', sandbox);
  vm.runInContext(script, sandbox, { filename: 'game_script.js' });
  check('boot: script loads without error', true);
} catch (err) {
  check('boot: script loads without error', false, String(err && err.stack || err).split('\n').slice(0, 3).join(' / '));
  console.log(JSON.stringify(results));
  process.exit(0);
}

try {
  pump(10);
  check('title screen shown at boot (scrTitle.on)', E('scrTitle').classList.contains('on'));
  check('HUD floor shows B1F at boot', hud().floor === 'B1F', 'floor=' + hud().floor);
  check('HUD HP full at boot (36/36)', hud().hp === '36/36', 'hp=' + hud().hp);

  // start via button
  E('startBtn').click();
  pump(6);
  check('start button starts run (title hidden)', !E('scrTitle').classList.contains('on'));

  // keyboard move: ArrowRight x several, watch turns increase
  const t0 = hud().turns;
  for (let i = 0; i < 6; i++) { key('ArrowRight'); pump(6); }
  check('arrow keys processed (turns increase)', hud().turns > t0, 'turns ' + t0 + '->' + hud().turns);

  // WASD move
  const t1 = hud().turns;
  key('s'); pump(6); key('a'); pump(6); key('w'); pump(6); key('d'); pump(6);
  check('WASD processed (turns increase further)', hud().turns > t1, 'turns ' + t1 + '->' + hud().turns);

  // mobile D-pad button (right), pointerdown/up
  const t2 = hud().turns;
  const rightBtn = dpad.find(b => b.dataset.dir === '1,0');
  check('D-pad buttons exist (4 dirs)', dpad.length === 4, 'count=' + dpad.length);
  rightBtn.dispatch('pointerdown'); rightBtn.dispatch('pointerup'); pump(8);
  check('D-pad button processed (turns increase or queued action ran)', hud().turns > t2, 'turns ' + t2 + '->' + hud().turns);

  // soak test: random play across restarts; observe systems
  const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  let sawKill = hud().kills > 0, sawHurt = false, sawFloor2 = false, sawOver = false, sawPotion = false, sawDescend = false;
  let actions = 0;
  const hpNow = () => parseInt(hud().hp.split('/')[0], 10);
  let minHp = hpNow();
  for (let round = 0; round < 900 && !(sawKill && sawFloor2); round++) {
    key(dirs[(Math.random() * 4) | 0]);
    pump(5);
    actions++;
    const h = hud();
    if (h.kills > 0) sawKill = true;
    if (hpNow() < minHp) { minHp = hpNow(); sawHurt = true; }
    if (h.floor === 'B2F' || h.floor === 'B3F') { sawFloor2 = true; }
    const lg = logs().join(' ');
    if (lg.includes('回復薬を拾った') && lg.includes('HP+')) sawPotion = true;
    if (lg.includes('降り階段') || lg.includes('に到達')) sawDescend = true;
    if (E('scrOver').classList.contains('on')) {
      sawOver = true;
      break;
    }
    if (E('scrWin').classList.contains('on')) { sawFloor2 = true; break; }
  }
  check('combat: at least one kill during soak', sawKill, 'kills=' + hud().kills + ' actions=' + actions);
  check('enemy attacks damage player during soak', sawHurt, 'minHp=' + minHp);
  check('potion pickup observed in log', sawPotion);
  check('descend to B2F (or win/gameover first)', sawFloor2 || sawDescend, 'floor=' + hud().floor + ' over=' + sawOver);
  check('game over screen reached during soak (or still alive)', sawOver || hud().turns > 50, 'over=' + sawOver + ' turns=' + hud().turns);

  // restart via HUD restart button
  E('restartBtn').click();
  pump(30); // let any pending showOver timer fire first if over; then restart state
  if (E('scrOver').classList.contains('on')) { E('ovRestart').click(); pump(6); }
  const h2 = hud();
  check('restart resets floor/turns/HP', h2.floor === 'B1F' && h2.turns === 0 && h2.hp === '36/36', JSON.stringify(h2));

  // play again after restart to confirm still functional
  const t3 = hud().turns;
  key('ArrowDown'); pump(6);
  check('game functional after restart', hud().turns > t3 || E('scrTitle').classList.contains('on') === false, 'turns ' + t3 + '->' + hud().turns);
} catch (err) {
  check('runtime: no exception during play tests', false, String(err && err.stack || err).split('\n').slice(0, 4).join(' / '));
}

const passed = results.filter(r => r.pass).length;
console.log('SUMMARY ' + passed + '/' + results.length + ' passed');
