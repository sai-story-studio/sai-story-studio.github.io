import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// All the forms below are made here from mathematical surfaces. No image,
// model, texture, or geometry from the reference site is used.
const TAU = Math.PI * 2;

// The largest original form, including its breathing scale and the 1.1 layout
// scale below, stays within 0.82 world units at every rotation. Leave a little
// more room for the curved face marks and antialiasing at the canvas edge.
const LAYOUT_EXTENT = 0.86;
const BOB_EXTENT = 0.065;

function fitOrbit(width, height, logoHeight, centerRatio) {
  const compact = width <= 700;
  const aspect = width / height;
  const edge = Math.min(18, width * 0.035);
  const centerYInPixels = height * centerRatio;
  const clearSpace = Math.max(32,
    Math.min(centerYInPixels, height - centerYInPixels) - logoHeight / 2
      - edge - (compact ? 12 : 16));
  // Size is limited by the space above/below the actual central text block.
  // A tall phone keeps a 9.05-unit width; a wide desktop lets the orbit expand
  // horizontally with the stage instead of collecting in the middle of it.
  const viewHeight = Math.max(6.8, 9.05 / aspect,
    height * 2 * (LAYOUT_EXTENT + BOB_EXTENT) / clearSpace);
  const viewWidth = viewHeight * aspect;
  const pixelsPerUnit = height / viewHeight;
  const centerY = (height / 2 - centerYInPixels) / pixelsPerUnit;
  const edgeInUnits = Math.max(0.18, edge / pixelsPerUnit);
  const maxRadiusY = viewHeight / 2 - Math.abs(centerY)
    - LAYOUT_EXTENT - BOB_EXTENT - edgeInUnits;
  return {
    viewHeight,
    viewWidth,
    radiusX: viewWidth / 2 - LAYOUT_EXTENT - edgeInUnits,
    radiusY: compact ? Math.min(5, maxRadiusY) : maxRadiusY,
    centerY,
    scale: 1.1,
  };
}

function soften(geometry) {
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function planetGeometry(seed = 1) {
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const swell = 1 + 0.018 * Math.sin(x * 3.5 + y * 2.1 + seed);
    positions.setXYZ(
      i,
      x * 0.455 * swell,
      y * 0.445 * (1 + x * 0.035),
      z * 0.425 * (1 + 0.025 * Math.sin(y * 4 + seed)),
    );
  }
  return soften(geometry);
}

function starGeometry() {
  const geometry = new THREE.SphereGeometry(1, 100, 52);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(y, x);
    // Five continuous round tips, with genuine valleys between them. The
    // modulation eases away at the poles so both faces stay pillow-shaped.
    const contour = 0.52 + 0.17 * Math.cos(5 * (angle - Math.PI / 2))
      * Math.pow(Math.max(0, 1 - z * z), 0.35);
    positions.setXYZ(i, x * contour, y * contour,
      z * 0.29 * (1 + 0.025 * Math.sin(x * 3 + y * 2)));
  }
  return soften(geometry);
}

function moonGeometry() {
  const segments = 84;
  const sides = 28;
  const positions = [];
  const indices = [];
  // A tapered, closed sweep: the crescent is curved through its whole
  // thickness, including its soft tips, rather than a flat extruded icon.
  for (let segment = 0; segment <= segments; segment += 1) {
    const t = segment / segments;
    const angle = Math.PI * 0.24 + t * Math.PI * 1.52;
    const radius = 0.415 + 0.009 * Math.sin(t * Math.PI);
    const thickness = 0.205 * Math.sqrt(Math.max(0, Math.sin(t * Math.PI)));
    for (let side = 0; side <= sides; side += 1) {
      const around = side / sides * TAU;
      const radial = radius + thickness * Math.cos(around);
      positions.push(radial * Math.cos(angle) + 0.15,
        radial * Math.sin(angle), thickness * 0.94 * Math.sin(around));
      if (segment < segments && side < sides) {
        const p = segment * (sides + 1) + side;
        indices.push(p, p + sides + 1, p + 1,
          p + 1, p + sides + 1, p + sides + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return soften(geometry);
}

function ringGeometry() {
  const geometry = new THREE.TorusGeometry(0.365, 0.155, 28, 84);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(y, x);
    const swell = 1 + 0.035 * Math.cos(angle * 3 + 0.35);
    positions.setXYZ(i, x * swell, y * swell, z + 0.025 * Math.sin(angle * 2));
  }
  return soften(geometry);
}

function addGlazeColors(geometry, hex, seed) {
  const base = new THREE.Color(hex);
  const cream = new THREE.Color('#fff9ed');
  const color = new THREE.Color();
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const wave = Math.sin(x * 4.1 + seed) * Math.sin(y * 3.4 - seed * 0.6)
      + 0.45 * Math.sin(z * 5.3 + x * 2.2 + seed);
    const glaze = 0.055 + 0.085 * (0.5 + 0.5 * Math.sin(x * 3 + y * 2 + wave));
    color.copy(base).lerp(cream, glaze);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function ceramicMaterial(seed) {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    metalness: 0,
    roughness: 0.25,
    clearcoat: 0.97,
    clearcoatRoughness: 0.14,
    ior: 1.46,
    envMapIntensity: 0.8,
    sheen: 0.06,
    sheenColor: new THREE.Color('#fff7ef'),
    sheenRoughness: 0.5,
    dithering: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ceramicSeed = { value: seed };
    shader.vertexShader = shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vCeramicPosition;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvCeramicPosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vCeramicPosition;
      uniform float ceramicSeed;
      float ceramicHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.17, 0.31, 0.73));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float ceramicNoise(vec3 p) {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(ceramicHash(cell), ceramicHash(cell + vec3(1,0,0)), f.x),
              mix(ceramicHash(cell + vec3(0,1,0)), ceramicHash(cell + vec3(1,1,0)), f.x), f.y),
          mix(mix(ceramicHash(cell + vec3(0,0,1)), ceramicHash(cell + vec3(1,0,1)), f.x),
              mix(ceramicHash(cell + vec3(0,1,1)), ceramicHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
      }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float ceramicCloud = ceramicNoise(vCeramicPosition * 5.2 + ceramicSeed);
      float ceramicGrain = ceramicNoise(vCeramicPosition * 145.0 + ceramicSeed);
      diffuseColor.rgb *= 0.972 + ceramicCloud * 0.041;
      diffuseColor.rgb *= 1.0 - smoothstep(0.78, 0.96, ceramicGrain) * 0.027;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (ceramicCloud - 0.5) * 0.065, 0.2, 0.37);
    `);
  };
  material.customProgramCacheKey = () => 'original-celestial-ceramic-glaze-1';
  return material;
}

// Both the large orbit and the small section scenes use these exact meshes,
// glaze shaders, and face marks. The caller owns and disposes the resources.
export function createCelestialObject(form, resources) {
  const { geometries, materials } = resources;
  const seed = form.seed ?? 1.31;
  const makers = { star: starGeometry, moon: moonGeometry,
    planet: () => planetGeometry(seed), ring: ringGeometry };
  const make = form.make || makers[form.kind];
  if (!make) throw new Error('Unknown celestial form.');
  function glazedMesh(geometry, color, materialSeed) {
    addGlazeColors(geometry, color, materialSeed);
    geometries.add(geometry);
    const material = ceramicMaterial(materialSeed);
    materials.add(material);
    return new THREE.Mesh(geometry, material);
  }
  const body = glazedMesh(make(), form.color || '#f5d780', seed);
  const group = new THREE.Group();
  group.add(body);
  if (form.ring) {
    const band = glazedMesh(new THREE.TorusGeometry(0.635, 0.071, 20, 88),
      form.ring, seed + 0.72);
    band.rotation.set(1.12, -0.12, 0.16);
    group.add(band);
  }
  if (form.face) {
    if (!resources.faceAssets) {
      const ink = new THREE.MeshPhysicalMaterial({
        color: '#76524e', roughness: 0.38, clearcoat: 0.65, metalness: 0,
      });
      const blush = new THREE.MeshPhysicalMaterial({
        color: '#ed9c98', roughness: 0.42, clearcoat: 0.55, metalness: 0,
      });
      const dots = new THREE.SphereGeometry(1, 18, 12);
      materials.add(ink); materials.add(blush); geometries.add(dots);
      resources.faceAssets = { ink, blush, dots };
    }
    const { ink, blush, dots } = resources.faceAssets;
    const { x = 0, y = 0, size = 1 } = form.face;
    body.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, 0, -1);
    function surfaceZ(px, py) {
      ray.set(new THREE.Vector3(px, py, 2), direction);
      return ray.intersectObject(body, false)[0]?.point.z;
    }
    function dot(dx, dy, sx, sy, sz, material) {
      const px = x + dx * size, py = y + dy * size;
      const z = surfaceZ(px, py);
      if (z === undefined) return;
      const mark = new THREE.Mesh(dots, material);
      mark.position.set(px, py, z + 0.009 * size);
      mark.scale.set(sx * size, sy * size, sz * size);
      body.add(mark);
    }
    dot(-0.085, 0.038, 0.022, 0.031, 0.015, ink);
    dot(0.085, 0.038, 0.022, 0.031, 0.015, ink);
    dot(-0.151, -0.035, 0.044, 0.026, 0.011, blush);
    dot(0.151, -0.035, 0.044, 0.026, 0.011, blush);
    const smilePoints = [
      [-0.057, -0.029], [-0.031, -0.059], [0, -0.069],
      [0.031, -0.059], [0.057, -0.029],
    ].map(([dx, dy]) => {
      const px = x + dx * size, py = y + dy * size;
      const z = surfaceZ(px, py);
      return z === undefined ? null : new THREE.Vector3(px, py, z + 0.013 * size);
    });
    if (smilePoints.every(Boolean)) {
      const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePoints),
        20, 0.011 * size, 8, false);
      geometries.add(geometry);
      body.add(new THREE.Mesh(geometry, ink));
    }
  }
  return group;
}

export default async function initOrbit({ mount, toggle, reducedMotion } = {}) {
  if (!(mount instanceof HTMLElement)) throw new Error('The orbit mount is missing.');

  let renderer;
  let scene;
  let environment;
  let environmentTarget;
  let intersectionObserver;
  let resizeObserver;
  let mediaQuery;
  let mediaHandler;
  let visibilityHandler;
  let resizeHandler;
  let toggleHandler;
  let animationFrame = null;
  let previousTimestamp = null;
  let disposed = false;
  let elapsed = 0;
  const geometries = new Set();
  const materials = new Set();
  const initiallyReduced = typeof reducedMotion === 'boolean'
    ? reducedMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = initiallyReduced;
  const bounds = mount.getBoundingClientRect();
  let inView = bounds.bottom > 0 && bounds.top < window.innerHeight
    && bounds.right > 0 && bounds.left < window.innerWidth;

  function stop() {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    previousTimestamp = null;
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    stop();
    intersectionObserver?.disconnect();
    resizeObserver?.disconnect();
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    if (toggleHandler && toggle) toggle.removeEventListener('click', toggleHandler);
    if (mediaHandler && mediaQuery) mediaQuery.removeEventListener('change', mediaHandler);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    if (scene) scene.environment = null;
    environmentTarget?.dispose();
    if (renderer) {
      renderer.domElement.remove();
      renderer.dispose();
      renderer.forceContextLoss();
    }
    delete mount.dataset.renderer;
    delete mount.dataset.motion;
  }

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
    mount.appendChild(canvas);

    scene = new THREE.Scene();
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      environmentTarget = pmrem.fromScene(room, 0.05);
      environment = environmentTarget.texture;
      scene.environment = environment;
      scene.environmentRotation.set(0, 0.4, 0.12);
    } finally {
      room.dispose();
      pmrem.dispose();
    }

    scene.add(new THREE.HemisphereLight('#fffaf3', '#c2b5b1', 1.2));
    const key = new THREE.DirectionalLight('#fff8ed', 2.35);
    key.position.set(-3.5, 5, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#eff8ff', 1.05);
    fill.position.set(4, 0.5, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffe7dc', 1.15);
    rim.position.set(-3, -2, -3);
    scene.add(rim);

    const camera = new THREE.OrthographicCamera(-4.6, 4.6, 3, -3, 0.1, 40);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    const charmResources = { geometries, materials };
    const forms = [
      { make: starGeometry, color: '#f5d780', scale: 1.02, rotation: [0.14, -0.18, -0.19], spin: 0.095, face: {} },
      { make: moonGeometry, color: '#f6e4aa', scale: 1.05, rotation: [-0.09, 0.14, -0.23], spin: -0.075, face: { x: -0.265, size: 0.83 } },
      { make: () => planetGeometry(2), color: '#edb3a8', scale: 0.98, rotation: [0.10, -0.16, 0.15], spin: 0.08, ring: '#c7bde3', face: { y: 0.025 } },
      { make: ringGeometry, color: '#add6c8', scale: 0.96, rotation: [0.42, 0.28, -0.28], spin: -0.10 },
      { make: starGeometry, color: '#bdb9e1', scale: 0.94, rotation: [0.17, 0.21, 0.24], spin: 0.085 },
      { make: moonGeometry, color: '#eec1b4', scale: 0.98, rotation: [-0.12, -0.18, 0.38], spin: -0.09 },
      { make: () => planetGeometry(5), color: '#b3d8c9', scale: 1.00, rotation: [0.10, 0.15, -0.18], spin: 0.10, ring: '#f4da8f', face: { y: 0.025 } },
      { make: starGeometry, color: '#f2c6ae', scale: 0.87, rotation: [-0.17, -0.20, -0.24], spin: -0.075, face: { size: 0.92 } },
    ];
    const objects = forms.map((form, index) => {
      const seed = 1.31 + index * 2.73;
      const mesh = createCelestialObject({ ...form, seed }, charmResources);
      scene.add(mesh);
      return { mesh, ...form, phase: index * TAU / forms.length + 0.12 };
    });
    let orbit = { radiusX: 3.43, radiusY: 1.99, centerY: 0, scale: 1.1 };
    let layoutWidth = 0, layoutHeight = 0, layoutDpr = 0;
    let layoutOrientation = null;
    const touchViewport = window.matchMedia('(hover: none) and (pointer: coarse)');

    function updateObjects(time) {
      objects.forEach((object, index) => {
        const angle = object.phase + time * 0.13;
        const bob = BOB_EXTENT * Math.sin(time * 0.68 + object.phase * 2);
        object.mesh.position.set(
          orbit.radiusX * Math.cos(angle),
          orbit.centerY + orbit.radiusY * Math.sin(angle) + bob,
          0.45 * Math.sin(angle + 0.55),
        );
        object.mesh.rotation.set(
          object.rotation[0] + 0.13 * Math.sin(time * 0.31 + index),
          object.rotation[1] + (object.face
            ? 0.24 * Math.sin(time * object.spin + index * 0.5)
            : time * object.spin),
          object.rotation[2] + 0.14 * Math.sin(time * 0.38 + index * 1.7),
        );
        object.mesh.scale.setScalar(object.scale * orbit.scale * (1 + 0.026 * Math.sin(angle + 0.4)));
      });
    }

    function render() {
      if (disposed) return;
      renderer.render(scene, camera);
      mount.dataset.renderer = 'webgl';
    }

    function resize() {
      if (disposed) return;
      const width = Math.max(1, Math.round(mount.clientWidth));
      const height = Math.max(1, Math.round(mount.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const orientation = window.screen?.orientation?.type ?? window.orientation ?? null;
      const mobile = touchViewport.matches || width <= 700;
      if (layoutWidth === width && layoutDpr === dpr && layoutOrientation === orientation
        && (layoutHeight === height || mobile)) return;
      layoutWidth = width; layoutHeight = height; layoutDpr = dpr;
      layoutOrientation = orientation;
      const compact = width <= 700;
      const logoBounds = mount.parentElement?.querySelector('.orbit-logo')?.getBoundingClientRect();
      const mountBounds = mount.getBoundingClientRect();
      const logoHeight = logoBounds?.height || (compact ? (width <= 370 ? 170 : 190) : 270);
      const centerRatio = logoBounds?.height
        ? (logoBounds.top - mountBounds.top + logoBounds.height / 2) / height
        : compact ? 0.46 : 0.47;
      orbit = fitOrbit(width, height, logoHeight, centerRatio);
      const { viewHeight, viewWidth } = orbit;
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      // Initial elapsed is zero; later resizes preserve the current phase,
      // including a paused scene, while applying the new responsive orbit.
      updateObjects(elapsed);
      if (inView && !document.hidden) render();
    }

    function mayAnimate() {
      return !disposed && !paused && inView && !document.hidden;
    }

    function frame(timestamp) {
      animationFrame = null;
      if (!mayAnimate()) {
        previousTimestamp = null;
        return;
      }
      if (previousTimestamp !== null) {
        elapsed += Math.min((timestamp - previousTimestamp) / 1000, 0.05);
      }
      previousTimestamp = timestamp;
      updateObjects(elapsed);
      render();
      animationFrame = requestAnimationFrame(frame);
    }

    function syncMotion() {
      mount.dataset.motion = paused ? 'paused' : 'playing';
      window.dispatchEvent(new CustomEvent('sai:motion', { detail: { paused } }));
      if (toggle) {
        toggle.textContent = paused ? '움직임 재생' : '움직임 멈추기';
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.setAttribute('aria-label', paused ? '전체 배경과 오브젝트 움직임 재생' : '전체 배경과 오브젝트 움직임 멈추기');
      }
      if (mayAnimate()) {
        if (animationFrame === null) {
          previousTimestamp = null;
          animationFrame = requestAnimationFrame(frame);
        }
      } else {
        stop();
      }
    }

    resize();
    // A single initial draw verifies the WebGL pipeline for the caller. The
    // loop itself is only active when the stage is visible and motion is on.
    render();

    toggleHandler = () => {
      paused = !paused;
      syncMotion();
    };
    toggle?.addEventListener('click', toggleHandler);
    visibilityHandler = () => syncMotion();
    document.addEventListener('visibilitychange', visibilityHandler);
    resizeHandler = () => resize();
    window.addEventListener('resize', resizeHandler, { passive: true });

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
    }
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver((entries) => {
        inView = entries[0]?.isIntersecting ?? false;
        if (inView && !document.hidden) render();
        syncMotion();
      }, { threshold: 0 });
      intersectionObserver.observe(mount);
    }
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaHandler = (event) => {
      if (event.matches) {
        paused = true;
        syncMotion();
      }
    };
    mediaQuery.addEventListener('change', mediaHandler);
    syncMotion();

    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}
