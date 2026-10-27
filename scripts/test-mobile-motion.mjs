import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Runs the real modules against DOM/Canvas/WebGL boundary mocks. No browser,
// network, environment settings, user records, or provider calls are used.
const experience = new URL('../public/experience/', import.meta.url);
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }

function events() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatchEvent(event) { for (const callback of [...(listeners.get(event.type) || [])]) callback(event); },
    fire(type, detail = {}) { this.dispatchEvent({ type, ...detail }); },
  };
}
function runtime() {
  const frames = new Map(); let nextFrame = 1;
  const reduced = { ...events(), matches: false };
  const coarse = { ...events(), matches: true };
  const window = { ...events(), innerWidth: 390, innerHeight: 730, scrollY: 0,
    devicePixelRatio: 3, screen: { height: 844, orientation: { type: 'portrait-primary' } },
    matchMedia: (query) => query.includes('prefers-reduced') ? reduced : coarse };
  const document = { ...events(), hidden: false, documentElement: { clientHeight: 730 } };
  class Observer {
    static instances = [];
    constructor(callback) { this.callback = callback; this.observations = 0; this.disconnects = 0; Observer.instances.push(this); }
    observe() { this.observations++; }
    disconnect() { this.disconnects++; }
  }
  class IntersectionObserver extends Observer {}
  class ResizeObserver extends Observer {}
  const sandbox = { window, document, matchMedia: window.matchMedia,
    devicePixelRatio: window.devicePixelRatio, ResizeObserver, IntersectionObserver,
    requestAnimationFrame: (callback) => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    CustomEvent: class { constructor(type, values) { this.type = type; Object.assign(this, values); } }, console };
  window.ResizeObserver = ResizeObserver; window.IntersectionObserver = IntersectionObserver;
  vm.createContext(sandbox);
  return { window, document, sandbox, frames, reduced, coarse, Observer,
    flush(now = 1000) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(now)); },
    value(expression) { return vm.runInContext(expression, sandbox); } };
}

function canvas() {
  const state = { width: 300, height: 150, resets: 0, draws: 0, marks: [], strokes: 0 };
  let offset = { x: 0, y: 0 }, point = null;
  const stack = [];
  const context = {
    setTransform() {}, clearRect() { state.draws++; state.marks = []; },
    beginPath() { point = null; }, closePath() {},
    moveTo(x, y) { point ??= { x: x + offset.x, y: y + offset.y }; },
    arc(x, y) { point ??= { x: x + offset.x, y: y + offset.y }; },
    quadraticCurveTo() {}, bezierCurveTo() {}, scale() {}, rotate() {},
    save() { stack.push({ ...offset }); }, restore() { offset = stack.pop(); },
    translate(x, y) { offset = { x: offset.x + x, y: offset.y + y }; },
    fill() { if (point) state.marks.push({ ...point }); }, stroke() { state.strokes++; },
  };
  return { state, style: {}, dataset: {}, box: { width: 390, height: 844 },
    getContext: () => context,
    getBoundingClientRect() { return { ...this.box }; },
    get width() { return state.width; }, set width(value) { state.width = value; state.resets++; },
    get height() { return state.height; }, set height(value) { state.height = value; state.resets++; } };
}

const sky = runtime();
const page = canvas(), hero = canvas(), about = canvas();
hero.box.height = 580; about.box.height = 440;
sky.document.getElementById = (id) => id === 'page-starfield' ? page : null;
sky.document.querySelector = () => null;
sky.document.querySelectorAll = () => [hero, about];
vm.runInContext(fs.readFileSync(new URL('sky-motion.js', experience), 'utf8'), sky.sandbox);
sky.window.fire('sai:motion', { detail: { paused: true } });
equal(page.style.position, 'absolute', 'The sky is a real document surface, not fixed scroll compensation.');
equal(page.style.height, '2844px', 'One viewport plus exactly two overscan tiles.');
equal(page.width, 780, 'The global backing store is capped at DPR 2.');
equal(page.dataset.decorations, 'stars moons clouds', 'All original mark kinds remain available.');
equal(hero.state.strokes, 0, 'Moons/clouds do not enter the local hero sky.');
equal(about.state.strokes, 0, 'Moons/clouds do not enter the local About sky.');
const lanes = [];
const cloudCounts = [];
for (let tile = 0; tile < 12; tile++) {
  let count = 0;
  for (const [index, decoration] of sky.value('layers[0].decorations').entries()) {
    if (decoration.kind !== 'cloud') continue;
    if (decoration.occasional && Math.abs(tile) % 2) continue;
    if ((index + Math.floor(Math.abs(tile) / 2)) % 2 !== Math.abs(tile) % 2) continue;
    const placement = sky.value(`pageCloudLayout(${tile}, ${index - 3})`);
    const lane = placement.x < .34 ? 'left' : placement.x < .67 ? 'center' : 'right';
    lanes.push(lane); count++;
    check(placement.x >= .12 && placement.x <= .87, 'Cloud anchors leave safe horizontal margins.');
    check(placement.y >= .1 && placement.y <= .98, 'Cloud height variations remain in their document tile.');
  }
  cloudCounts.push(count);
}
equal(cloudCounts, [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1], 'The original half-density cloud counts stay unchanged.');
for (let start = 0; start + 3 <= lanes.length; start += 3) {
  equal(lanes.slice(start, start + 3), ['left', 'center', 'right'], 'Successive clouds cover left, center and right instead of clustering.');
}
for (const width of [320, 430, 768, 1280]) for (let tile = -4; tile <= 16; tile++) {
  const placement = sky.value(`pageCloudLayout(${tile}, 0)`);
  for (const seconds of [0, 30, 120, 900]) {
    const x = 24 + placement.x * (width - 48) + Math.sin(seconds * .12 + 1.6) * 4;
    check(x > 20 && x < width - 20, 'Even prolonged motion keeps clouds inside their horizontal lane.');
  }
}
const baseline = { resets: page.state.resets, draws: page.state.draws,
  marks: structuredClone(page.state.marks), elapsed: sky.value('elapsed') };
const skyResize = sky.Observer.instances.find((observer) => observer.constructor.name === 'ResizeObserver');
for (const height of [680, 790, 710, 844, 650, 730]) {
  sky.window.innerHeight = height; sky.document.documentElement.clientHeight = height; page.box.height = height;
  skyResize.callback([{ target: page }, { target: hero }, { target: about }]);
  sky.window.fire('resize'); sky.flush();
  equal(page.state.resets, baseline.resets, 'Toolbar height alone never reallocates the global canvas.');
  equal(page.state.marks, baseline.marks, 'Toolbar height alone never reprojects the background.');
}
for (const scrollY of [-24.5, 0.25, 240.375, 999.9, 1000.1, 1999.75]) {
  sky.window.scrollY = scrollY; sky.window.fire('scroll');
  equal(sky.frames.size, 0, 'Within the overscan bucket scrolling schedules no canvas work.');
  equal(page.style.top, '0px', 'Document surface origin stays unchanged inside its bucket.');
  equal(page.state.draws, baseline.draws, 'No scroll redraw is needed within the stable bucket.');
  equal(sky.value('elapsed'), baseline.elapsed, 'Scrolling never advances the animation clock.');
}
sky.window.scrollY = 2000.25; sky.window.fire('scroll');
sky.window.scrollY = 2010.75; sky.window.fire('scroll');
equal(sky.frames.size, 1, 'Bucket crossing coalesces repeated scroll events into one RAF.');
sky.flush();
equal(page.style.top, '1000px', 'Bucket origins are integral document coordinates.');
equal(page.state.resets, baseline.resets, 'Bucket shifts repaint without reallocating backing memory.');
equal(sky.value('elapsed'), baseline.elapsed, 'A bucket shift does not advance animation time.');
const inOverlap = (marks, origin) => marks.map((mark) => ({ x: mark.x, y: mark.y + origin }))
  .filter((mark) => mark.y > 1060 && mark.y < 2730)
  .map((mark) => `${mark.x.toFixed(5)}:${mark.y.toFixed(5)}`).sort();
const before = inOverlap(baseline.marks, 0), after = inOverlap(page.state.marks, 1000);
check(before.length > 20, 'A meaningful shared slice of the sky is compared.');
equal(after, before, 'Moving top and local draw coordinates together preserves exact world positions.');
page.box.width = 430; sky.window.innerWidth = 430; sky.window.screen.height = 932;
skyResize.callback([{ target: page }]);
equal(page.width, 860, 'A real width change resizes the backing store.');
equal(page.style.height, '2932px', 'A real width change adopts the new stable viewport cover.');
page.box.width = 844; sky.window.innerWidth = 844; sky.window.innerHeight = 390;
sky.document.documentElement.clientHeight = 390; sky.window.screen.height = 390;
sky.window.screen.orientation.type = 'landscape-primary'; sky.window.fire('orientationchange'); sky.flush();
equal(page.width, 1688, 'Landscape width is applied.');
equal(page.style.height, '2390px', 'Orientation changes refresh the stable height.');
sky.window.screen.orientation.type = 'landscape-secondary'; sky.window.screen.height = 410;
sky.window.fire('orientationchange'); sky.flush();
equal(page.style.height, '2410px', 'A genuine orientation change is not mistaken for a toolbar resize.');
sky.window.fire('sai:motion', { detail: { paused: false } });
equal(sky.frames.size, 1, 'Global play resumes one animation loop.');
sky.flush(1000); sky.flush(1050);
check(sky.value('elapsed') > baseline.elapsed, 'Only normal RAF time advances motion.');
sky.document.hidden = true; sky.document.fire('visibilitychange');
equal(sky.frames.size, 0, 'A hidden tab stops animation.');
sky.document.hidden = false; sky.document.fire('visibilitychange');
equal(sky.frames.size, 1, 'A visible tab resumes one loop.');
for (let restore = 0; restore < 2; restore++) {
  sky.window.fire('pagehide'); equal(sky.frames.size, 0, 'Every pagehide cancels all pending frames.');
  sky.window.fire('pageshow', { persisted: true });
  equal(sky.frames.size, 1, 'Repeated bfcache restores resume exactly one animation loop.');
}
equal(skyResize.disconnects, 2, 'Observers disconnect on both bfcache departures, not only the first.');
sky.reduced.matches = true; sky.reduced.fire('change');
equal(sky.frames.size, 0, 'Reduced motion stops the background.');

// The real orbit init/resize lifecycle with mesh creation replaced only at the
// expensive geometry boundary. Layout calculations and event handlers are real.
const orbit = runtime();
const statistics = { sizes: 0, projections: 0, renders: 0, disposals: 0, dpr: 0 };
class Node {
  constructor() { this.position = { set() {} }; this.rotation = { set() {} }; this.scale = { setScalar() {} }; this.environmentRotation = { set() {} }; }
  add() {} lookAt() {} dispose() { statistics.disposals++; }
}
class Mount extends Node {
  constructor() { super(); this.clientWidth = 390; this.clientHeight = 580; this.dataset = {}; this.parentElement = { querySelector: () => ({ getBoundingClientRect: () => ({ top: 235, height: 210 }) }) }; }
  getBoundingClientRect() { return { top: 100, bottom: 100 + this.clientHeight, left: 0, right: this.clientWidth, width: this.clientWidth, height: this.clientHeight }; }
  appendChild() {}
}
class Renderer {
  constructor() { this.domElement = { style: {}, ...events(), setAttribute() {}, remove() {} }; }
  setPixelRatio(value) { statistics.dpr = value; } setClearColor() {}
  setSize() { statistics.sizes++; } render() { statistics.renders++; }
  dispose() { statistics.disposals++; } forceContextLoss() {}
}
class Camera extends Node { updateProjectionMatrix() { statistics.projections++; } }
orbit.sandbox.THREE = { WebGLRenderer: Renderer, Scene: Node, HemisphereLight: Node,
  DirectionalLight: Node, OrthographicCamera: Camera,
  PMREMGenerator: class { fromScene() { return { texture: {}, dispose() {} }; } dispose() {} } };
orbit.sandbox.RoomEnvironment = Node; orbit.sandbox.HTMLElement = Mount;
orbit.sandbox.mount = new Mount(); orbit.sandbox.toggle = { ...events(), textContent: '', attrs: {},
  setAttribute(key, value) { this.attrs[key] = value; } };
orbit.sandbox.mockCreate = () => new Node();
let source = fs.readFileSync(new URL('orbit.js', experience), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export function createCelestialObject', 'function createCelestialObject')
  .replace('export default async function initOrbit', 'async function initOrbit');
source += '\ncreateCelestialObject = globalThis.mockCreate;';
vm.runInContext(source, orbit.sandbox);
const cleanup = await orbit.value('initOrbit({ mount, toggle, reducedMotion: false })');
equal(statistics.sizes, 1, 'The hero allocates its initial surface once.');
equal(statistics.dpr, 1.5, 'The hero retains its original DPR cap.');
const orbitResize = orbit.Observer.instances.find((observer) => observer.constructor.name === 'ResizeObserver');
for (const height of [590, 570, 610, 580]) {
  orbit.sandbox.mount.clientHeight = height; orbit.window.innerHeight = height + 100;
  orbit.window.fire('resize'); orbitResize.callback([]);
}
equal(statistics.sizes, 1, 'Mobile height-only events never reset the hero renderer.');
equal(statistics.projections, 1, 'Mobile height-only events never reproject the hero orbit.');
orbit.sandbox.mount.clientWidth = 430; orbit.window.fire('resize');
equal(statistics.sizes, 2, 'A real hero width change applies.');
orbit.sandbox.mount.clientWidth = 844; orbit.sandbox.mount.clientHeight = 390;
orbit.window.screen.orientation.type = 'landscape-primary'; orbit.window.fire('resize');
equal(statistics.sizes, 3, 'A real hero orientation/width change applies.');
orbit.window.fire('resize'); orbitResize.callback([]);
equal(statistics.sizes, 3, 'Duplicate resize notifications never reset an unchanged hero.');
orbit.coarse.matches = false; orbit.sandbox.mount.clientWidth = 1200;
orbit.sandbox.mount.clientHeight = 700; orbit.window.fire('resize');
orbit.sandbox.mount.clientHeight = 780; orbit.window.fire('resize');
equal(statistics.sizes, 5, 'A desktop height resize still updates responsive hero layout.');
orbit.sandbox.toggle.fire('click');
equal(orbit.sandbox.mount.dataset.motion, 'paused', 'The relocated pause-button hook still works.');
equal(orbit.frames.size, 0, 'The hero pause cancels its RAF.');
orbit.sandbox.toggle.fire('click');
equal(orbit.frames.size, 1, 'The hero resumes one RAF.');
orbit.document.hidden = true; orbit.document.fire('visibilitychange');
equal(orbit.frames.size, 0, 'Hidden hero tabs do not animate.');
orbit.document.hidden = false; orbit.document.fire('visibilitychange');
orbit.reduced.fire('change', { matches: true });
equal(orbit.frames.size, 0, 'The hero still honors reduced motion.');
cleanup(); equal(orbit.frames.size, 0, 'The original cleanup cancels all hero work.');
check(statistics.disposals > 0, 'Hero cleanup still disposes WebGL resources.');

console.log(`PASS ${assertions} mobile-motion assertions: stable document buckets, toolbar height, true resize/orientation, pause, visibility and bfcache.`);
