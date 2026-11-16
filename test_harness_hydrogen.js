// Node DOM-stub harness for Hydrogen's generated dungeon game.
// The game is event-driven (no rAF/timers), so tests dispatch events directly.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/hydrogen_game.html', 'utf8');
const script = fs.readFileSync(__dirname + '/hydrogen_script.js', 'utf8');

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
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
  appendChild(c) {
    if (c && c.tagName === 'FRAGMENT') { for (const ch of [...c.children]) this.appendChild(ch); c.children = []; return c; }
    c.parentNode = this; this.children.push(c); return c;
  }
  prepend(c) { c.parentNode = this; this.children.unshift(c); return c; }
  get lastChild() { return this.children.length ? this.children[this.children.length - 1] : null; }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } }
  addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); }
  removeEventListener() {}
  dispatch(ev, obj) {
    const e = Object.assign({ preventDefault() {}, stopPropagation() {}, target: this, currentTarget: this }, obj || {});
    (this._listeners[ev] || []).slice().forEach(f => f(e));
    return e;
  }
  click() { this.dispatch('click'); }
  querySelector() { return new El('div'); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { width: 640, height: 640, left: 0, top: 0, right: 640, bottom: 640 }; }
  get clientWidth() { return 640; }
  get clientHeight() { return 640; }
  focus() {} blur() {} setAttribute() {} getAttribute() { return null; }
}

const registry = new Map();
const allButtons = [];
{
  const tagRe = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const attrs = m[2];
    const clM = attrs.match(/class="([^"]*)"/);
    const idM = attrs.match(/id="([^"]+)"/);
    if (m[1] === 'button') {
      const b = new El('button');
      if (clM) b.className = clM[1];
      const dx = attrs.match(/data-dx="([^"]+)"/), dy = attrs.match(/data-dy="([^"]+)"/);
      if (dx) b.dataset.dx = dx[1];
      if (dy) b.dataset.dy = dy[1];
      if (idM) { b.id = idM[1]; registry.set(idM[1], b); }
      allButtons.push(b);
      continue;
    }
    if (!idM) continue;
    const elx = new El(m[1], idM[1]);
    if (clM) elx.className = clM[1];
    registry.set(idM[1], elx);
  }
}

const documentStub = {
  getElementById: id => registry.get(id) || null,
  querySelectorAll: sel => {
    const cm = sel.match(/\.([a-zA-Z0-9_-]+)/);
    if (!cm) return [];
    return allButtons.filter(b => b._classes.has(cm[1]));
  },
  querySelector: () => new El('div'),
  createElement: tag => new El(tag),
  createDocumentFragment: () => new El('fragment'),
  addEventListener() {},
  body: new El('body'),
  documentElement: new El('html'),
};

const winListeners = {};
const sandbox = {
  console,
  document: documentStub,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout: (cb) => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: () => 0,
  performance: { now: () => 0 },
  navigator: { userAgent: 'node-harness' },
  location: { href: 'http://localhost/game.html' },
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
  results.push({ name, pass: !!cond });
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}
const E = id => registry.get(id);
function countCells(elx, pred) {
  let n = 0;
  const walk = c => { if (pred(c)) n++; c.children.forEach(walk); };
  walk(elx);
  return n;
}
const boardText = () => E('board').textContent;
const hud = () => ({
  hp: E('hpText').textContent,
  hpNum: parseInt(E('hpText').textContent, 10),
  floor: E('floorText').textContent,
  kills: parseInt(E('killsText').textContent, 10),
  log: E('logBox').textContent,
});

try {
  vm.createContext(sandbox);
  vm.runInContext('Math.random = (function(){ let s = 424242; return function(){ s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();', sandbox);
  vm.runInContext(script, sandbox, { filename: 'hydrogen_script.js' });
  check('boot: script loads without error', true);
} catch (err) {
  check('boot: script loads without error', false, String(err && err.stack || err).split('\n').slice(0, 3).join(' / '));
  console.log(JSON.stringify(results));
  process.exit(0);
}

try {
  check('board renders 100 cells', countCells(E('board'), c => c._classes.has('cell')) === 100,
    'cells=' + countCells(E('board'), c => c._classes.has('cell')));
  check('player/enemies/items/exit on board (🧙x1 👾x3 🧪x2 🚪x1)',
    (boardText().match(/🧙/g) || []).length === 1 &&
    (boardText().match(/👾/g) || []).length === 3 &&
    (boardText().match(/🧪/g) || []).length === 2 &&
    (boardText().match(/🚪/g) || []).length === 1,
    '🧙' + (boardText().match(/🧙/g) || []).length + ' 👾' + (boardText().match(/👾/g) || []).length +
    ' 🧪' + (boardText().match(/🧪/g) || []).length + ' 🚪' + (boardText().match(/🚪/g) || []).length);
  const h0 = hud();
  check('HUD initial: HP 20/20, floor 1/3, kills 0', h0.hp === '20 / 20' && h0.floor === '1 / 3 F' && h0.kills === 0, JSON.stringify(h0));

  // keyboard: board or log must change after arrows
  const snap0 = boardText() + '|' + hud().log;
  for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) key(k);
  check('arrow keys processed (board or log changed)', (boardText() + '|' + hud().log) !== snap0);
  const snap1 = boardText() + '|' + hud().log;
  for (const k of ['d', 's', 'a', 'w']) key(k);
  check('WASD processed (board or log changed)', (boardText() + '|' + hud().log) !== snap1);

  // pad buttons
  const pads = allButtons.filter(b => b._classes.has('pad-btn'));
  check('pad buttons exist (4)', pads.length === 4, 'count=' + pads.length);
  const snap2 = boardText() + '|' + hud().log;
  pads.forEach(b => b.click());
  check('pad buttons processed (board or log changed)', (boardText() + '|' + hud().log) !== snap2);

  // soak: random play; observe systems
  const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  let sawKill = false, sawHurt = false, sawFloor2 = false, sawEnd = false, sawHeal = false, actions = 0;
  let prevKills = hud().kills, prevHp = hud().hpNum;
  for (let i = 0; i < 4000; i++) {
    key(dirs[(Math.random() * 4) | 0]);
    actions++;
    const h = hud();
    if (h.kills > prevKills) sawKill = true;
    if (h.hpNum < prevHp) sawHurt = true;
    if (h.log.includes('回復')) sawHeal = true;
    prevKills = h.kills; prevHp = h.hpNum;
    if (h.floor.startsWith('2') || h.floor.startsWith('3')) sawFloor2 = true;
    if (E('overlay').classList.contains('show')) { sawEnd = true; break; }
  }
  check('combat: at least one kill during soak', sawKill, 'kills=' + hud().kills + ' actions=' + actions);
  check('enemy attacks damage player during soak', sawHurt);
  check('heal item observed in log', sawHeal);
  check('floor 2 reached during soak (or end overlay first)', sawFloor2 || sawEnd, 'floor=' + hud().floor + ' end=' + sawEnd);
  check('end overlay (game over or victory) reached during soak', sawEnd,
    'title=' + (sawEnd ? E('overlayTitle').textContent : '(none)'));

  // restart via overlay or HUD button
  if (E('overlay').classList.contains('show')) E('overlayRestartBtn').click(); else E('restartBtn').click();
  const h2 = hud();
  check('restart resets HP/floor/kills and hides overlay',
    h2.hp === '20 / 20' && h2.floor === '1 / 3 F' && h2.kills === 0 && !E('overlay').classList.contains('show'),
    JSON.stringify(h2));
  const snap3 = boardText() + '|' + hud().log;
  key('ArrowRight'); key('ArrowDown');
  check('game functional after restart', (boardText() + '|' + hud().log) !== snap3);
} catch (err) {
  check('runtime: no exception during play tests', false, String(err && err.stack || err).split('\n').slice(0, 4).join(' / '));
}

const passed = results.filter(r => r.pass).length;
console.log('SUMMARY ' + passed + '/' + results.length + ' passed');
