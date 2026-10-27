// Calendar and 24-hour controls. No network, tracking, or persistent storage.
const pad = (value) => String(value).padStart(2, '0');
const iso = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
export function positionPopover({ anchor, width, height, viewport, gap = 8, padding = 8 }) {
  const viewportLeft = viewport.left || 0, viewportTop = viewport.top || 0;
  const horizontalPadding = Math.min(padding, Math.max(0, viewport.width / 4));
  const verticalPadding = Math.min(padding, Math.max(0, viewport.height / 4));
  const minX = viewportLeft + horizontalPadding, minY = viewportTop + verticalPadding;
  const maxX = viewportLeft + viewport.width - horizontalPadding;
  const maxY = viewportTop + viewport.height - verticalPadding;
  const availableWidth = Math.max(1, maxX - minX), availableHeight = Math.max(1, maxY - minY);
  const popupWidth = Math.max(1, Math.min(width, availableWidth));
  const above = Math.min(availableHeight, Math.max(0, anchor.top - gap - minY));
  const below = Math.min(availableHeight, Math.max(0, maxY - anchor.bottom - gap));
  const placement = height <= below || below >= above ? 'below' : 'above';
  const sideHeight = placement === 'below' ? below : above;
  // If the anchor itself covers the tiny viewport, use the visible viewport
  // as a scrollable fallback instead of creating a zero-height popup.
  const maxHeight = Math.max(1, Math.min(availableHeight, sideHeight || availableHeight));
  const popupHeight = Math.max(1, Math.min(height, maxHeight));
  const desiredTop = placement === 'below' ? anchor.bottom + gap : anchor.top - gap - popupHeight;
  return {
    placement,
    left: Math.max(minX, Math.min(anchor.left, maxX - popupWidth)),
    top: Math.max(minY, Math.min(desiredTop, maxY - popupHeight)),
    width: popupWidth, height: popupHeight, maxHeight,
  };
}
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function calendarMonthInfo(year, month, { calendar = 'solar', leapMonth = false, lunarEngine = globalThis.Lunar, lunarMonthEngine = globalThis.LunarMonth } = {}) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1900 || month < 1 || month > 12) return { valid: false, error: '연도와 월을 확인해 주세요.' };
  if (calendar === 'lunar') {
    try {
      const signedMonth = leapMonth ? -month : month;
      const lunarMonth = lunarMonthEngine?.fromYm(year, signedMonth);
      if (!lunarMonth) return { valid: false, error: '이 연도와 월에는 해당 윤달이 없습니다. 월을 다시 선택하거나 윤달 표시를 확인해 주세요.' };
      const first = lunarEngine.fromYmdHms(year, signedMonth, 1, 12, 0, 0).getSolar();
      return { valid: true, length: lunarMonth.getDayCount(), weekday: first.getWeek(), firstSolarDate: iso(first.getYear(), first.getMonth(), first.getDay()) };
    } catch { return { valid: false, error: '해당 음력 월을 계산할 수 없습니다. 윤달 여부를 확인해 주세요.' }; }
  }
  if (calendar !== 'solar') return { valid: false, error: '달력 기준을 확인해 주세요.' };
  return { valid: true, length: daysInMonth(year, month), weekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), firstSolarDate: iso(year, month, 1) };
}
export function normalizeDateText(text, { min = '1900-01-01', max = new Date().toISOString().slice(0, 10), calendar = 'solar', leapMonth = false, lunarEngine = globalThis.Lunar } = {}) {
  const raw = String(text).trim();
  const formatted = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6)}` : raw;
  const match = /^(\d{4})([.-])(\d{2})\2(\d{2})$/.exec(formatted);
  if (!match) return '';
  const [, y, , m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return '';
  const value = iso(year, month, day);
  if (calendar === 'lunar') {
    if (day > 30 || !lunarEngine?.fromYmdHms) return '';
    try {
      const signedMonth = leapMonth ? -month : month;
      const lunar = lunarEngine.fromYmdHms(year, signedMonth, day, 12, 0, 0);
      const solar = lunar.getSolar();
      const roundTrip = solar.getLunar();
      const converted = iso(solar.getYear(), solar.getMonth(), solar.getDay());
      if (roundTrip.getYear() !== year || roundTrip.getMonth() !== signedMonth || roundTrip.getDay() !== day) return '';
      return converted >= min && converted <= max ? value : '';
    } catch { return ''; }
  }
  if (calendar !== 'solar' || day > daysInMonth(year, month)) return '';
  return value >= min && value <= max ? value : '';
}
export function formatDateInput(text, selectionStart = String(text).length) {
  const raw = String(text);
  // Keep unrecognised text visible and invalid rather than turning arbitrary
  // pasted prose into a different, apparently valid date.
  if (!/^[\d.\-\s]*$/.test(raw)) return { value: raw, caret: selectionStart };
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 8) return { value: raw, caret: selectionStart };
  const before = raw.slice(0, selectionStart).replace(/\D/g, '').length;
  const value = digits.length <= 4 ? digits : digits.length <= 6
    ? `${digits.slice(0, 4)}.${digits.slice(4)}`
    : `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
  let caret = 0, count = 0;
  while (caret < value.length && count < before) {
    if (/\d/.test(value[caret])) count += 1;
    caret += 1;
  }
  return { value, caret };
}
export function validateTimeParts(hour, minute, { required = false } = {}) {
  const h = String(hour).trim(), m = String(minute).trim();
  if (!h && !m) return { valid: !required, value: '', error: required ? '자미두수에는 태어난 시와 분을 입력해 주세요.' : '' };
  if (!/^\d{1,2}$/.test(h) || !/^\d{1,2}$/.test(m) || Number(h) > 23 || Number(m) > 59) {
    return { valid: false, value: '', error: '24시간 기준으로 시는 00~23, 분은 00~59를 모두 입력해 주세요.' };
  }
  return { valid: true, value: `${pad(Number(h))}:${pad(Number(m))}`, error: '' };
}

function initializeDateControls() {
  const form = document.getElementById('reading-form');
  const date = form?.elements.namedItem('birthDate');
  const time = form?.elements.namedItem('birthTime');
  if (!form || !date || !time || form.dataset.dateControls === 'ready') return;
  const oldDateType = date.type, oldTimeType = time.type;
  const oldDateRequired = date.required, oldTimeRequired = time.required;
  const oldDateValue = date.value, oldTimeValue = time.value;
  const created = [];
  let ready = false;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, label) => {
    const node = make('button', className, text);
    node.type = 'button';
    if (label) node.setAttribute('aria-label', label);
    return node;
  };
  try {
    const today = new Date();
    const max = date.max || iso(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const min = date.min || '1900-01-01';
    const maxYear = Number(max.slice(0, 4));
    const dateOptions = () => ({
      min, max,
      calendar: form.elements.namedItem('mode')?.value === 'zodiac' ? 'solar' : form.elements.namedItem('calendar')?.value || 'solar',
      leapMonth: Boolean(form.elements.namedItem('leapMonth')?.checked),
    });
    const initial = normalizeDateText(date.value, dateOptions());
    let viewYear = Number((initial || max).slice(0, 4));
    let viewMonth = Number((initial || max).slice(5, 7));
    let calendarView = 'days';

    const dateControl = make('div', 'date-control');
    const dateRow = make('div', 'date-input-row');
    const display = make('input');
    display.type = 'text'; display.name = 'birthDateDisplay'; display.inputMode = 'numeric';
    display.placeholder = 'YYYY.MM.DD'; display.autocomplete = 'off'; display.maxLength = 10;
    display.required = true; display.value = initial.replaceAll('-', '.');
    display.setAttribute('aria-label', '태어난 날, 연도 네 자리 점 월 두 자리 점 일 두 자리');
    display.setAttribute('aria-describedby', date.getAttribute('aria-describedby') || 'date-help');
    const dateToggle = button('picker-button date-picker-toggle', '달력', '달력에서 날짜 선택');
    const datePopover = make('div', 'date-popover date-picker-popover');
    datePopover.id = 'birth-date-calendar'; datePopover.hidden = true;
    datePopover.setAttribute('role', 'dialog'); datePopover.setAttribute('aria-label', '태어난 날짜 선택');
    dateToggle.setAttribute('aria-controls', datePopover.id); dateToggle.setAttribute('aria-expanded', 'false');
    dateToggle.setAttribute('aria-haspopup', 'dialog');
    const calendarNote = make('small', 'field-help lunar-input-note', '음력 달력입니다. 윤달 선택 상태를 유지하며 실제 존재하는 월과 날짜만 선택할 수 있습니다.');
    calendarNote.hidden = true;
    dateRow.append(display, dateToggle); dateControl.append(dateRow, calendarNote, datePopover);

    const timeControl = make('div', 'time-control');
    const timeRow = make('div', 'time-input-row');
    const timeInput = (name, placeholder, label) => {
      const box = make('label', 'time-input-box');
      box.append(make('span', 'time-input-label', label));
      const input = make('input'); input.type = 'text'; input.name = name;
      input.inputMode = 'numeric'; input.placeholder = placeholder; input.maxLength = 2;
      input.autocomplete = 'off'; input.setAttribute('aria-label', `${label}, 24시간 기준`);
      box.append(input); return { box, input };
    };
    const hourPart = timeInput('birthHourDisplay', 'HH', '시 (00~23)');
    const minutePart = timeInput('birthMinuteDisplay', 'MM', '분 (00~59)');
    const hour = hourPart.input, minute = minutePart.input;
    if (/^\d{2}:\d{2}$/.test(time.value)) [hour.value, minute.value] = time.value.split(':');
    let timeUnknown = false;
    const timeSeparator = make('span', 'time-separator', ':');
    const unknownDisplay = make('div', 'time-unknown-display', '생시 모름');
    unknownDisplay.hidden = true;
    unknownDisplay.setAttribute('role', 'status');
    unknownDisplay.setAttribute('aria-live', 'polite');
    const timeToggle = button('picker-button time-picker-toggle', '시간 선택', '24시간 기준 시간 선택');
    const timeClear = button('time-clear', '생시 모름', '생시 모름으로 선택');
    timeClear.setAttribute('aria-pressed', 'false');
    const timePopover = make('div', 'time-popover time-picker-popover');
    timePopover.id = 'birth-time-picker'; timePopover.hidden = true;
    timePopover.setAttribute('role', 'dialog'); timePopover.setAttribute('aria-label', '24시간 기준 시와 분 선택');
    timeToggle.setAttribute('aria-controls', timePopover.id); timeToggle.setAttribute('aria-expanded', 'false');
    timeToggle.setAttribute('aria-haspopup', 'dialog');
    const timeActions = make('div', 'time-action-row');
    timeActions.append(timeToggle, timeClear);
    timeRow.append(hourPart.box, timeSeparator, minutePart.box, unknownDisplay, timeActions);
    timeControl.append(timeRow, timePopover);

    let positionFrame = 0;
    function positionOpenPopovers() {
      const visual = window.visualViewport;
      const viewport = visual
        ? { left: visual.offsetLeft, top: visual.offsetTop, width: visual.width, height: visual.height }
        : { left: 0, top: 0, width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
      for (const [popup, anchorNode, preferredWidth, minimumWidth] of [[datePopover, dateRow, 360, 260], [timePopover, timeRow, 290, 240]]) {
        if (popup.hidden) continue;
        const anchor = anchorNode.getBoundingClientRect();
        const width = Math.min(preferredWidth, Math.max(minimumWidth, anchor.width), Math.max(1, viewport.width - 16));
        Object.assign(popup.style, {
          position: 'fixed', width: `${width}px`, maxWidth: 'none', boxSizing: 'border-box',
          overflowY: 'auto', overscrollBehavior: 'contain',
        });
        const computed = window.getComputedStyle(popup);
        const borders = (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.borderBottomWidth) || 0);
        const height = Math.max(popup.scrollHeight + borders, popup.getBoundingClientRect().height);
        const layout = positionPopover({ anchor, width, height, viewport });
        popup.style.left = `${layout.left}px`;
        popup.style.top = `${layout.top}px`;
        popup.style.width = `${layout.width}px`;
        popup.style.maxHeight = `${layout.maxHeight}px`;
        popup.dataset.placement = layout.placement;
      }
    }
    function queuePosition() {
      if (positionFrame) return;
      positionFrame = requestAnimationFrame(() => {
        positionFrame = 0;
        if (ready) positionOpenPopovers();
      });
    }
    window.addEventListener('resize', queuePosition, { passive: true });
    window.addEventListener('scroll', queuePosition, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', queuePosition, { passive: true });
    window.visualViewport?.addEventListener('scroll', queuePosition, { passive: true });
    const popupResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(queuePosition) : null;
    for (const node of [dateRow, timeRow, datePopover, timePopover]) popupResizeObserver?.observe(node);

    function closeDate(restoreFocus = false) {
      datePopover.hidden = true; dateToggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) dateToggle.focus({ preventScroll: true });
    }
    function closeTime(restoreFocus = false) {
      timePopover.hidden = true; timeToggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) timeToggle.focus({ preventScroll: true });
    }
    function syncDate(format = false) {
      const value = normalizeDateText(display.value, dateOptions());
      date.value = value;
      display.setCustomValidity(value ? '' : display.value.trim() ? dateOptions().calendar === 'lunar' ? '실제 음력 날짜와 윤달 여부를 확인해 주세요. 양력 환산 날짜는 1900년부터 오늘 사이여야 합니다.' : '1900년부터 오늘까지의 실제 날짜를 YYYY.MM.DD로 입력해 주세요.' : '태어난 날짜를 입력해 주세요.');
      if (value && format) display.value = value.replaceAll('-', '.');
      return Boolean(value);
    }
    function isZiwei() { return form.elements.namedItem('mode')?.value === 'ziwei'; }
    function setTimeUnknown(selected) {
      timeUnknown = Boolean(selected && !isZiwei());
      if (timeUnknown) { hour.value = ''; minute.value = ''; time.value = ''; }
      timeControl.dataset.unknown = String(timeUnknown);
      hourPart.box.hidden = minutePart.box.hidden = timeSeparator.hidden = timeUnknown;
      unknownDisplay.hidden = !timeUnknown;
      timeClear.setAttribute('aria-pressed', String(timeUnknown));
      timeClear.setAttribute('aria-label', timeUnknown ? '생시 모름 선택 해제' : '생시 모름으로 선택');
    }
    function syncCalendarState() {
      const lunar = dateOptions().calendar === 'lunar';
      dateToggle.disabled = false;
      dateToggle.textContent = '달력';
      dateToggle.setAttribute('aria-label', lunar ? '음력 달력에서 날짜 선택' : '양력 달력에서 날짜 선택');
      calendarNote.hidden = !lunar;
      if (!datePopover.hidden) renderCalendar();
      syncDate();
    }
    function syncTime(format = false) {
      // Ziwei cannot retain an unknown-time selection from another method.
      setTimeUnknown(timeUnknown);
      const active = form.elements.namedItem('mode')?.value !== 'zodiac';
      const result = validateTimeParts(hour.value, minute.value, { required: isZiwei() });
      time.value = result.value;
      hour.required = minute.required = isZiwei();
      hour.setCustomValidity(active ? result.error : '');
      minute.setCustomValidity('');
      if (format && result.value) [hour.value, minute.value] = result.value.split(':');
      timeClear.disabled = isZiwei();
      return !active || result.valid;
    }
    function chooseDate(value) {
      display.value = value.replaceAll('-', '.'); syncDate(true);
      date.dispatchEvent(new Event('input', { bubbles: true }));
      date.dispatchEvent(new Event('change', { bubbles: true }));
      closeDate(); display.focus({ preventScroll: true });
    }
    function renderCalendar(focusDate) {
      queuePosition();
      datePopover.replaceChildren();
      const options = dateOptions();
      const lunar = options.calendar === 'lunar';
      const context = lunar ? `음력${options.leapMonth ? ' · 윤달' : ''}` : '양력';
      const info = calendarMonthInfo(viewYear, viewMonth, options);
      datePopover.setAttribute('aria-label', `${context} 태어난 날짜 선택`);
      datePopover.append(make('p', 'field-help calendar-context', context));
      const header = make('div', 'calendar-header picker-header');
      const prev = button('calendar-navigation picker-nav', '‹', '이전 달');
      const next = button('calendar-navigation picker-nav', '›', '다음 달');
      const heading = make('div', 'calendar-heading picker-title');
      const yearButton = button('calendar-year-toggle', `${viewYear}년`, '연도 선택');
      const monthButton = button('calendar-month-toggle', `${viewMonth}월`, '월 선택');
      heading.append(yearButton, monthButton); header.append(prev, heading, next); datePopover.append(header);
      const moveMonth = (offset) => {
        const value = new Date(Date.UTC(viewYear, viewMonth - 1 + offset, 1));
        const year = value.getUTCFullYear(), month = value.getUTCMonth() + 1;
        if (year < 1900 || year > maxYear) return;
        viewYear = year; viewMonth = month; calendarView = 'days'; renderCalendar();
      };
      prev.disabled = viewYear === 1900 && viewMonth === 1;
      next.disabled = viewYear === maxYear && (viewMonth === 12 || (info.valid && info.firstSolarDate >= max));
      prev.addEventListener('click', () => moveMonth(-1)); next.addEventListener('click', () => moveMonth(1));
      yearButton.addEventListener('click', () => { calendarView = calendarView === 'years' ? 'days' : 'years'; renderCalendar(); });
      monthButton.addEventListener('click', () => { calendarView = calendarView === 'months' ? 'days' : 'months'; renderCalendar(); });
      if (calendarView === 'years' || calendarView === 'months') {
        const years = calendarView === 'years';
        const grid = make('div', years ? 'calendar-year-grid picker-year-grid' : 'calendar-month-grid picker-month-grid');
        for (let value = years ? 1900 : 1; value <= (years ? maxYear : 12); value++) {
          const option = button('', `${value}${years ? '년' : '월'}`);
          const selected = value === (years ? viewYear : viewMonth);
          option.classList.toggle('is-selected', selected); option.setAttribute('aria-pressed', String(selected));
          if (!years) {
            const monthInfo = calendarMonthInfo(viewYear, value, options);
            option.disabled = !monthInfo.valid || monthInfo.firstSolarDate > max;
            if (!monthInfo.valid) option.setAttribute('title', monthInfo.error);
          }
          option.addEventListener('click', () => {
            if (years) { viewYear = value; calendarView = 'months'; }
            else { viewMonth = value; calendarView = 'days'; }
            renderCalendar();
          });
          grid.append(option);
        }
        datePopover.append(grid);
        if (!years && Array.from(grid.children).every((option) => option.disabled)) {
          const notice = make('p', 'field-help calendar-empty-message', options.leapMonth ? '이 연도에는 선택할 수 있는 윤달이 없습니다. 다른 연도를 선택하거나 입력창 아래 윤달 표시를 확인해 주세요.' : '이 연도에는 오늘까지 선택할 수 있는 날짜가 없습니다. 다른 연도를 선택해 주세요.');
          notice.setAttribute('role', 'status'); datePopover.append(notice);
        }
        requestAnimationFrame(() => { const selected = grid.querySelector('.is-selected'); selected?.focus({ preventScroll: true }); selected?.scrollIntoView({ block: 'nearest' }); });
        return;
      }
      if (!info.valid) {
        const notice = make('p', 'field-help calendar-empty-message', info.error);
        notice.setAttribute('role', 'status'); datePopover.append(notice); return;
      }
      const weekdays = make('div', 'weekday-grid'); weekdays.setAttribute('aria-hidden', 'true');
      for (const label of ['일', '월', '화', '수', '목', '금', '토']) weekdays.append(make('span', 'calendar-weekday', label));
      const grid = make('div', 'calendar-grid date-grid'); grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', `${context} ${viewYear}년 ${viewMonth}월 날짜`);
      const offset = info.weekday;
      for (let index = 0; index < offset; index++) grid.append(make('span', 'calendar-empty'));
      for (let day = 1; day <= info.length; day++) {
        const value = iso(viewYear, viewMonth, day);
        const dayButton = button('calendar-day', String(day), `${context} ${viewYear}년 ${viewMonth}월 ${day}일`);
        dayButton.dataset.date = value; dayButton.disabled = !normalizeDateText(value, options);
        dayButton.classList.toggle('is-selected', value === date.value);
        const physicalDate = new Date(`${info.firstSolarDate}T00:00:00Z`);
        physicalDate.setUTCDate(physicalDate.getUTCDate() + day - 1);
        const isToday = physicalDate.toISOString().slice(0, 10) === max;
        dayButton.classList.toggle('is-today', isToday);
        dayButton.setAttribute('aria-pressed', String(value === date.value));
        if (isToday) dayButton.setAttribute('aria-current', 'date');
        dayButton.addEventListener('click', () => chooseDate(value));
        dayButton.addEventListener('keydown', (event) => {
          const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
          if (!(event.key in steps) && !['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
          event.preventDefault();
          if (lunar) {
            let year = viewYear, month = viewMonth, targetDay = day;
            const weekday = (offset + day - 1) % 7;
            if (event.key === 'PageUp' || event.key === 'PageDown') month += event.key === 'PageUp' ? -1 : 1;
            else targetDay += event.key === 'Home' ? -weekday : event.key === 'End' ? 6 - weekday : steps[event.key];
            if (targetDay < 1) {
              month -= 1;
              if (month < 1) { year -= 1; month = 12; }
              const previous = calendarMonthInfo(year, month, options);
              if (!previous.valid) return;
              targetDay += previous.length;
            } else if (targetDay > info.length && event.key !== 'PageUp' && event.key !== 'PageDown') { month += 1; targetDay -= info.length; }
            if (month < 1) { year -= 1; month = 12; }
            if (month > 12) { year += 1; month = 1; }
            const targetInfo = calendarMonthInfo(year, month, options);
            if (!targetInfo.valid) return;
            targetDay = Math.min(targetDay, targetInfo.length);
            const target = iso(year, month, targetDay);
            if (!normalizeDateText(target, options)) return;
            viewYear = year; viewMonth = month; renderCalendar(target); return;
          }
          const nextDate = new Date(`${value}T00:00:00Z`);
          if (event.key === 'PageUp' || event.key === 'PageDown') {
            const monthOffset = event.key === 'PageUp' ? -1 : 1;
            nextDate.setUTCDate(1); nextDate.setUTCMonth(nextDate.getUTCMonth() + monthOffset);
            nextDate.setUTCDate(Math.min(day, daysInMonth(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1)));
          } else nextDate.setUTCDate(day + (event.key === 'Home' ? -nextDate.getUTCDay() : event.key === 'End' ? 6 - nextDate.getUTCDay() : steps[event.key]));
          const target = nextDate.toISOString().slice(0, 10);
          if (target < min || target > max) return;
          viewYear = nextDate.getUTCFullYear(); viewMonth = nextDate.getUTCMonth() + 1;
          renderCalendar(target);
        });
        grid.append(dayButton);
      }
      datePopover.append(weekdays, grid);
      if (focusDate) requestAnimationFrame(() => grid.querySelector(`[data-date="${focusDate}"]`)?.focus({ preventScroll: true }));
    }
    function renderTimes() {
      queuePosition();
      timePopover.replaceChildren();
      const columns = make('div', 'time-picker-columns');
      for (const [input, count, label] of [[hour, 24, '시 (24시간)'], [minute, 60, '분']]) {
        const section = make('section', 'time-option-column'); section.append(make('h3', '', label));
        const list = make('div', 'time-options time-picker-list');
        list.setAttribute('role', 'group'); list.setAttribute('aria-label', label);
        for (let value = 0; value < count; value++) {
          const option = button('time-option', pad(value), `${pad(value)}${input === hour ? '시' : '분'}`);
          const selected = input.value !== '' && Number(input.value) === value;
          option.classList.toggle('is-selected', selected); option.setAttribute('aria-pressed', String(selected));
          option.addEventListener('click', () => {
            setTimeUnknown(false);
            input.value = pad(value); syncTime(true);
            if (input === minute && time.value) { closeTime(); minute.focus({ preventScroll: true }); }
            else { renderTimes(); const chosen = timePopover.querySelectorAll('.time-picker-list')[input === hour ? 0 : 1]?.querySelector('.is-selected'); chosen?.focus({ preventScroll: true }); }
          });
          option.addEventListener('keydown', (event) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const target = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : Math.max(0, Math.min(count - 1, value + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1)));
            list.children[target]?.focus();
          });
          list.append(option);
        }
        section.append(list); columns.append(section);
      }
      timePopover.append(columns);
    }
    display.addEventListener('input', (event) => {
      if (event.isComposing) return;
      const formatted = formatDateInput(display.value, display.selectionStart ?? display.value.length);
      if (display.value !== formatted.value) {
        display.value = formatted.value;
        display.setSelectionRange(formatted.caret, formatted.caret);
      }
      syncDate();
    });
    display.addEventListener('blur', () => syncDate(true));
    dateToggle.addEventListener('click', () => {
      if (!datePopover.hidden) { closeDate(); return; }
      closeTime(); const selected = normalizeDateText(display.value, dateOptions());
      if (selected) { viewYear = Number(selected.slice(0, 4)); viewMonth = Number(selected.slice(5, 7)); }
      calendarView = 'days'; datePopover.hidden = false; dateToggle.setAttribute('aria-expanded', 'true');
      renderCalendar(selected || iso(viewYear, viewMonth, 1));
    });
    for (const input of [hour, minute]) {
      input.addEventListener('input', () => { setTimeUnknown(false); syncTime(); });
      input.addEventListener('blur', () => syncTime(true));
      input.addEventListener('paste', (event) => {
        const text = event.clipboardData?.getData('text')?.trim();
        if (!/^\d{1,2}:\d{2}$/.test(text || '')) return;
        event.preventDefault(); setTimeUnknown(false); [hour.value, minute.value] = text.split(':'); syncTime(true);
      });
    }
    timeToggle.addEventListener('click', () => {
      if (!timePopover.hidden) { closeTime(); return; }
      setTimeUnknown(false); syncTime();
      closeDate(); renderTimes(); timePopover.hidden = false; timeToggle.setAttribute('aria-expanded', 'true');
      const first = timePopover.querySelector('.is-selected') || timePopover.querySelector('button');
      first?.focus({ preventScroll: true });
    });
    timeClear.addEventListener('click', () => {
      if (isZiwei()) return;
      setTimeUnknown(!timeUnknown); syncTime(); closeTime();
      if (!timeUnknown) hour.focus({ preventScroll: true });
    });
    document.addEventListener('pointerdown', (event) => {
      if (!ready) return;
      if (!dateControl.contains(event.target)) closeDate();
      if (!timeControl.contains(event.target)) closeTime();
    });
    document.addEventListener('keydown', (event) => {
      if (!ready) return;
      if (event.key !== 'Escape') return;
      if (!datePopover.hidden) { event.preventDefault(); closeDate(true); }
      if (!timePopover.hidden) { event.preventDefault(); closeTime(true); }
    });
    form.addEventListener('change', (event) => {
      if (!ready) return;
      if (event.target?.name === 'mode') syncTime();
      if (['mode', 'calendar', 'leapMonth'].includes(event.target?.name)) syncCalendarState();
    });
    document.addEventListener('click', (event) => {
      if (!ready) return;
      if (event.target?.closest?.('[data-pick]')) requestAnimationFrame(() => { syncTime(); syncCalendarState(); closeDate(); closeTime(); });
    });
    form.addEventListener('submit', (event) => {
      if (!ready) return;
      const dateValid = syncDate(true), timeValid = syncTime(true);
      if (dateValid && timeValid) return;
      event.preventDefault(); event.stopImmediatePropagation();
      (dateValid ? hour : display).reportValidity();
    }, true);
    form.addEventListener('reset', () => { if (!ready) return; requestAnimationFrame(() => {
      setTimeUnknown(false);
      display.value = date.value.replaceAll('-', '.');
      [hour.value, minute.value] = time.value ? time.value.split(':') : ['', ''];
      syncCalendarState(); syncTime(); closeDate(); closeTime();
    }); });
    // Build and bind first. Only then replace the native controls atomically.
    date.after(dateControl); created.push(dateControl);
    time.after(timeControl); created.push(timeControl);
    date.type = 'hidden'; time.type = 'hidden';
    date.required = false; time.required = false;
    syncCalendarState(); syncTime(); form.dataset.dateControls = 'ready'; ready = true;
  } catch (error) {
    created.forEach((node) => node.remove());
    date.type = oldDateType; time.type = oldTimeType;
    date.value = oldDateValue; time.value = oldTimeValue;
    date.required = oldDateRequired; time.required = oldTimeRequired;
    delete form.dataset.dateControls;
    console.warn('Custom date controls unavailable; native controls retained.', error);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeDateControls, { once: true });
  else initializeDateControls();
}
