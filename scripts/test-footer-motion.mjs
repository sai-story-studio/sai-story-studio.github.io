import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';

const html = fs.readFileSync('public/experience/index.html', 'utf8');
assert.match(html, /class="footer-sky" data-footer-sky data-motion="paused" aria-hidden="true"/);
assert.equal((html.match(/class="footer-sky-moon"/g) || []).length, 1);
assert.equal((html.match(/class="footer-sky-clouds"/g) || []).length, 1);
const css = postcss.parse(fs.readFileSync('public/experience/style.css', 'utf8'));
const declarations = (selector, mobile = false) => {
  const values = {};
  css.walkRules(selector, (rule) => {
    const inMobile = rule.parent.type === 'atrule' && rule.parent.params === '(max-width: 700px)';
    if (inMobile !== mobile) return;
    rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
  });
  return values;
};
const desktop = declarations('.site-footer .wordmark');
const mobile = declarations('.site-footer .wordmark', true);
assert.ok(Math.abs(Number.parseFloat(desktop['font-size']) - 82.8 * .95) < .00001);
assert.equal(desktop.top, '10px');
assert.ok(Math.abs(Number.parseFloat(mobile['font-size']) - 80.75 * .95) < .00001);
assert.equal(mobile.top, '5px');
assert.equal(declarations('.site-footer .wordmark > span')['margin'], '-3.13px 0 0');
assert.equal(declarations('.site-footer .wordmark > span', true)['margin-top'], '-2.5125px');
assert.equal(declarations('.footer-sky')['pointer-events'], 'none');
assert.equal(declarations('.footer-sky').overflow, 'hidden');
assert.match(declarations('.footer-sky > span').animation, /8s/);
assert.match(declarations('.footer-sky .footer-sky-clouds').animation, /7s/);
assert.match(declarations('.site-footer .footer-mini').animation, /4\.8s/);
assert.equal(declarations('.site-footer .footer-mini')['animation-play-state'], 'paused');
assert.equal(declarations('.footer-sky[data-motion="playing"] ~ .footer-mini')['animation-play-state'], 'running');

const listeners = new Map();
const mediaListeners = new Map();
const footer = { dataset: {} };
const reduce = { matches: true, addEventListener: (type, fn) => mediaListeners.set(type, fn) };
const document = {
  hidden: false,
  getElementById: () => null,
  querySelector: () => footer,
  querySelectorAll: () => [],
  addEventListener: (type, fn) => listeners.set(type, fn),
};
const window = { scrollY: 0, addEventListener: (type, fn) => listeners.set(type, fn) };
class Observer { observe() {} disconnect() {} }
vm.runInNewContext(fs.readFileSync('public/experience/sky-motion.js', 'utf8'), {
  document, window,
  matchMedia: (query) => query.includes('prefers-reduced-motion') ? reduce : { matches: false },
  ResizeObserver: Observer, IntersectionObserver: Observer,
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
});
assert.equal(footer.dataset.motion, 'paused', 'reduced motion starts still');
listeners.get('sai:motion')({ detail: { paused: false } });
assert.equal(footer.dataset.motion, 'playing', 'explicit play resumes artwork');
listeners.get('sai:motion')({ detail: { paused: true } });
assert.equal(footer.dataset.motion, 'paused', 'shared toggle pauses artwork');
listeners.get('sai:motion')({ detail: { paused: false } });
document.hidden = true;
listeners.get('visibilitychange')();
assert.equal(footer.dataset.motion, 'paused', 'hidden tab pauses artwork');
document.hidden = false;
listeners.get('visibilitychange')();
assert.equal(footer.dataset.motion, 'playing', 'visible tab resumes artwork');
mediaListeners.get('change')();
assert.equal(footer.dataset.motion, 'paused', 'OS reduce-motion change is respected');
listeners.get('sai:motion')({ detail: { paused: false } });
listeners.get('pagehide')();
assert.equal(footer.dataset.motion, 'paused', 'pagehide pauses CSS animation');
listeners.get('pageshow')({ persisted: true });
assert.equal(footer.dataset.motion, 'playing', 'bfcache restore resumes current motion setting');
console.log('PASS footer-only artwork, desktop/mobile logo scaling and spacing, shared pause, reduced-motion, and hidden-tab contracts. No network or personal data used.');
