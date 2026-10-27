import { validateOptionalPhone, bindPhoneInput } from './phone-utils.js';
import { normalizeDateText, formatDateInput } from './date-controls.js';
import { publicApiFetch } from './api-client.js';

// Independent signup: no reading-form, URL data, analytics or persistent storage.
const bindings = new WeakMap();
function todayISO() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (key) => parts.find((part) => part.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const text = (value) => typeof value === 'string' ? value.trim() : '';
export function initJoinForm(root, { fetchImpl = publicApiFetch, today = todayISO, autoLoad = true, isActive = () => true } = {}) {
  const $ = (id) => root?.querySelector?.(`#${id}`);
  const form = $('join-form');
  if (!form) return null;
  if (bindings.has(form)) return bindings.get(form);
  const ids = ['join-fields', 'join-birth-field', 'join-message', 'refresh-join-state', 'join-state', 'join-purpose', 'join-consent-purpose', 'join-operator', 'join-contact', 'join-retention', 'join-entry', 'join-success', 'join-success-title'];
  if (ids.some((id) => !$(id)) || ['name', 'phone', 'topic', 'birthDate', 'storeBirthData', 'collectionConsent', 'ageConfirm14'].some((key) => !form.elements[key])) return null;
  const unbindPhone = bindPhoneInput(form.elements.phone);
  const fields = $('join-fields'), birth = form.elements.birthDate;
  let settings = null, enabled = false, pending = false, completed = false, disposed = false, sequence = 0, generation = 0, configRequest = null;
  const listeners = [];
  const listen = (node, type, fn) => { node.addEventListener(type, fn); listeners.push(() => node.removeEventListener(type, fn)); };
  const message = (value, error = false) => { $('join-message').textContent = value; $('join-message').classList.toggle('error', error); };
  function syncBirthChoice() {
    const selected = form.elements.storeBirthData.checked;
    $('join-birth-field').hidden = !selected;
    birth.disabled = !selected;
    birth.required = selected;
    if (!selected) { birth.value = ''; birth.setCustomValidity(''); }
  }
  async function readJson(path, options = {}) {
    const response = await fetchImpl(path, { cache: 'no-store', credentials: 'same-origin', ...options });
    let data;
    try { data = await response.json(); } catch { throw new Error('서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    if (!response.ok) throw new Error(data?.error?.message || '신청을 처리하지 못했습니다.');
    return data;
  }
  async function loadSettings() {
    if (disposed || pending || completed) return false;
    const requestSequence = ++sequence;
    configRequest?.abort(); configRequest = new AbortController();
    enabled = false; settings = null; fields.disabled = true;
    $('refresh-join-state').disabled = true;
    $('join-state').textContent = '운영 준비 상태를 확인하고 있습니다.';
    $('join-state').classList.remove('is-ready');
    try {
      const participant = await readJson('/api/participants/config', { signal: configRequest.signal });
      if (disposed || requestSequence !== sequence) return false;
      settings = participant;
      enabled = participant.collectionEnabled === true && ['operatorName', 'contactEmail', 'consentVersion', 'purpose'].every((key) => text(participant[key]))
        && Number.isInteger(participant.retentionDays) && participant.retentionDays > 0;
      $('join-purpose').textContent = text(participant.purpose) || '일반 모임 참가 관심 신청 및 안내';
      $('join-consent-purpose').textContent = text(participant.purpose) || '일반 모임 참가 관심 신청 및 안내';
      $('join-operator').textContent = text(participant.operatorName) || '설정 전 — 현재 수집하지 않음';
      $('join-contact').textContent = text(participant.contactEmail) || '설정 전';
      $('join-retention').textContent = Number.isInteger(participant.retentionDays) && participant.retentionDays > 0
        ? `신청일로부터 ${participant.retentionDays}일이 보관기간입니다. 운영자가 기간 내 정리하며, 만료 기록은 관련 서비스의 다음 접근 시 삭제됩니다. 별도 정기 자동 정리는 설정하지 않았습니다. 즉시 삭제는 위 문의처로 요청해 주세요.`
        : '운영 전 보관기간 설정이 필요합니다.';
      $('join-state').textContent = enabled ? '모임 관심 신청을 받고 있습니다. 안내를 확인한 뒤 동의한 항목만 보내 주세요.'
        : '지금은 운영 준비 중입니다. 운영자 정보·문의처·보관기간·모임 안내·DB 설정이 준비되기 전에는 이름과 연락처를 받지 않습니다.';
      $('join-state').classList.toggle('is-ready', enabled);
      return enabled;
    } catch (error) {
      if (disposed || requestSequence !== sequence) return false;
      $('join-state').textContent = `${error.message} 준비 상태를 확인할 수 없어 신청 입력을 잠갔습니다.`;
      $('join-state').classList.remove('is-ready');
      return false;
    } finally {
      if (!disposed && requestSequence === sequence) { fields.disabled = !enabled || pending || completed; $('refresh-join-state').disabled = pending || completed; syncBirthChoice(); }
    }
  }
  listen(form.elements.storeBirthData, 'change', syncBirthChoice);
  listen(birth, 'input', (event) => {
    if (!event.isComposing) {
      const formatted = formatDateInput(birth.value, birth.selectionStart ?? birth.value.length);
      if (birth.value !== formatted.value) { birth.value = formatted.value; birth.setSelectionRange(formatted.caret, formatted.caret); }
    }
    birth.setCustomValidity('');
  });
  listen($('refresh-join-state'), 'click', () => { if (!pending) void loadSettings(); });
  listen(form, 'submit', async (event) => {
    event.preventDefault();
    if (disposed || pending || completed) return;
    if (!enabled || settings?.collectionEnabled !== true) { message('운영 준비가 끝난 뒤에만 신청할 수 있습니다. 현재 입력값을 전송하지 않았습니다.', true); return; }
    const name = form.elements.name.value.trim();
    if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) { message('연락받을 이름을 30자 이내로 입력해 주세요.', true); form.elements.name.focus(); return; }
    const phone = validateOptionalPhone(form.elements.phone.value);
    if (!phone.valid || !phone.value) { message(phone.error || '휴대전화 번호를 입력해 주세요.', true); form.elements.phone.focus(); return; }
    if (!form.elements.collectionConsent.checked || !form.elements.ageConfirm14.checked) { message('수집·이용 동의와 만 14세 이상 확인이 필요합니다.', true); return; }
    const topic = form.elements.topic.value;
    if (topic && !['mbti', 'zodiac', 'saju', 'ziwei'].includes(topic)) { message('관심 주제를 다시 선택해 주세요.', true); return; }
    const storeBirthData = form.elements.storeBirthData.checked;
    const payload = { name, phone: phone.value, storeBirthData, collectionConsent: true, ageConfirm14: true, consentVersion: settings.consentVersion };
    if (topic) payload.topic = topic;
    if (storeBirthData) {
      const value = normalizeDateText(birth.value, { min: '1900-01-01', max: today(), calendar: 'solar' });
      if (!value) { birth.setCustomValidity('1900년부터 오늘까지의 실제 양력 날짜를 YYYY.MM.DD로 입력해 주세요.'); birth.reportValidity(); return; }
      const fourteenthBirthday = `${Number(value.slice(0, 4)) + 14}${value.slice(4)}`;
      if (fourteenthBirthday > today()) { message('만 14세 이상만 신청할 수 있습니다.', true); birth.focus(); return; }
      payload.birthDate = value;
    }
    const requestGeneration = generation;
    pending = true; fields.disabled = true; $('refresh-join-state').disabled = true;
    message('동의한 항목으로 모임 관심 신청을 저장하고 있습니다. 제출 후 창을 닫아도 서버에서 처리될 수 있어요.');
    try {
      // Do not abort an explicit POST on close and pretend its write was undone.
      const data = await readJson('/api/participants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (disposed || requestGeneration !== generation) return;
      if (data.status !== 'registered' || !data.id) throw new Error('신청 저장 확인을 받지 못했습니다. 중복 신청 전 운영자에게 확인해 주세요.');
      form.reset(); syncBirthChoice();
      message('모임 관심 신청을 저장했어요. 참가 확정이나 안내 문자 발송 완료를 뜻하지 않습니다. 삭제·문의는 위 운영 문의처로 연락해 주세요.');
      completed = true;
      $('join-entry').hidden = true;
      $('join-success').hidden = false;
      root.setAttribute?.('aria-labelledby', 'join-success-title');
      root.setAttribute?.('aria-describedby', 'join-success-description');
      root.scrollTo?.({ top: 0, behavior: 'instant' });
      $('join-success-title').focus({ preventScroll: false });
    } catch (error) { if (!disposed && requestGeneration === generation) message(error.message, true); }
    finally {
      pending = false;
      if (!disposed) {
        fields.disabled = !enabled || completed; $('refresh-join-state').disabled = completed;
        if (requestGeneration !== generation && isActive()) void loadSettings();
      }
    }
  });
  const controller = {
    refresh: loadSettings,
    get pending() { return pending; },
    get completed() { return completed; },
    reset() {
      if (disposed) return;
      generation++; sequence++; configRequest?.abort();
      completed = false; $('join-entry').hidden = false; $('join-success').hidden = true;
      root.setAttribute?.('aria-labelledby', 'meetup-dialog-title');
      root.setAttribute?.('aria-describedby', 'meetup-dialog-intro');
      enabled = false; settings = null; fields.disabled = true;
      form.reset(); syncBirthChoice(); message('');
      $('refresh-join-state').disabled = pending;
      $('join-state').classList.remove('is-ready');
      $('join-state').textContent = pending ? '직전 신청의 처리 결과를 기다리고 있습니다. 중복 제출은 잠시 막아 두었어요.' : '창을 열면 현재 신청 준비 상태를 다시 확인합니다.';
    },
    destroy() {
      if (disposed) return;
      controller.reset(); disposed = true;
      for (const remove of listeners) remove();
      unbindPhone?.(); bindings.delete(form);
    },
  };
  bindings.set(form, controller); fields.disabled = true; $('join-entry').hidden = false; $('join-success').hidden = true; syncBirthChoice();
  if (autoLoad) void loadSettings();
  return controller;
}
