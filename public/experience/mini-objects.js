import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCelestialObject } from './orbit.js';

// One offscreen WebGL context draws the actual hero meshes. Each on-page
// canvas receives its transparent frame; sections never own WebGL contexts.
const activeRoots = new WeakMap();
const PRESETS = {
  reading: [
    { kind: 'star', color: '#f5d780', face: {}, x: -0.58, y: 0.12, scale: 0.80, tilt: -0.17 },
    { kind: 'planet', color: '#b3d8c9', ring: '#c7bde3', face: { y: 0.025 }, x: 0.59, y: -0.12, scale: 0.72, tilt: 0.18 },
  ],
  banner: [
    { kind: 'star', color: '#bdb9e1', face: {}, x: -0.58, y: 0.12, scale: 0.78, tilt: -0.2 },
    { kind: 'moon', color: '#f6e4aa', face: { x: -0.265, size: 0.83 }, x: 0.58, y: -0.10, scale: 0.86, tilt: 0.18 },
  ],
  meetup: [
    { kind: 'moon', color: '#f6e4aa', face: { x: -0.265, size: 0.83 }, x: -0.55, y: 0.10, scale: 0.86, tilt: -0.19 },
    { kind: 'planet', color: '#edb3a8', ring: '#b3d8c9', face: { y: 0.025 }, x: 0.59, y: -0.12, scale: 0.72, tilt: 0.15 },
  ],
  footer: [
    { kind: 'star', color: '#f5d780', face: {}, x: 0, y: 0, scale: 0.92, tilt: 0.15 },
  ],
};

export default function initMiniObjects({ root = document,
  toggle = document.getElementById('motion-toggle') } = {}) {
  if (activeRoots.has(root)) return activeRoots.get(root);
  const items = Array.from(root.querySelectorAll('[data-mini-scene]'))
    .filter((mount) => PRESETS[mount.dataset.miniScene])
    .map((mount) => ({ mount, visible: false, canvas: null, scene: null, camera: null,
      context: null, objects: [], width: 0, height: 0 }));
  if (!items.length) return () => {};
  const resources = { geometries: new Set(), materials: new Set() };
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches || toggle?.getAttribute('aria-pressed') === 'true';
  let disposed = false, failed = false, renderer, environmentTarget;
  let rendererWidth = 0, rendererHeight = 0, rendererDpr = 0;
  let frameId = null, lastTimestamp = null, elapsed = 0;
  let intersectionObserver, resizeObserver;

  function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null; lastTimestamp = null;
  }

  function releaseRenderer() {
    items.forEach((item) => {
      if (item.scene) item.scene.environment = null;
      item.canvas?.remove();
      delete item.mount.dataset.miniRenderer;
      delete item.mount.dataset.miniMotion;
    });
    resources.geometries.forEach((geometry) => geometry.dispose());
    resources.materials.forEach((material) => material.dispose());
    resources.geometries.clear(); resources.materials.clear();
    environmentTarget?.dispose();
    environmentTarget = null;
    if (renderer) {
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose(); renderer.forceContextLoss();
      renderer = null;
    }
  }

  function fail() {
    if (failed || disposed) return;
    failed = true; stop(); releaseRenderer();
    intersectionObserver?.disconnect(); resizeObserver?.disconnect();
  }

  function onContextLost(event) { event.preventDefault(); fail(); }

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true,
      powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    try { environmentTarget = pmrem.fromScene(room, 0.05); }
    finally { room.dispose(); pmrem.dispose(); }
  }

  function ensureScene(item) {
    if (item.scene) return;
    ensureRenderer();
    const scene = new THREE.Scene();
    scene.environment = environmentTarget.texture;
    scene.environmentRotation.set(0, 0.4, 0.12);
    scene.add(new THREE.HemisphereLight('#fffaf3', '#c2b5b1', 1.2));
    const key = new THREE.DirectionalLight('#fff8ed', 2.35);
    key.position.set(-3.5, 5, 7); scene.add(key);
    const fill = new THREE.DirectionalLight('#eff8ff', 1.05);
    fill.position.set(4, 0.5, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffe7dc', 1.15);
    rim.position.set(-3, -2, -3); scene.add(rim);
    const camera = new THREE.OrthographicCamera(-2, 2, 1.5, -1.5, 0.1, 30);
    camera.position.set(0, 0, 8); camera.lookAt(0, 0, 0);
    const preset = PRESETS[item.mount.dataset.miniScene];
    item.objects = preset.map((form, index) => {
      const mesh = createCelestialObject({ ...form, seed: 1.31 + index * 2.73 }, resources);
      mesh.scale.setScalar(form.scale); scene.add(mesh);
      return { mesh, ...form, phase: index * 2.3 };
    });
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('A transparent canvas is unavailable.');
    item.scene = scene; item.camera = camera; item.canvas = canvas; item.context = context;
    item.mount.appendChild(canvas);
  }

  function draw(item) {
    const mountWidth = item.mount.clientWidth, mountHeight = item.mount.clientHeight;
    if (!mountWidth || !mountHeight) return;
    const renderScale = Math.min(1, 440 / mountWidth, 340 / mountHeight);
    const width = Math.max(1, Math.round(mountWidth * renderScale));
    const height = Math.max(1, Math.round(mountHeight * renderScale));
    ensureScene(item);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (item.canvas.width !== pixelWidth || item.canvas.height !== pixelHeight) {
      item.canvas.width = pixelWidth; item.canvas.height = pixelHeight;
    }
    const aspect = width / height;
    const single = item.objects.length === 1;
    const viewHeight = Math.max(single ? 1.8 : 2.05, (single ? 1.8 : 2.9) / aspect);
    const viewWidth = viewHeight * aspect;
    Object.assign(item.camera, { left: -viewWidth / 2, right: viewWidth / 2,
      top: viewHeight / 2, bottom: -viewHeight / 2 });
    item.camera.updateProjectionMatrix();
    item.objects.forEach((object) => {
      object.mesh.position.set(object.x,
        object.y + 0.035 * Math.sin(elapsed * 0.55 + object.phase), 0);
      object.mesh.rotation.set(0.12 * Math.sin(elapsed * 0.28 + object.phase),
        0.18 * Math.sin(elapsed * 0.23 + object.phase),
        object.tilt + 0.07 * Math.sin(elapsed * 0.31 + object.phase));
    });
    if (rendererDpr !== dpr) {
      renderer.setPixelRatio(dpr); rendererDpr = dpr;
      rendererWidth = 0; rendererHeight = 0;
    }
    if (rendererWidth !== width || rendererHeight !== height) {
      renderer.setSize(width, height, false);
      rendererWidth = width; rendererHeight = height;
    }
    renderer.render(item.scene, item.camera);
    item.context.clearRect(0, 0, pixelWidth, pixelHeight);
    item.context.drawImage(renderer.domElement, 0, 0, pixelWidth, pixelHeight);
    item.mount.dataset.miniRenderer = 'webgl';
    item.mount.dataset.miniMotion = paused ? 'paused' : 'playing';
  }

  function visibleItems() { return items.filter((item) => item.visible); }
  function mayAnimate() {
    return !disposed && !failed && !paused && !document.hidden && visibleItems().length > 0;
  }

  function redraw() {
    if (disposed || failed || document.hidden) return;
    try { visibleItems().forEach(draw); } catch { fail(); }
  }

  function frame(timestamp) {
    frameId = null;
    if (!mayAnimate()) { lastTimestamp = null; return; }
    if (lastTimestamp === null || timestamp - lastTimestamp >= 1000 / 30) {
      if (lastTimestamp !== null) elapsed += Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp; redraw();
    }
    if (mayAnimate()) frameId = requestAnimationFrame(frame);
  }

  function sync() {
    items.forEach((item) => {
      if (item.canvas) item.mount.dataset.miniMotion = paused ? 'paused' : 'playing';
    });
    if (mayAnimate()) {
      if (frameId === null) frameId = requestAnimationFrame(frame);
    } else stop();
  }

  function onMotion(event) {
    if (typeof event.detail?.paused !== 'boolean') return;
    paused = event.detail.paused; sync();
  }
  function onReducedMotion(event) { if (event.matches) { paused = true; sync(); } }
  function onVisibility() { redraw(); sync(); }
  function measureVisibility() {
    items.forEach((item) => {
      const box = item.mount.getBoundingClientRect();
      item.visible = box.width > 0 && box.height > 0 && box.bottom > 0
        && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
    });
    redraw(); sync();
  }
  function onResize() { redraw(); sync(); }

  function cleanup() {
    if (disposed) return;
    disposed = true; stop();
    intersectionObserver?.disconnect(); resizeObserver?.disconnect();
    window.removeEventListener('sai:motion', onMotion);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', measureVisibility);
    window.removeEventListener('pagehide', cleanup);
    document.removeEventListener('visibilitychange', onVisibility);
    media.removeEventListener('change', onReducedMotion);
    releaseRenderer(); activeRoots.delete(root);
  }
  activeRoots.set(root, cleanup);
  window.addEventListener('sai:motion', onMotion);
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  media.addEventListener('change', onReducedMotion);
  window.addEventListener('pagehide', cleanup, { once: true });
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(onResize);
    items.forEach((item) => resizeObserver.observe(item.mount));
  }
  if ('IntersectionObserver' in window) {
    intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const item = items.find((candidate) => candidate.mount === entry.target);
        if (item) item.visible = entry.isIntersecting;
      });
      redraw(); sync();
    }, { threshold: 0 });
    items.forEach((item) => intersectionObserver.observe(item.mount));
  } else {
    window.addEventListener('scroll', measureVisibility, { passive: true });
    measureVisibility();
  }
  return cleanup;
}

if (typeof document !== 'undefined') {
  initMiniObjects();
  window.addEventListener('pageshow', (event) => { if (event.persisted) initMiniObjects(); });
}
