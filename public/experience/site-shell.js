// Navigation only: no storage, tracking, or network requests.
// Keep one management entrance; task-specific tools live in that dashboard.
for (const host of [document.querySelector('.footer-info'), document.querySelector('.menu-inner')]) {
  if (!host || host.querySelector('a[href="./operators.html"]')) continue;
  const link = document.createElement('a');
  link.href = './operators.html'; link.textContent = '운영자 관리';
  if (host.classList.contains('menu-inner')) link.className = 'menu-admin';
  const participantLink = host.querySelector('a[href="./participants.html"]');
  if (participantLink) participantLink.after(link); else host.append(link);
}
const menuToggle = document.getElementById('menu-toggle');
const menuDialog = document.getElementById('menu-dialog');
const readingForm = document.getElementById('reading-form');
const backToTop = document.getElementById('back-to-top');
const categoryButtons = Array.from(document.querySelectorAll('[data-pick]'));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let scrollLock = null;

function lockPageScroll() {
  if (scrollLock) return;
  const style = document.documentElement.style;
  scrollLock = {
    overflowY: style.getPropertyValue('overflow-y'),
    priority: style.getPropertyPriority('overflow-y'),
    hadMenuClass: document.body.classList.contains('menu-open'),
  };
  style.setProperty('overflow-y', 'hidden');
  document.body.classList.add('menu-open');
}

function unlockPageScroll() {
  if (!scrollLock) return;
  const style = document.documentElement.style;
  if (scrollLock.overflowY) {
    style.setProperty('overflow-y', scrollLock.overflowY, scrollLock.priority);
  } else {
    style.removeProperty('overflow-y');
  }
  if (!scrollLock.hadMenuClass) document.body.classList.remove('menu-open');
  scrollLock = null;
}

function syncMenuState() {
  const open = Boolean(menuDialog?.open);
  menuToggle?.setAttribute('aria-expanded', String(open));
  menuToggle?.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  if (!open) unlockPageScroll();
}

function closeMenu() {
  // Native dialog.close() restores focus to the opening control. Navigation
  // handlers may then move focus to their own destination in the usual way.
  if (menuDialog?.open && typeof menuDialog.close === 'function') menuDialog.close();
  syncMenuState();
}

function syncReadingCategories() {
  const selected = readingForm?.elements.namedItem('mode')?.value;
  for (const button of categoryButtons) {
    const active = Boolean(selected && button.dataset.pick === selected);
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

if (menuToggle && menuDialog && typeof menuDialog.showModal === 'function') {
  menuToggle.addEventListener('click', () => {
    if (menuDialog.open) {
      closeMenu();
      return;
    }
    menuDialog.showModal();
    lockPageScroll();
    syncMenuState();
  });
  menuDialog.querySelectorAll('[data-menu-close]').forEach((button) => {
    button.addEventListener('click', closeMenu);
  });
  menuDialog.addEventListener('click', (event) => {
    // The browser retargets backdrop clicks to the native dialog element.
    if (event.target === menuDialog) closeMenu();
  });
  // Escape keeps the native cancel behavior; close also covers method=dialog.
  menuDialog.addEventListener('close', syncMenuState);
}

document.addEventListener('click', (event) => {
  const control = event.target?.closest?.('[data-pick], a[href]');
  if (!control) return;
  if (control.hasAttribute('data-pick')) {
    // Capture runs before app.js changes the mode or focuses the form. Closing
    // here lets that existing handler scroll and focus outside the modal.
    closeMenu();
    requestAnimationFrame(syncReadingCategories);
  } else if (menuDialog?.contains(control) || control.getAttribute('href')?.startsWith('#')) {
    closeMenu();
    // Keep native anchor navigation, including links in the header and drawer.
  }
}, true);

// Run after app.js's target handler; microtasks scheduled in capture can run
// before target listeners in some browsers, leaving the old tab highlighted.
document.addEventListener('click', (event) => {
  if (event.target?.closest?.('[data-pick]')) syncReadingCategories();
});

readingForm?.addEventListener('change', (event) => {
  if (event.target?.name === 'mode') syncReadingCategories();
});

if (backToTop) {
  backToTop.hidden = false;
  backToTop.addEventListener('click', () => {
    closeMenu();
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  });
}

window.addEventListener('pageshow', () => {
  requestAnimationFrame(() => {
    syncReadingCategories();
    syncMenuState();
  });
});

syncReadingCategories();
syncMenuState();

// The seamless ribbon follows the same global pause control as the 3D scene.
const ribbonTrack = document.querySelector('.ribbon-track');
let ribbonPaused = reducedMotion.matches;
function syncRibbon() {
  if (!ribbonTrack) return;
  ribbonTrack.dataset.motion = ribbonPaused ? 'paused' : 'playing';
  ribbonTrack.style.animationPlayState = ribbonPaused || document.hidden ? 'paused' : 'running';
}
window.addEventListener('sai:motion', (event) => {
  if (typeof event.detail?.paused !== 'boolean') return;
  ribbonPaused = event.detail.paused; syncRibbon();
});
document.addEventListener('visibilitychange', syncRibbon);
reducedMotion.addEventListener('change', (event) => { ribbonPaused = event.matches; syncRibbon(); });
syncRibbon();
