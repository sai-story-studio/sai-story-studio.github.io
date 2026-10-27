// A modal-local reading aid. No document/page scrolling, requests or storage.
const bindings = new WeakMap();

export function bindDetailNavigation(dialog, options = {}) {
  if (!dialog || typeof dialog.addEventListener !== 'function') return null;
  if (bindings.has(dialog)) return bindings.get(dialog);
  const button = options.button || dialog.querySelector('[data-detail-top]');
  if (!button || typeof button.addEventListener !== 'function') return null;
  const view = options.windowObject || dialog.ownerDocument?.defaultView || globalThis.window;
  const Observer = options.MutationObserverImpl || view?.MutationObserver || globalThis.MutationObserver;
  const threshold = 240;
  let wasOpen = Boolean(dialog.open);
  let disposed = false;

  function reset() {
    button.hidden = true;
    dialog.scrollTop = 0;
  }
  function update() {
    if (disposed) return;
    const open = Boolean(dialog.open);
    if (open !== wasOpen) {
      wasOpen = open;
      reset();
      return;
    }
    button.hidden = !open || dialog.scrollTop < threshold;
  }
  function closed() { wasOpen = false; reset(); }
  function top(event) {
    if (disposed || !dialog.open || button.hidden) return;
    event.preventDefault();
    const reduceMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    dialog.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  // Observe the native `open` attribute instead of wrapping showModal/close.
  const observer = typeof Observer === 'function' ? new Observer(update) : null;
  observer?.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  dialog.addEventListener('scroll', update, { passive: true });
  dialog.addEventListener('toggle', update);
  dialog.addEventListener('close', closed);
  button.addEventListener('click', top);
  view?.addEventListener?.('pagehide', closed);
  reset();
  const controller = {
    reset,
    refresh: update,
    cleanup() {
      if (disposed) return;
      disposed = true; observer?.disconnect();
      dialog.removeEventListener('scroll', update);
      dialog.removeEventListener('toggle', update);
      dialog.removeEventListener('close', closed);
      button.removeEventListener('click', top);
      view?.removeEventListener?.('pagehide', closed);
      reset(); bindings.delete(dialog);
    },
  };
  bindings.set(dialog, controller);
  return controller;
}

export function initDetailNavigation(root = globalThis.document, options = {}) {
  return bindDetailNavigation(root?.querySelector?.('#reading-detail-dialog'), options);
}

if (typeof document !== 'undefined') initDetailNavigation(document);
