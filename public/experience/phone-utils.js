// Local display/validation only. This helper never stores, logs, or sends a number.
export function validateOptionalPhone(value) {
  const text = String(value ?? '').trim();
  if (!text) return { valid: true, value: '', error: '' };
  if (!/^[+\d\s()-]+$/.test(text)) return { valid: false, value: '', error: '휴대전화는 010 번호 또는 +82 형식으로 입력해 주세요.' };
  let normalized = text.replace(/[\s()-]/g, '');
  if (normalized.startsWith('+82010')) normalized = `+8210${normalized.slice(6)}`;
  if (!/^010\d{8}$/.test(normalized) && !/^\+8210\d{8}$/.test(normalized)) {
    return { valid: false, value: '', error: '휴대전화는 010-0000-0000 또는 +82 10 0000 0000 형식으로 입력해 주세요.' };
  }
  return { valid: true, value: normalized, error: '' };
}

function supportedPhoneDisplay(raw) {
  if (!/^[+\d\s()-]*$/.test(raw)) return null;
  const compact = raw.replace(/[\s()-]/g, '');
  const groups = (prefix, tail) => prefix + (tail ? `-${tail.slice(0, 4)}${tail.length > 4 ? `-${tail.slice(4)}` : ''}` : '');
  if (/^(?:0|01|010\d{0,8})$/.test(compact)) return groups(compact.slice(0, 3), compact.slice(3));
  if (/^\+(?:8|82)?$/.test(compact)) return compact;
  if (compact.startsWith('+82')) {
    const rest = compact.slice(3);
    if (/^(?:1|10\d{0,8})$/.test(rest)) return groups(`+82 ${rest.slice(0, 2)}`, rest.slice(2));
    if (/^(?:0|01|010\d{0,8})$/.test(rest)) return groups(`+82 (0)${rest.slice(1, 3)}`, rest.slice(3));
  }
  return null;
}

/** Format supported partial inputs without deleting invalid or excess input. */
export function formatPhoneInput(value) {
  const raw = String(value ?? '');
  return supportedPhoneDisplay(raw) ?? raw;
}

const phoneBindings = new WeakMap();
const separator = (char) => Boolean(char && /[\s()-]/.test(char));
const significant = (char) => Boolean(char && /[+\d]/.test(char));
function formattedPosition(raw, formatted, position) {
  if (position === raw.length) return formatted.length;
  const count = [...raw.slice(0, position)].filter(significant).length;
  let seen = 0, index = 0;
  while (index < formatted.length && seen < count) if (significant(formatted[index++])) seen++;
  if (position > 0 && separator(raw[position - 1])) while (separator(formatted[index])) index++;
  return index;
}

/** Keep the native input event and selection; formatting never submits a form. */
export function bindPhoneInput(field) {
  if (!field || field.tagName !== 'INPUT' || !['tel', 'text'].includes(field.type) || field.readOnly
    || typeof field.addEventListener !== 'function' || typeof field.removeEventListener !== 'function') return null;
  if (phoneBindings.has(field)) return phoneBindings.get(field);
  let composing = false, before = null, disposed = false;
  const snapshot = (inputType) => ({ value: field.value, start: field.selectionStart, end: field.selectionEnd, inputType });
  const format = (raw = field.value, start = field.selectionStart, end = field.selectionEnd) => {
    const formatted = formatPhoneInput(raw);
    if (field.value === formatted) return;
    const direction = field.selectionDirection || 'none';
    field.value = formatted;
    if (Number.isInteger(start) && Number.isInteger(end) && typeof field.setSelectionRange === 'function') {
      try { field.setSelectionRange(formattedPosition(raw, formatted, start), formattedPosition(raw, formatted, end), direction); }
      catch { /* Older input implementations may not expose selection APIs. */ }
    }
  };
  const capture = (event) => { before = composing || event.isComposing ? null : snapshot(event.inputType); };
  const keydown = (event) => {
    if (!composing && ['Backspace', 'Delete'].includes(event.key)) before = snapshot(event.key === 'Backspace' ? 'deleteContentBackward' : 'deleteContentForward');
  };
  const input = (event) => {
    if (composing || event.isComposing) { before = null; return; }
    const prior = before; before = null;
    if (prior && prior.start === prior.end && Number.isInteger(prior.start) && supportedPhoneDisplay(prior.value) === prior.value) {
      const backward = (event.inputType || prior.inputType) === 'deleteContentBackward';
      const forward = (event.inputType || prior.inputType) === 'deleteContentForward';
      const removed = backward ? prior.start - 1 : prior.start;
      if ((backward || forward) && separator(prior.value[removed])
        && field.value === prior.value.slice(0, removed) + prior.value.slice(removed + 1)) {
        let digit = removed;
        while (separator(prior.value[digit])) digit += backward ? -1 : 1;
        if (/\d/.test(prior.value[digit] || '')) {
          const first = backward ? digit : prior.start, last = backward ? prior.start : digit + 1;
          format(prior.value.slice(0, first) + prior.value.slice(last), first, first);
          return;
        }
      }
    }
    format();
  };
  const compositionstart = () => { composing = true; before = null; };
  const compositionend = () => { composing = false; before = null; format(); };
  const change = () => { if (!composing) format(); before = null; };
  const blur = () => { before = null; };
  const listeners = { beforeinput: capture, keydown, input, compositionstart, compositionend, change, blur };
  for (const [type, listener] of Object.entries(listeners)) field.addEventListener(type, listener);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const [type, listener] of Object.entries(listeners)) field.removeEventListener(type, listener);
    before = null; composing = false; phoneBindings.delete(field);
  };
  phoneBindings.set(field, dispose);
  format();
  return dispose;
}
