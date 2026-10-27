// Result-delivery management, mounted once in the unified operators dashboard.
const $ = (id) => document.getElementById(id);
const statuses = { requested: '발송 대기', awaiting_sender_setup: '발송 설정 대기', sending: '처리 중', sent: '제공자 접수 완료', failed: '발송 실패 · 확인 필요' };
const modes = { zodiac: '별자리', saju: '사주', ziwei: '자미두수' };
const topics = { mbti: 'MBTI', zodiac: '별자리', saju: '사주', ziwei: '자미두수' };
let offset = 0;
let page = null;
let loading = false;
let pendingAction = false;
let confirmedAction = null;
let loadSequence = 0;
let lifecycle = 0;
let active = true;
let controller = null;

function el(tag, text) { const node = document.createElement(tag); if (text != null) node.textContent = String(text); return node; }
function date(value) { return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—'; }
function message(text, error = false) { $('admin-message').textContent = text; $('admin-message').classList.toggle('error', error); }
function cancelConfirmation() { confirmedAction = null; $('confirm-text').textContent = ''; if ($('confirm-dialog').open) $('confirm-dialog').close(); }
function closeDetail() { if ($('record-dialog').open) $('record-dialog').close(); $('record-detail').textContent = ''; }
function clearRecords({ resetReveal = false } = {}) {
  page = null; $('records-body').replaceChildren(); $('admin-content').hidden = true;
  for (const id of ['stat-total', 'stat-sent', 'stat-meetup']) $(id).textContent = '—';
  $('page-status').textContent = ''; $('sender-status').textContent = ''; $('admin-empty').hidden = true;
  if (resetReveal) $('reveal-personal').checked = false;
  closeDetail(); cancelConfirmation();
}
function updateControls() {
  $('refresh-records').disabled = loading || pendingAction;
  $('reveal-personal').disabled = pendingAction;
  $('export-records').disabled = loading || pendingAction || !page;
  $('previous-page').disabled = loading || pendingAction || !page || offset === 0;
  $('next-page').disabled = loading || pendingAction || !page?.pagination.hasMore;
  for (const button of $('records-body').querySelectorAll('button[data-action]')) {
    button.disabled = loading || pendingAction || button.dataset.allowed !== 'true';
  }
}
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...options });
  if (!response.ok) {
    let data; try { data = await response.json(); } catch { /* Preserve the HTTP status for fail-closed cleanup. */ }
    const error = new Error(data?.error?.message || '요청을 처리하지 못했습니다.'); error.status = response.status; throw error;
  }
  return response;
}
function handleError(error) {
  if ([401, 403].includes(error.status)) {
    loadSequence += 1; controller?.abort(); loading = false; clearRecords({ resetReveal: true }); $('admin-access').hidden = false;
  }
  message(error.message, true); updateControls();
}
function currentRecord(record) { return active && page?.records.includes(record); }
function canSend(record) { return page?.deliveryConfigured.email === true && record.channel === 'email' && ['requested', 'awaiting_sender_setup', 'failed'].includes(record.status); }
function requestConfirmation(text, action) {
  if (!active || loading || pendingAction || !page) return;
  const generation = loadSequence;
  $('confirm-text').textContent = text;
  confirmedAction = () => { if (active && generation === loadSequence && page) return action(); };
  $('confirm-dialog').showModal();
}
function validPage(data) {
  return data && Array.isArray(data.records) && data.records.every(record => record && typeof record.id === 'string')
    && Number.isSafeInteger(data.summary?.total) && data.summary.total >= 0 && data.summary.byStatus && typeof data.summary.byStatus === 'object'
    && Number.isSafeInteger(data.pagination?.total) && typeof data.pagination.hasMore === 'boolean'
    && typeof data.personalDataIncluded === 'boolean' && typeof data.deliveryConfigured?.email === 'boolean';
}
async function loadRecords() {
  if (!active || pendingAction) return false;
  const current = ++loadSequence;
  controller?.abort(); controller = new AbortController();
  const includePersonal = $('reveal-personal').checked;
  clearRecords(); loading = true; $('admin-access').hidden = true; updateControls(); message('결과 발송 신청을 확인하고 있어요.');
  try {
    const response = await api(`/api/admin/records?limit=25&offset=${offset}&includePersonal=${includePersonal}`, { signal: controller.signal });
    const data = await response.json();
    if (!active || current !== loadSequence) return false;
    if (!validPage(data) || data.personalDataIncluded !== includePersonal) throw new Error('신청 목록의 응답 형식을 확인하지 못했습니다. 다시 조회해 주세요.');
    page = data; $('admin-content').hidden = false; $('admin-access').hidden = true;
    $('stat-total').textContent = data.summary.total; $('stat-sent').textContent = data.summary.byStatus.sent || 0; $('stat-meetup').textContent = data.summary.followupConsented || 0;
    $('sender-status').textContent = data.deliveryConfigured.email ? '이메일 서비스가 연결되어 있습니다. 발송 전 신청·동의 내용을 확인하세요.' : '이메일 서비스가 연결되지 않았습니다. 발송 버튼은 잠겨 있습니다.';
    $('records-body').replaceChildren(...data.records.map(record => {
      const row = el('tr');
      row.append(el('td', date(record.createdAt)), el('td', includePersonal ? record.contact : record.contactMasked), el('td', `${modes[record.mode] || record.mode} · ${record.resultType}`), el('td', record.followupConsent ? `동의 · ${(record.meetupTopics || []).map(topic => topics[topic] || topic).join(', ')}` : '미동의'), el('td', statuses[record.status] || record.status));
      const actions = el('td');
      const button = (text, allowed, action) => { const node = el('button', text); node.type = 'button'; node.dataset.action = 'true'; node.dataset.allowed = String(allowed); node.disabled = !allowed; node.addEventListener('click', () => { if (!loading && !pendingAction && currentRecord(record) && allowed) action(); }); return node; };
      actions.append(button('상세', true, () => showDetail(record)), button('이메일 발송', canSend(record), () => requestConfirmation('요청한 결과 이메일을 한 건 발송합니다. 모임 초대는 포함하지 않습니다.', () => mutate(record, 'POST'))), button('삭제', record.status !== 'sending', () => requestConfirmation('이 신청의 연락처·결과·동의 기록을 영구 삭제합니다. 되돌릴 수 없습니다.', () => mutate(record, 'DELETE'))));
      row.append(actions); return row;
    }));
    $('admin-empty').hidden = data.records.length > 0;
    $('page-status').textContent = `${data.pagination.total}건 중 ${data.records.length ? offset + 1 : 0}–${offset + data.records.length}`;
    message(includePersonal ? '권한을 확인했습니다. 전체 개인정보를 표시하고 있습니다.' : '권한을 확인했습니다. 연락처는 기본적으로 가려서 표시합니다.'); return true;
  } catch (error) {
    if (!active || current !== loadSequence || error.name === 'AbortError') return false;
    clearRecords({ resetReveal: true }); handleError(error); return false;
  } finally { if (active && current === loadSequence) { loading = false; updateControls(); } }
}
function showDetail(record) {
  if (!currentRecord(record)) return;
  const personal = $('reveal-personal').checked && page.personalDataIncluded;
  const lines = [`신청번호: ${record.id}`, `방식: ${modes[record.mode] || record.mode} / ${record.resultType}`, `연락처: ${personal ? record.contact : record.contactMasked}`, `결과 발송 동의: ${record.resultConsent ? '동의' : '미동의'}`, `동의 시각: ${date(record.consentAt)}`, `모임 안내 동의: ${record.followupConsent ? '별도 동의' : '미동의'}`, `관심 모임: ${(record.meetupTopics || []).map(topic => topics[topic] || topic).join(', ') || '없음'}`, `보관 만료: ${date(record.expiresAt)}`, `발송 상태: ${statuses[record.status] || record.status}`, `동의서 버전: ${record.consentVersion}`];
  if (personal) lines.push(`이름: ${record.nickname || '없음'}`, `저장한 양력 생년월일: ${record.birthDate || '저장하지 않음'}`, `저장한 출생시간: ${record.birthTime || '저장하지 않음'}`, `모임 설명: ${record.followupPurpose || '미동의'}`, `모임 동의 시각: ${date(record.followupConsentAt)}`, `결과: ${record.result?.title || '없음'}\n${record.result?.summary || ''}`);
  else lines.push('전체 개인정보는 ‘개인정보 전체 표시’를 선택한 뒤 확인할 수 있습니다.');
  $('record-detail').textContent = lines.join('\n\n'); $('record-dialog').showModal();
}
async function mutate(record, method) {
  if (!currentRecord(record) || pendingAction || (method === 'POST' ? !canSend(record) : record.status === 'sending')) return;
  const life = lifecycle; pendingAction = true; updateControls();
  try {
    const path = method === 'POST' ? `/api/admin/send/${encodeURIComponent(record.id)}` : `/api/admin/records/${encodeURIComponent(record.id)}`;
    await api(path, { method });
    if (!active || life !== lifecycle) return;
    pendingAction = false; await loadRecords();
  } catch (error) { if (active && life === lifecycle) handleError(error); }
  finally { if (active && life === lifecycle) { pendingAction = false; updateControls(); } }
}
async function exportRecords() {
  if (!active || !page || pendingAction) return;
  const life = lifecycle; pendingAction = true; updateControls();
  try {
    const response = await api('/api/admin/export'); const blob = await response.blob();
    if (!active || life !== lifecycle) return;
    const url = URL.createObjectURL(blob); const link = el('a'); link.href = url; link.download = `SAI-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { if (active && life === lifecycle) handleError(error); }
  finally { if (active && life === lifecycle) { pendingAction = false; updateControls(); } }
}
$('close-record').addEventListener('click', closeDetail);
$('record-dialog').addEventListener('cancel', closeDetail);
$('record-dialog').addEventListener('close', () => { $('record-detail').textContent = ''; });
$('cancel-action').addEventListener('click', cancelConfirmation);
$('confirm-dialog').addEventListener('cancel', cancelConfirmation);
$('confirm-dialog').addEventListener('click', event => { if (event.target === $('confirm-dialog')) cancelConfirmation(); });
$('confirm-action').addEventListener('click', async () => { const action = confirmedAction; cancelConfirmation(); if (action) await action(); });
$('refresh-records').addEventListener('click', () => { void loadRecords(); });
$('reveal-personal').addEventListener('change', () => { offset = 0; void loadRecords(); });
$('previous-page').addEventListener('click', () => { if (!loading && !pendingAction && page && offset > 0) { offset = Math.max(0, offset - 25); void loadRecords(); } });
$('next-page').addEventListener('click', () => { if (!loading && !pendingAction && page?.pagination.hasMore) { offset += 25; void loadRecords(); } });
$('export-records').addEventListener('click', () => requestConfirmation('개인정보가 포함된 CSV 파일을 이 기기에 내려받습니다. 접근할 수 있는 안전한 장소에 보관해 주세요.', exportRecords));
window.addEventListener('pagehide', () => { active = false; lifecycle += 1; loadSequence += 1; controller?.abort(); loading = false; pendingAction = false; clearRecords({ resetReveal: true }); $('admin-access').hidden = true; message('운영 권한은 다시 조회할 때 확인합니다.'); updateControls(); });
window.addEventListener('pageshow', event => { if (event.persisted) { active = true; offset = 0; void loadRecords(); } });
void loadRecords();
