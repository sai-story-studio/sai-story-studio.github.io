import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/experience/phone-utils.js', import.meta.url), 'utf8');
const { validateOptionalPhone, formatPhoneInput, bindPhoneInput } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const value of ['', '  ', null, undefined]) assert.equal(validateOptionalPhone(value).value, '');
assert.equal(validateOptionalPhone('010-0000-0000').value, '01000000000');
assert.equal(validateOptionalPhone('+82 10 0000 0000').value, '+821000000000');
assert.equal(validateOptionalPhone('+82 (0)10-0000-0000').value, '+821000000000');
for (const value of ['010123', '01100000000', '+1 0000000000', '010-0000-0000abc', '<img>', '010000000000', '++821000000000']) assert.equal(validateOptionalPhone(value).valid, false);

// Frozen pre-formatting validator: display edits must not change any branch,
// normalization, payload-ready value or error text in the established contract.
function legacyValidate(value) {
  const text = String(value ?? '').trim();
  if (!text) return { valid: true, value: '', error: '' };
  if (!/^[+\d\s()-]+$/.test(text)) return { valid: false, value: '', error: '휴대전화는 010 번호 또는 +82 형식으로 입력해 주세요.' };
  let normalized = text.replace(/[\s()-]/g, '');
  if (normalized.startsWith('+82010')) normalized = `+8210${normalized.slice(6)}`;
  if (!/^010\d{8}$/.test(normalized) && !/^\+8210\d{8}$/.test(normalized)) return { valid: false, value: '', error: '휴대전화는 010-0000-0000 또는 +82 10 0000 0000 형식으로 입력해 주세요.' };
  return { valid: true, value: normalized, error: '' };
}
const partials = ['0', '01', '010', '010-1', '010-12', '010-123', '010-1234', '010-1234-5', '010-1234-56', '010-1234-567', '010-1234-5678'];
for (let length = 1; length <= 11; length++) assert.equal(formatPhoneInput('01012345678'.slice(0, length)), partials[length - 1]);
for (const [raw, formatted] of [
  ['010 1234 5678', '010-1234-5678'], ['(010) 1234-5678', '010-1234-5678'],
  ['+', '+'], ['+8', '+8'], ['+82', '+82'], ['+821', '+82 1'], ['+8210', '+82 10'],
  ['+82101', '+82 10-1'], ['+82101234', '+82 10-1234'], ['+821012345678', '+82 10-1234-5678'],
  ['+820', '+82 (0)'], ['+8201', '+82 (0)1'], ['+82010', '+82 (0)10'],
  ['+82 (0)10 1234 5678', '+82 (0)10-1234-5678'],
]) assert.equal(formatPhoneInput(raw), formatted);
const invalid = ['010123456789', '010-1234-56789', '+8210123456789', '+82 (0)10-1234-56789', '+1 01012345678', '+81 1012345678',
  '++821012345678', '01112345678', '+82 11 1234 5678', '01012345678abc', 'abc01012345678', '010😀12345678', '０１０１２３４５６７８',
  '010.1234.5678', '010/1234/5678', '<img>', '01012345678,01000000000', '0'.repeat(500)];
for (const raw of invalid) assert.equal(formatPhoneInput(raw), raw, 'invalid/excess input must remain visible, not be repaired or truncated');
const fixtures = ['', ' ', null, undefined, ...invalid, ...partials, '+82 10 0000 0000', '+82 (0)10-0000-0000'];
for (let length = 0; length <= 16; length++) for (const prefix of ['010', '011', '+8210', '+82010', '+81010']) fixtures.push(prefix + '0'.repeat(length));
for (const raw of fixtures) {
  assert.deepEqual(validateOptionalPhone(raw), legacyValidate(raw));
  assert.deepEqual(validateOptionalPhone(formatPhoneInput(raw)), legacyValidate(raw), 'formatting preserves validation, errors and payload normalization');
  assert.equal(formatPhoneInput(formatPhoneInput(raw)), formatPhoneInput(raw));
}

class PhoneField {
  constructor(value = '') { this.tagName = 'INPUT'; this.type = 'tel'; this.readOnly = false; this.value = value; this.selectionStart = this.selectionEnd = value.length; this.selectionDirection = 'none'; this.listeners = new Map(); }
  addEventListener(type, listener) { const set = this.listeners.get(type) || new Set(); set.add(listener); this.listeners.set(type, set); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  setSelectionRange(start, end, direction = 'none') { this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction; }
  emit(type, detail = {}) { for (const listener of this.listeners.get(type) || []) listener({ isComposing: false, ...detail }); }
  edit(start, end, inserted, inputType = 'insertText', { before = true, key = null, composing = false } = {}) {
    this.setSelectionRange(start, end);
    if (key) this.emit('keydown', { key });
    if (before) this.emit('beforeinput', { inputType, data: inserted, isComposing: composing });
    let first = start, last = end;
    if (first === last && inputType === 'deleteContentBackward') first = Math.max(0, first - 1);
    if (first === last && inputType === 'deleteContentForward') last = Math.min(this.value.length, last + 1);
    this.value = this.value.slice(0, first) + inserted + this.value.slice(last);
    this.setSelectionRange(first + inserted.length, first + inserted.length);
    this.emit('input', { inputType, data: inserted, isComposing: composing });
  }
}
for (const absent of [null, undefined, {}, { tagName: 'SELECT', type: 'tel' }, { tagName: 'INPUT', type: 'email' }, { tagName: 'INPUT', type: 'tel', readOnly: true }]) assert.equal(bindPhoneInput(absent), null);
const typed = new PhoneField(), dispose = bindPhoneInput(typed);
assert.equal(typeof dispose, 'function'); assert.equal(bindPhoneInput(typed), dispose);
for (const digit of '01012345678') { typed.edit(typed.value.length, typed.value.length, digit); assert.equal(typed.selectionStart, typed.value.length); }
assert.equal(typed.value, '010-1234-5678');
for (const [raw, expected] of [['+821012345678', '+82 10-1234-5678'], ['+8201012345678', '+82 (0)10-1234-5678']]) {
  const international = new PhoneField(); bindPhoneInput(international);
  for (const char of raw) { international.edit(international.value.length, international.value.length, char); assert.equal(international.selectionStart, international.value.length); }
  assert.equal(international.value, expected);
}
for (const listeners of typed.listeners.values()) assert.equal(listeners.size, 1, 'binding is idempotent');
dispose(); dispose();
for (const listeners of typed.listeners.values()) assert.equal(listeners.size, 0);
const rebound = bindPhoneInput(typed);
assert.notEqual(rebound, dispose, 'a disposed input can bind again');
dispose(); assert.equal(bindPhoneInput(typed), rebound, 'old cleanup cannot invalidate a later binding');

const pasted = new PhoneField(); bindPhoneInput(pasted);
pasted.edit(0, 0, '01012345678', 'insertFromPaste');
assert.equal(pasted.value, '010-1234-5678'); assert.equal(pasted.selectionStart, 13);
pasted.edit(4, 8, '0000', 'insertReplacementText');
assert.equal(pasted.value, '010-0000-5678'); assert.equal(pasted.selectionStart, 8);
pasted.edit(5, 7, '', 'deleteContentBackward');
assert.equal(pasted.value, '010-0056-78'); assert.equal(pasted.selectionStart, 5);
pasted.edit(0, pasted.value.length, '+82 (0)10 1234 5678', 'insertFromPaste');
assert.equal(pasted.value, '+82 (0)10-1234-5678'); assert.equal(pasted.selectionStart, pasted.value.length);
for (const raw of invalid) { pasted.edit(0, pasted.value.length, raw, 'insertFromPaste'); assert.equal(pasted.value, raw); }

for (const before of [true, false]) {
  const backward = new PhoneField('010-1234-5678'); bindPhoneInput(backward);
  backward.edit(9, 9, '', 'deleteContentBackward', { before, key: 'Backspace' });
  assert.equal(backward.value, '010-1235-678'); assert.equal(backward.selectionStart, 7);
  const forward = new PhoneField('010-1234-5678'); bindPhoneInput(forward);
  forward.edit(8, 8, '', 'deleteContentForward', { before, key: 'Delete' });
  assert.equal(forward.value, '010-1234-678'); assert.equal(forward.selectionStart, 8);
  forward.edit(8, 8, '', 'deleteContentForward', { before, key: 'Delete' });
  assert.equal(forward.value, '010-1234-78'); assert.equal(forward.selectionStart, 8);
  const prefix = new PhoneField('010-1234-5678'); bindPhoneInput(prefix);
  prefix.edit(4, 4, '', 'deleteContentBackward', { before, key: 'Backspace' });
  assert.equal(prefix.value, '011234-5678', 'prefix edits are not silently restored to 010');
}
const invalidDelete = new PhoneField('011-1234-5678'); bindPhoneInput(invalidDelete);
invalidDelete.edit(9, 9, '', 'deleteContentBackward');
assert.equal(invalidDelete.value, '011-12345678', 'unsupported input receives only the actual native deletion');
const mid = new PhoneField('010-1234-5678'); bindPhoneInput(mid);
mid.edit(6, 7, '0'); assert.equal(mid.value, '010-1204-5678'); assert.equal(mid.selectionStart, 7);
mid.setSelectionRange(4, 8, 'backward'); mid.emit('change');
assert.equal(mid.selectionDirection, 'backward');
const selected = new PhoneField('01012345678'); selected.setSelectionRange(3, 7, 'backward'); bindPhoneInput(selected);
assert.equal(selected.value, '010-1234-5678'); assert.equal(selected.selectionStart, 3); assert.equal(selected.selectionEnd, 8); assert.equal(selected.selectionDirection, 'backward');
selected.edit(3, 4, '', 'deleteByCut'); assert.equal(selected.value, '010-1234-5678'); assert.equal(selected.selectionStart, 3, 'removing only a separator never deletes a selected-adjacent digit');
selected.edit(4, 8, '', 'deleteByCut'); assert.equal(selected.value, '010-5678'); assert.equal(selected.selectionStart, 4);
const excessEdit = new PhoneField('010-1234-5678'); bindPhoneInput(excessEdit);
excessEdit.edit(5, 5, '0'); assert.equal(excessEdit.value, '010-10234-5678'); assert.equal(excessEdit.selectionStart, 6);

const ime = new PhoneField(); bindPhoneInput(ime);
ime.emit('compositionstart'); ime.edit(0, 0, '0101', 'insertCompositionText', { composing: true });
assert.equal(ime.value, '0101');
ime.emit('compositionend'); assert.equal(ime.value, '010-1'); assert.equal(ime.selectionStart, 5);
ime.emit('input', { inputType: 'insertFromComposition' }); assert.equal(ime.value, '010-1');
ime.emit('compositionstart'); ime.edit(0, ime.value.length, '가01012345678', 'insertCompositionText', { composing: true });
ime.emit('compositionend'); assert.equal(ime.value, '가01012345678');
const mobile = new PhoneField(); bindPhoneInput(mobile);
mobile.edit(0, 0, '01000000000', 'insertReplacementText'); assert.equal(mobile.value, '010-0000-0000');
mobile.setSelectionRange(null, null); mobile.value = '+821000000000'; mobile.emit('change'); assert.equal(mobile.value, '+82 10-0000-0000');
const unsupportedSelection = new PhoneField(); unsupportedSelection.setSelectionRange = () => { throw new Error('not supported'); }; bindPhoneInput(unsupportedSelection);
unsupportedSelection.value = '01000000000'; unsupportedSelection.emit('input'); assert.equal(unsupportedSelection.value, '010-0000-0000');
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|\.submit\s*\(|requestSubmit\s*\(|dispatchEvent\s*\(/);
const app = await readFile(new URL('../public/experience/app.js', import.meta.url), 'utf8');
const join = await readFile(new URL('../public/experience/join.js', import.meta.url), 'utf8');
assert.ok(app.includes("bindPhoneInput($('reading-phone'))") && join.includes('bindPhoneInput(form.elements.phone)'));
assert.ok(!app.includes('bindPhoneInput(deliveryForm') && !join.includes('bindPhoneInput(deliveryForm'));
assert.ok(join.includes('phone: phone.value') && app.includes('validateOptionalPhone(phoneField?.value)'));
console.log('PASS phone partial/paste/international formatting, invalid/excess preservation, legacy validator parity, caret/range edits, bidirectional separator deletion, IME/mobile, guards/idempotence/cleanup and unchanged payload wiring. Synthetic fixtures only; no network or storage.');
