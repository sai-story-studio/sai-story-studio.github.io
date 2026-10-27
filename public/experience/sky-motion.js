// A quiet, document-anchored sky. Decorative only: no input, network or storage.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touchViewport = matchMedia('(hover: none) and (pointer: coarse)');
const TILE_HEIGHT = 1000;
const pageCanvas = document.getElementById('page-starfield');
const footerSky = document.querySelector('[data-footer-sky]');
const layers = [pageCanvas, ...document.querySelectorAll('[data-sky-stars]')].filter(Boolean).map((canvas, layerIndex) => {
  const context = canvas.getContext('2d');
  const stars = Array.from({ length: layerIndex ? 35 : 31 }, (_, index) => ({
    x: ((index * 0.61803398875 + 0.13) % 1),
    y: ((index * 0.41421356237 + 0.07) % 1),
    size: index % 8 === 0 ? 4 : index % 3 === 0 ? 2.3 : 1.2,
    phase: index * 1.7,
  }));
  const decorations = canvas === pageCanvas ? [
    { kind: 'moon', x: .17, y: .16, size: 20, phase: .4, speed: 1.2, tilt: -.28 },
    { kind: 'moon', x: .73, y: .55, size: 22, phase: 2.8, speed: 1.5, tilt: .2 },
    { kind: 'moon', x: .43, y: .88, size: 18, phase: 5.1, speed: 1.3, tilt: -.42, occasional: true },
    { kind: 'cloud', x: .81, y: .25, size: 32, phase: 1.6, speed: 1.1, tilt: -.06 },
    { kind: 'cloud', x: .31, y: .66, size: 36, phase: 4.2, speed: 1.4, tilt: .04 },
    { kind: 'cloud', x: .57, y: .94, size: 28, phase: 6.3, speed: 1.2, tilt: -.04, occasional: true },
  ] : [];
  const layer = { canvas, context, stars, decorations, layerIndex, width: 0, height: 0,
    dpr: 0, viewportHeight: 0, orientation: null, originTop: 0, visible: true };
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const width = Math.round(box.width);
    if (!width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const isPage = canvas === pageCanvas;
    const mobile = touchViewport.matches || width <= 700;
    const orientation = window.screen?.orientation?.type ?? window.orientation ?? null;
    const viewportHeight = Math.max(1, Math.ceil(window.innerHeight || 0),
      Math.ceil(document.documentElement?.clientHeight || 0),
      mobile ? Math.ceil(window.screen?.height || 0) : 0);
    const height = isPage ? viewportHeight + TILE_HEIGHT * 2 : Math.round(box.height);
    // iOS changes the visible height while its toolbars slide. Keep this
    // document surface and its coordinate system stable until width/orientation
    // really changes; assigning even the same canvas dimensions clears it.
    if (layer.width === width && layer.dpr === dpr
      && (isPage && mobile && layer.orientation === orientation || layer.height === height)) return;
    layer.width = width; layer.height = height; layer.dpr = dpr;
    layer.viewportHeight = viewportHeight; layer.orientation = orientation;
    if (isPage) {
      layer.originTop = pageOrigin();
      canvas.style.position = 'absolute';
      canvas.style.top = `${layer.originTop}px`;
      canvas.style.bottom = 'auto';
      canvas.style.height = `${height}px`;
      canvas.dataset.originTop = String(layer.originTop);
    }
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context?.setTransform(dpr, 0, 0, dpr, 0, 0); draw(layer, elapsed);
  };
  layer.resize = resize;
  return layer;
});
let elapsed = 0, lastTime = 0, frame = 0, scrollFrame = 0, resizeFrame = 0, paused = reduceMotion.matches;
function pageOrigin() {
  return Math.max(0, (Math.floor(Math.max(0, window.scrollY || 0) / TILE_HEIGHT) - 1) * TILE_HEIGHT);
}
function syncPageOrigin() {
  const layer = layers.find((item) => item.canvas === pageCanvas);
  if (!layer || layer.originTop === pageOrigin()) return;
  layer.originTop = pageOrigin();
  layer.canvas.style.top = `${layer.originTop}px`;
  layer.canvas.dataset.originTop = String(layer.originTop);
  draw(layer, elapsed);
}
function onScroll() {
  // The browser scrolls the absolute surface itself. Repaint only when its
  // overscan bucket changes, never for fractional scroll/elastic overscroll.
  const layer = layers.find((item) => item.canvas === pageCanvas);
  if (!layer || layer.originTop === pageOrigin() || scrollFrame || document.hidden) return;
  scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; syncPageOrigin(); });
}
function onViewportResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    for (const layer of layers) layer.resize();
    syncPageOrigin();
  });
}
function pageCloudLayout(tile, cloudIndex) {
  // The retained half-density pattern contains 1, 1, 2, 1 clouds per four
  // absolute document tiles. Cycle those actual clouds through three lanes,
  // rather than correlating their selection with the old horizontal shift.
  const cycleTile = ((tile % 4) + 4) % 4;
  const ordinal = Math.floor(tile / 4) * 5 + [0, 1, 2, 4][cycleTile] + (cloudIndex === 2 ? 1 : 0);
  const lane = ((ordinal % 3) + 3) % 3;
  const group = Math.floor(ordinal / 3);
  const variation = (((group % 3) + 3) % 3 - 1) * .025;
  return { x: [.18, .5, .82][lane] + variation, y: [.88, .28, .64][lane] + (group % 2 ? .025 : -.015) };
}
function drawDecoration(ctx, decoration, x, y, seconds) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(decoration.tilt + Math.sin(seconds * .12 + decoration.phase) * .035);
  ctx.globalAlpha = .44 + .08 * Math.sin(seconds * .3 + decoration.phase);
  ctx.lineWidth = .65;
  ctx.beginPath();
  if (decoration.kind === 'moon') {
    // Two original curved edges form a crescent; no compositing, images or filters.
    const radius = decoration.size / 2;
    ctx.scale(1.18, 1);
    ctx.moveTo(radius * .44, -radius * .9);
    ctx.bezierCurveTo(-radius * .76, -radius * 1.48, -radius * 1.56, radius * .42, -radius * .46, radius * .9);
    ctx.bezierCurveTo(-radius * .12, radius * 1.1, radius * .33, radius * 1.02, radius * .66, radius * .68);
    ctx.bezierCurveTo(-radius * .34, radius * .94, -radius * .78, -radius * .35, radius * .44, -radius * .9);
    ctx.fillStyle = '#d9c19a';
    ctx.strokeStyle = '#b59974';
  } else {
    const unit = decoration.size;
    ctx.moveTo(-unit * .35, unit * .18);
    ctx.bezierCurveTo(-unit * .58, unit * .18, -unit * .55, -unit * .13, -unit * .34, -unit * .13);
    ctx.bezierCurveTo(-unit * .34, -unit * .43, unit * .03, -unit * .47, unit * .13, -unit * .2);
    ctx.bezierCurveTo(unit * .29, -unit * .36, unit * .48, -unit * .2, unit * .42, -unit * .04);
    ctx.bezierCurveTo(unit * .59, unit * .01, unit * .55, unit * .18, unit * .36, unit * .18);
    ctx.closePath();
    ctx.fillStyle = '#c6b2cb';
    ctx.strokeStyle = '#aa94b2';
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function draw(layer, seconds) {
  const { context: ctx, stars, decorations, width, height, layerIndex } = layer;
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  // The clipped surface covers a viewport plus two overscan tiles. Its top is
  // a stable document origin, not a per-frame viewport/scroll compensation.
  const scrollTop = layer.canvas === pageCanvas ? layer.originTop : 0;
  const tileHeight = layerIndex ? height : TILE_HEIGHT;
  const firstTile = layerIndex ? 0 : Math.floor(scrollTop / tileHeight) - 1;
  const lastTile = layerIndex ? 0 : Math.floor((scrollTop + height) / tileHeight) + 1;
  for (let tile = firstTile; tile <= lastTile; tile++) for (const star of stars) {
    const seedX = ((star.x + tile * .371) % 1 + 1) % 1;
    const speed = layerIndex ? (star.size + 1) * 1.15 : 1.15 + star.size * .16;
    const x = (seedX * width + seconds * speed) % (width + 12) - 6;
    const y = tile * tileHeight + star.y * tileHeight + Math.sin(seconds * 0.22 + star.phase) * (layerIndex ? 14 : 6) - scrollTop;
    if (y < -8 || y > height + 8) continue;
    const twinkle = 0.58 + 0.3 * Math.sin(seconds * 1.1 + star.phase);
    ctx.globalAlpha = twinkle * (layerIndex ? 0.8 : 0.65);
    ctx.fillStyle = layerIndex ? '#fff1c3' : star.size > 2 ? '#b29bcf' : '#d8bd9b';
    ctx.beginPath();
    if (star.size > 2) {
      ctx.moveTo(x, y - star.size); ctx.quadraticCurveTo(x + .7, y - .7, x + star.size, y);
      ctx.quadraticCurveTo(x + .7, y + .7, x, y + star.size);
      ctx.quadraticCurveTo(x - .7, y + .7, x - star.size, y);
      ctx.quadraticCurveTo(x - .7, y - .7, x, y - star.size);
    } else ctx.arc(x, y, star.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let tile = firstTile; tile <= lastTile; tile++) for (const [index, decoration] of decorations.entries()) {
    // Half the original marks. Alternate the retained half so neither moons
    // nor clouds disappear over the document; size and motion stay unchanged.
    if (decoration.occasional && Math.abs(tile) % 2) continue;
    if ((index + Math.floor(Math.abs(tile) / 2)) % 2 !== Math.abs(tile) % 2) continue;
    const seedX = ((decoration.x + tile * .271) % 1 + 1) % 1;
    const cloud = decoration.kind === 'cloud' ? pageCloudLayout(tile, index - 3) : null;
    const inset = Math.max(24, decoration.size * .6);
    const x = cloud ? inset + cloud.x * (width - inset * 2) + Math.sin(seconds * .12 + decoration.phase) * 4
      : (seedX * width + seconds * decoration.speed) % (width + 56) - 28;
    const y = tile * tileHeight + (cloud?.y ?? decoration.y) * tileHeight + Math.sin(seconds * .19 + decoration.phase) * 5 - scrollTop;
    if (y < -24 || y > height + 24) continue;
    drawDecoration(ctx, decoration, x, y, seconds);
  }
  ctx.globalAlpha = 1;
}
function tick(now) {
  frame = 0;
  if (paused || document.hidden) { lastTime = 0; return; }
  if (!lastTime || now - lastTime >= 40) {
    elapsed += lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
    lastTime = now;
    for (const layer of layers) if (layer.visible) draw(layer, elapsed);
    if (pageCanvas && pageCanvas.dataset.elapsed !== String(Math.floor(elapsed))) pageCanvas.dataset.elapsed = String(Math.floor(elapsed));
  }
  frame = requestAnimationFrame(tick);
}
function update() {
  if (frame) cancelAnimationFrame(frame);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  frame = 0; lastTime = 0;
  syncPageOrigin();
  for (const layer of layers) if (layer.visible) draw(layer, elapsed);
  if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  if (pageCanvas) pageCanvas.dataset.motion = paused ? 'paused' : 'playing';
  if (footerSky) footerSky.dataset.motion = paused || document.hidden ? 'paused' : 'playing';
}
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) layers.find((layer) => layer.canvas === entry.target)?.resize();
});
const visibilityObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const layer = layers.find((item) => item.canvas === entry.target);
    if (layer) layer.visible = entry.isIntersecting;
  }
});
for (const layer of layers) { layer.resize(); resizeObserver.observe(layer.canvas); visibilityObserver.observe(layer.canvas); }
if (pageCanvas) {
  pageCanvas.dataset.anchor = 'document';
  pageCanvas.dataset.decorations = 'stars moons clouds';
  pageCanvas.dataset.density = '0.5';
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onViewportResize, { passive: true });
window.addEventListener('orientationchange', onViewportResize, { passive: true });
document.addEventListener('visibilitychange', update);
window.addEventListener('sai:motion', (event) => {
  if (typeof event.detail?.paused !== 'boolean') return;
  paused = event.detail.paused; update();
});
reduceMotion.addEventListener('change', () => { paused = reduceMotion.matches || document.getElementById('motion-toggle')?.getAttribute('aria-pressed') === 'true'; update(); });
window.addEventListener('pagehide', () => {
  if (footerSky) footerSky.dataset.motion = 'paused';
  if (frame) cancelAnimationFrame(frame);
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  frame = 0; scrollFrame = 0; resizeFrame = 0; lastTime = 0;
  resizeObserver.disconnect(); visibilityObserver.disconnect();
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  for (const layer of layers) { layer.resize(); resizeObserver.observe(layer.canvas); visibilityObserver.observe(layer.canvas); }
  update();
});
update();
