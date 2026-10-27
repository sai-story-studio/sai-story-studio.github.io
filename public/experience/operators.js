const $ = (id) => document.getElementById(id);
const form = $('operator-form');
let view = null;
let busy = false;
let sequence = 0;
let controller = null;
let confirmedAction = null;
let lifecycle = 0;
let active = true;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function status(text, error = false) {
  $('operators-status').textContent = text;
  $('operators-status').classList.toggle('error', error);
}
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...options });
  let data;
  try { data = await response.json(); } catch {
    const error = new Error('서버 응답을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.');
    error.status = response.status; throw error;
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || '운영자 권한을 확인하지 못했습니다.');
    error.status = response.status; throw error;
  }
  return data;
}
function setBusy(value) {
  busy = value;
  $('operators-refresh').disabled = value;
  $('operator-fields').disabled = value || !view?.canManageOperators || view.counts.database >= view.maxDatabaseOperators;
  for (const button of $('operators-rows').querySelectorAll('button[data-remove]')) button.disabled = value;
}
function confirm(title, text, action) {
  if (!active || busy || !view?.canManageOperators) return;
  const current = sequence;
  confirmedAction = () => { if (active && current === sequence && view?.canManageOperators) return action(); };
  $('operator-confirm-title').textContent = title;
  $('operator-confirm-text').textContent = text;
  $('operator-confirm-dialog').showModal();
}
function clearConfirmation() {
  confirmedAction = null; $('operator-confirm-text').textContent = '';
  if ($('operator-confirm-dialog').open) $('operator-confirm-dialog').close();
}
async function loadOperators() {
  if (!active) return false;
  const current = ++sequence;
  controller?.abort(); controller = new AbortController();
  clearConfirmation();
  view = null; $('operators-rows').replaceChildren(); $('operators-content').hidden = true;
  $('operators-count').textContent = ''; $('operator-limit').textContent = '';
  $('operators-gate').hidden = true; $('operator-fields').disabled = true;
  status('서버에서 소유자 권한과 운영자 목록을 확인하고 있습니다.');
  try {
    const data = await api('/api/admin/operators', { signal: controller.signal });
    if (!active || current !== sequence) return false;
    if (data.canManageOperators !== true || !Array.isArray(data.operators) || !Number.isSafeInteger(data.counts?.database) || !Number.isSafeInteger(data.counts?.environment) || !Number.isSafeInteger(data.maxDatabaseOperators)) throw new Error('운영자 목록 형식을 확인하지 못했습니다.');
    view = data; $('operators-content').hidden = false;
    $('operators-count').textContent = `DB 등록 ${data.counts.database}명 · 서버 고정 ${data.counts.environment}명`;
    $('operator-limit').textContent = `DB 운영자는 최대 ${data.maxDatabaseOperators}명까지 추가할 수 있습니다. 소유자와 기존 서버 고정 운영자는 별도로 유지됩니다.`;
    $('operators-rows').replaceChildren(...data.operators.map((operator) => {
      const row = el('tr');
      const stamp = operator.createdAt ? new Date(operator.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '서버 설정';
      row.append(el('td', operator.email), el('td', operator.source === 'environment' ? '서버 고정' : 'DB 등록'), el('td', stamp));
      const actions = el('td');
      if (operator.removable && operator.id) {
        const remove = el('button', '운영자 해제', 'operator-remove'); remove.type = 'button'; remove.dataset.remove = 'true';
        remove.addEventListener('click', () => confirm('운영자 권한을 해제할까요?', `${operator.email} 계정의 신청자 DB 조회·개인정보 보기·CSV·삭제 등 DB 운영 권한을 해제합니다. 비공개 Sites의 초대·접속 상태는 변경하지 않습니다.`, () => removeOperator(operator.id)));
        actions.append(remove);
      } else actions.append(el('span', '서버 설정으로 관리', 'operator-fixed'));
      row.append(actions); return row;
    }));
    $('operators-empty').hidden = data.operators.length > 0;
    status('소유자 권한을 확인했습니다. 등록·해제는 이 페이지의 확인 버튼을 누른 경우에만 실행합니다.');
    setBusy(busy);
    return true;
  } catch (error) {
    if (!active || current !== sequence || error.name === 'AbortError') return false;
    view = null; $('operators-rows').replaceChildren(); $('operators-content').hidden = true;
    $('operators-gate').hidden = ![401, 403].includes(error.status);
    if ([401, 403].includes(error.status)) form.reset();
    status(error.message, true);
    return false;
  }
}
async function mutate(path, method, payload) {
  if (!active || busy || !view?.canManageOperators) return;
  const life = lifecycle;
  setBusy(true);
  try {
    const result = await api(path, { method, ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}) });
    if (!active || life !== lifecycle) return;
    if (!(method === 'POST' ? result.added === true : result.removed === true)) throw new Error('권한 변경 완료를 확인하지 못했습니다. 목록을 다시 확인해 주세요.');
    form.reset(); const loaded = await loadOperators();
    if (!active || life !== lifecycle) return;
    if (loaded) { status(result.message); $('operators-status').focus({ preventScroll: true }); }
  } catch (error) {
    if (!active || life !== lifecycle) return;
    if ([401, 403].includes(error.status)) {
      view = null; $('operators-rows').replaceChildren(); $('operators-content').hidden = true;
      $('operators-gate').hidden = false; form.reset();
      clearConfirmation(); $('operators-count').textContent = ''; $('operator-limit').textContent = '';
    }
    status(error.message, true);
  }
  finally { if (active && life === lifecycle) setBusy(false); }
}
function removeOperator(id) { return mutate(`/api/admin/operators/${encodeURIComponent(id)}`, 'DELETE'); }
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy || !view?.canManageOperators) return;
  const email = form.elements.email.value.trim().toLowerCase();
  form.elements.email.value = email;
  if (!email || email.length > 254 || !form.reportValidity()) return;
  confirm('이 계정을 운영자로 추가할까요?', `${email} 계정에 신청자 DB와 결과 발송 신청의 개인정보 조회·CSV 다운로드·삭제 권한을 부여합니다. 다른 운영자를 추가·해제하는 소유자 권한과 비공개 Sites의 초대 권한은 부여하지 않습니다.`, () => mutate('/api/admin/operators', 'POST', { email }));
});
$('operators-refresh').addEventListener('click', () => { if (!busy) void loadOperators(); });
$('operator-cancel').addEventListener('click', clearConfirmation);
$('operator-confirm').addEventListener('click', async () => { const action = confirmedAction; clearConfirmation(); if (action) await action(); });
$('operator-confirm-dialog').addEventListener('cancel', clearConfirmation);
$('operator-confirm-dialog').addEventListener('click', (event) => { if (event.target === $('operator-confirm-dialog')) clearConfirmation(); });
window.addEventListener('pagehide', () => { active = false; lifecycle += 1; controller?.abort(); sequence += 1; view = null; busy = false; form.reset(); $('operators-rows').replaceChildren(); $('operators-content').hidden = true; $('operators-gate').hidden = true; $('operators-count').textContent = ''; $('operator-limit').textContent = ''; clearConfirmation(); setBusy(false); status('소유자 권한은 다시 조회할 때 확인합니다.'); });
window.addEventListener('pageshow', (event) => { if (event.persisted) { active = true; void loadOperators(); } });
void loadOperators();
