import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/experience/date-controls.js', import.meta.url), 'utf8');
const { normalizeDateText, formatDateInput, validateTimeParts, daysInMonth, calendarMonthInfo, positionPopover } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const limits = { min: '1900-01-01', max: '2026-10-22' };
assert.equal(normalizeDateText('2000.02.29', limits), '2000-02-29');
assert.equal(normalizeDateText('2005-12-23', limits), '2005-12-23');
assert.equal(normalizeDateText('1900.01.01', limits), '1900-01-01');
assert.equal(normalizeDateText('2026.10.22', limits), '2026-10-22');
assert.equal(normalizeDateText('19990922', limits), '1999-09-22');
assert.equal(normalizeDateText('20000229', limits), '2000-02-29');
for (const [raw, formatted] of [['', ''], ['1', '1'], ['1999', '1999'], ['19990', '1999.0'], ['199909', '1999.09'], ['1999092', '1999.09.2'], ['19990922', '1999.09.22'], ['1999-09-22', '1999.09.22'], ['1999.09.22', '1999.09.22']]) {
  assert.deepEqual(formatDateInput(raw), { value: formatted, caret: formatted.length });
}
assert.deepEqual(formatDateInput('19990922', 5), { value: '1999.09.22', caret: 6 });
assert.deepEqual(formatDateInput('1999.09.2', 8), { value: '1999.09.2', caret: 7 });
assert.equal(formatDateInput('<b>19990922</b>').value, '<b>19990922</b>');
assert.equal(formatDateInput('199909222').value, '199909222');
for (const raw of ['19990229', '20000230', '20261023', '19991301', '199909222']) assert.equal(normalizeDateText(raw, limits), '', raw);
for (const input of ['', '2005.02.29', '1900.02.29', '2000.02.30', '2026.10.23', '1899.12.31', '2000.13.01', '2000.00.01', '2000.01.00', '2000.1.01', '2000.01-01', '<b>2000.01.01</b>']) assert.equal(normalizeDateText(input, limits), '', input);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('../public/experience/vendor/lunar.js', import.meta.url), 'utf8'), sandbox);
const lunarOptions = { ...limits, calendar: 'lunar', lunarEngine: sandbox.Lunar, lunarMonthEngine: sandbox.LunarMonth };
assert.equal(normalizeDateText('2020.04.01', { ...lunarOptions, leapMonth: true }), '2020-04-01');
assert.equal(normalizeDateText('2021.04.01', { ...lunarOptions, leapMonth: true }), '');
assert.equal(normalizeDateText('2020.04.30', { ...lunarOptions, leapMonth: true }), '');
assert.equal(normalizeDateText('2000.02.30', lunarOptions), '2000-02-30');
assert.equal(calendarMonthInfo(2000, 2, lunarOptions).length, 30);
assert.equal(calendarMonthInfo(2000, 2, lunarOptions).weekday, sandbox.Lunar.fromYmd(2000, 2, 1).getSolar().getWeek());
const leapApril = calendarMonthInfo(2020, 4, { ...lunarOptions, leapMonth: true });
assert.equal(leapApril.valid, true);
assert.equal(leapApril.length, 29);
assert.equal(leapApril.firstSolarDate, '2020-05-23');
assert.equal(leapApril.weekday, 6);
assert.equal(calendarMonthInfo(2021, 4, { ...lunarOptions, leapMonth: true }).valid, false);
assert.equal(calendarMonthInfo(2020, 3, { ...lunarOptions, leapMonth: true }).valid, false);
assert.equal(daysInMonth(2000, 2), 29);
assert.equal(daysInMonth(1900, 2), 28);
assert.equal(daysInMonth(2026, 4), 30);
assert.deepEqual(validateTimeParts('08', '37'), { valid: true, value: '08:37', error: '' });
assert.equal(validateTimeParts('8', '7').value, '08:07');
assert.equal(validateTimeParts('00', '00').value, '00:00');
assert.equal(validateTimeParts('23', '59').value, '23:59');
assert.equal(validateTimeParts('', '').valid, true);
assert.equal(validateTimeParts('', '', { required: true }).valid, false);
for (const [hour, minute] of [['24', '00'], ['23', '60'], ['08', ''], ['', '37'], ['-1', '30'], ['1e1', '30'], ['오전8', '37']]) assert.equal(validateTimeParts(hour, minute).valid, false, `${hour}:${minute}`);
const viewport = { left: 0, top: 0, width: 1000, height: 710 };
assert.equal(positionPopover({ anchor: { left: 100, top: 433, bottom: 477 }, width: 300, height: 280, viewport }).placement, 'above');
assert.equal(positionPopover({ anchor: { left: 100, top: 120, bottom: 164 }, width: 300, height: 280, viewport }).placement, 'below');
for (const test of [
  { anchor: { left: 280, top: 430, bottom: 478 }, width: 360, height: 350, viewport: { left: 0, top: 0, width: 320, height: 500 } },
  { anchor: { left: -15, top: 65, bottom: 113 }, width: 290, height: 300, viewport: { left: 0, top: 0, width: 280, height: 150 } },
  { anchor: { left: 40, top: 210, bottom: 258 }, width: 360, height: 450, viewport: { left: 30, top: 200, width: 240, height: 180 } },
  { anchor: { left: 100, top: -70, bottom: -22 }, width: 300, height: 280, viewport },
  { anchor: { left: 100, top: 900, bottom: 948 }, width: 300, height: 280, viewport },
]) {
  const box = positionPopover(test);
  assert.ok(box.left >= test.viewport.left && box.top >= test.viewport.top);
  assert.ok(box.left + box.width <= test.viewport.left + test.viewport.width);
  assert.ok(box.top + box.height <= test.viewport.top + test.viewport.height);
  assert.ok(box.maxHeight > 0 && box.maxHeight <= test.viewport.height);
}
console.log('PASS dates, actual lunar month/day fixtures, 24-hour time, and popover flip/clamping for desktop, narrow/short/zoomed viewports and scrolled-offscreen anchors. No DOM, network, storage, or personal data used.');
