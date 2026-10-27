import { initJoinForm } from './join.js';

const bindings = new WeakMap();
export function initMeetupDialog(doc = globalThis.document, { win = globalThis.window, createForm = initJoinForm } = {}) {
  const dialog = doc?.getElementById?.('meetup-registration');
  if (!dialog || typeof dialog.showModal !== 'function' || !win) return null;
  if (bindings.has(dialog)) return bindings.get(dialog);
  const form = createForm(dialog, { autoLoad: false, isActive: () => dialog.open });
  if (!form) return null;
  const removers = [];
  let opener = null, disposed = false;
  const listen = (node, type, fn) => { node.addEventListener(type, fn); removers.push(() => node.removeEventListener(type, fn)); };
  const lock = (open) => doc.body?.classList.toggle('meetup-dialog-is-open', open);
  const open = (trigger = null) => {
    if (disposed || dialog.open) return false;
    opener = trigger || doc.activeElement;
    try { dialog.showModal(); } catch { return false; }
    lock(true); void form.refresh();
    return true;
  };
  const close = () => { if (dialog.open) dialog.close(); };
  const closed = () => {
    lock(false); form.reset();
    if (win.location.hash === '#meetup-registration') win.history?.replaceState(null, '', '#meetup');
    const parentDialog = opener?.closest?.('dialog');
    const usable = opener && opener.isConnected !== false && !['BODY', 'HTML'].includes(opener.tagName) && (!parentDialog || parentDialog.open);
    const target = usable ? opener : doc.getElementById('open-meetup-registration');
    // Native focus restoration is kept; this also covers hash/legacy entry.
    target?.focus?.({ preventScroll: true });
    opener = null;
  };
  listen(dialog, 'close', closed);
  listen(dialog, 'click', (event) => {
    if (event.target === dialog || event.target?.closest?.('[data-meetup-close]')) close();
  });
  listen(doc, 'click', (event) => {
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const trigger = event.target?.closest?.('[data-meetup-open], a[href="#meetup-registration"], a[href="./join.html"]');
    if (!trigger) return;
    event.preventDefault(); open(trigger);
  });
  listen(win, 'hashchange', () => { if (win.location.hash === '#meetup-registration') open(); });
  listen(win, 'pagehide', () => { close(); form.reset(); lock(false); });
  const controller = { open, close, destroy() {
    if (disposed) return;
    close(); disposed = true;
    for (const remove of removers) remove();
    form.destroy(); lock(false); bindings.delete(dialog);
  } };
  bindings.set(dialog, controller);
  if (win.location.hash === '#meetup-registration') open();
  return controller;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initMeetupDialog(), { once: true });
  else initMeetupDialog();
}
