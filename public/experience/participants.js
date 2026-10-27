const $ = (id) => document.getElementById(id);
const topics = { mbti: 'MBTI', zodiac: '별자리', saju: '사주', ziwei: '자미두수' };
const limit = 50;
let offset = 0;
let page = null;
let loadSequence = 0;
let loadController = null;
let pendingMutation = false;
let confirmedAction = null;
const selectedIds = new Set();
let visibleRecords = [];

function clearSelection() {
  selectedIds.clear();
  confirmedAction = null;
  if ($('participant-confirm-dialog').open) $('participant-confirm-dialog').close();
  syncSelection();
}
function syncSelection() {
  $('participant-selected-count').textContent = `${selectedIds.size}건 선택`;
  const count = visibleRecords.filter((record) => selectedIds.has(record.id)).length;
  const all = $('participant-select-all');
  all.checked = visibleRecords.length > 0 && count === visibleRecords.length;
  all.indeterminate = count > 0 && count < visibleRecords.length;
  all.disabled = pendingMutation || !page || visibleRecords.length === 0;
  for (const id of ['participant-clear-selection', 'participant-export-selected', 'participant-delete-selected']) $(id).disabled = pendingMutation || !selectedIds.size;
}
function lockActions() {
  for (const id of ['refresh-participants', 'participant-export', 'participant-search', 'participant-topic', 'participant-source', 'participant-marketing', 'participant-reveal']) $(id).disabled = pendingMutation;
  $('participants-previous').disabled = pendingMutation || offset === 0;
  $('participants-next').disabled = pendingMutation || !page?.pagination.hasMore;
  syncSelection();
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function dateText(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '확인 필요' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}
function recordSource(record) {
  // Missing source belongs to the older join DTO, never to a reading lead.
  return record.source == null ? 'join' : record.source;
}
function isReadingRecord(record) {
  return recordSource(record) === 'reading' && record.consentVersion === 'reading-records-v1';
}
function sourceText(record) {
  return isReadingRecord(record) ? '체험 입력 기록' : recordSource(record) === 'reading' ? '메인 결과 보기' : recordSource(record) === 'join' ? '모임 관심 신청' : '확인 필요';
}
function requestText(record) {
  return isReadingRecord(record) ? record.collectionConsent === true ? '기록 저장 요청' : '확인 필요'
    : record.collectionConsent ? '동의' : '미동의';
}
function recordStatus(record) {
  if (recordSource(record) === 'reading') {
    if (record.marketingConsent === true) return '광고 안내 관심 등록 · 발송·연락 완료 아님';
    if (record.marketingConsent === false) return '체험 입력 기록 저장 · 홍보 수신 미동의';
    return '메인 체험·소식 기록 · 광고 동의 이력 확인 필요';
  }
  return recordSource(record) === 'join' ? '모임 관심 신청 저장 · 참가 확정 아님' : '관심 기록 저장 · 신청 경로 확인 필요';
}
function marketingChannels(record) {
  if (record.marketingConsent !== true || !Array.isArray(record.marketingChannels)) return [];
  return ['sms', 'phone'].filter((channel) => record.marketingChannels.includes(channel));
}
function marketingText(record) {
  if (record.marketingConsent !== true) return '미동의';
  const channels = marketingChannels(record).map((channel) => channel === 'sms' ? '문자' : '전화');
  return channels.length ? channels.join(' · ') : '동의 · 채널 확인 필요';
}
function status(text, error = false) { $('participants-status').textContent = text; $('participants-status').classList.toggle('error', error); }
async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...options });
  if (!response.ok) {
    let data; try { data = await response.json(); } catch { /* Generic error below. */ }
    const error = new Error(data?.error?.message || '서버 응답을 확인하지 못했습니다.');
    error.status = response.status; throw error;
  }
  return response;
}
function clearDetails() {
  const dialog = $('participant-detail-dialog');
  if (dialog.open) dialog.close();
  $('participant-detail').replaceChildren();
}
function handleAccessFailure(error) {
  if (![401, 403].includes(error.status)) return false;
  loadController?.abort(); loadSequence++;
  page = null; visibleRecords = []; clearSelection(); clearDetails();
  $('participant-rows').replaceChildren(); $('participants-content').hidden = true;
  $('participants-access').hidden = false; $('participant-reveal').checked = false;
  $('participant-search').value = ''; status(error.message, true);
  return true;
}
function showDetails(record) {
  const personal = Boolean(page?.personalDataIncluded && $('participant-reveal').checked);
  const readingRecord = isReadingRecord(record);
  const rows = [
    ['신청번호', record.id], ['신청 경로', sourceText(record)],
    ['상태', recordStatus(record)],
    ['이름', personal ? record.name : record.nameMasked], ['휴대전화', personal ? record.phone : record.phoneMasked],
    ['관심 주제', topics[record.topic] || '선택 안 함'],
    [readingRecord ? '기록 저장 요청' : '개인정보 수집·이용 동의', readingRecord ? record.collectionConsent === true ? '기록 저장 버튼으로 요청' : '확인 필요' : requestText(record)],
    [readingRecord ? '기록 저장 요청 시각' : '개인정보 동의 시각', dateText(record.consentAt)],
    [readingRecord ? '기록 저장 안내 버전' : '동의서 버전', record.consentVersion],
    ['만 14세 이상 확인', readingRecord ? record.ageConfirm14 === true ? '입력 생년월일 기준 만 14세 이상 · 서버 검증' : '연령 확인 필요' : record.ageConfirm14 ? '확인' : '미확인'],
    ['광고성 정보 수신 동의', record.marketingConsent === true ? '별도 선택 동의' : readingRecord ? '홍보 수신 미동의 · 기록 저장 요청과 별개' : '미동의 · 기존 모임 신청 동의로 대신하지 않음'],
    ['광고 수신 허용 채널', marketingText(record)],
    ['광고 수신 동의 시각', record.marketingConsent === true ? dateText(record.marketingConsentAt) : '—'],
    ['광고 수신 동의서 버전', record.marketingConsent === true ? record.marketingConsentVersion || '확인 필요' : '—'],
    [readingRecord ? '생년월일 저장' : '생년월일 별도 저장', record.storeBirthData ? readingRecord ? '기록 저장 버튼으로 저장' : '별도 선택 동의' : '저장하지 않음'],
    ['저장일', dateText(record.createdAt)], ['보관 만료', dateText(record.expiresAt)],
  ];
  if (personal) {
    rows.push(['저장한 양력 생년월일', record.birthDate || '저장하지 않음'],
      [readingRecord ? '생년월일 저장 시각' : '생년월일 동의 시각', dateText(record.birthConsentAt)],
      [readingRecord ? '기록 관리 목적' : '개인정보 수집·이용 목적', record.consentPurpose || '확인 필요'],
      ['광고 안내 목적', record.marketingConsent === true ? record.marketingPurpose || '확인 필요' : '광고 수신 미동의']);
    if (!readingRecord) rows.push(['모임 안내 내용', record.meetupDescription || '—']);
    rows.push(['보관기간', Number.isFinite(record.retentionDays) ? `${record.retentionDays}일` : '확인 필요']);
  }
  else rows.push(['개인정보 표시', '기본 마스킹 상태입니다. 전체 표시를 선택한 뒤 서버에서 다시 조회해야 상세 개인정보를 볼 수 있습니다.']);
  $('participant-detail').replaceChildren(...rows.flatMap(([label, value]) => [el('dt', label), el('dd', value ?? '—')]));
  $('participant-detail-dialog').showModal();
}
function confirmAction(title, text, action) {
  if (pendingMutation) return;
  confirmedAction = action;
  $('participant-confirm-title').textContent = title;
  $('participant-confirm-text').textContent = text;
  $('participant-confirm-dialog').showModal();
}
function renderRows() {
  if (!page) return;
  const personal = Boolean(page.personalDataIncluded && $('participant-reveal').checked);
  const query = $('participant-search').value.trim().toLocaleLowerCase('ko-KR');
  const topic = $('participant-topic').value;
  const source = $('participant-source').value;
  const marketing = $('participant-marketing').value;
  const visible = page.records.filter((record) => {
    const matchesTopic = topic === 'all' || (topic === 'none' ? !record.topic : record.topic === topic);
    const matchesSource = source === 'all' || recordSource(record) === source;
    const matchesMarketing = marketing === 'all'
      || (marketing === 'none' ? record.marketingConsent !== true
        : marketing === 'consented' ? record.marketingConsent === true : marketingChannels(record).includes(marketing));
    const searchable = [record.id, personal ? record.name : record.nameMasked, personal ? record.phone : record.phoneMasked, topics[record.topic]].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
    return matchesTopic && matchesSource && matchesMarketing && (!query || searchable.includes(query));
  });
  visibleRecords = visible;
  $('participant-rows').replaceChildren(...visible.map((record) => {
    const row = el('tr');
    row.classList.toggle('is-selected', selectedIds.has(record.id));
    const selectionCell = el('td', undefined, 'p-selection-cell');
    const select = el('input'); select.type = 'checkbox'; select.checked = selectedIds.has(record.id);
    select.disabled = pendingMutation; select.ariaLabel = `기록 ${record.id} 선택`;
    select.addEventListener('change', () => {
      if (pendingMutation) return;
      if (select.checked) selectedIds.add(record.id); else selectedIds.delete(record.id);
      row.classList.toggle('is-selected', select.checked); syncSelection();
    });
    selectionCell.append(select); row.append(selectionCell);
    const sourceCell = el('td'); sourceCell.append(el('span', sourceText(record), `p-source-badge${recordSource(record) === 'reading' ? ' is-reading' : ''}`));
    if (recordSource(record) === 'reading' && record.marketingConsent === false) sourceCell.append(el('small', '홍보 수신 미동의', 'p-record-note'));
    const marketingCell = el('td'); marketingCell.append(el('span', marketingText(record), `p-consent-badge${record.marketingConsent === true ? ' is-consented' : ' is-none'}`));
    row.append(el('td', dateText(record.createdAt)), sourceCell, el('td', personal ? record.name : record.nameMasked), el('td', personal ? record.phone : record.phoneMasked), el('td', topics[record.topic] || '선택 안 함'), el('td', requestText(record)), marketingCell, el('td', dateText(record.expiresAt)));
    const actions = el('td', undefined, 'p-row-actions');
    const detail = el('button', '상세'); detail.type = 'button'; detail.addEventListener('click', () => showDetails(record));
    const remove = el('button', '삭제'); remove.type = 'button'; remove.className = 'p-delete'; remove.disabled = pendingMutation;
    remove.addEventListener('click', () => confirmAction('이 기록을 삭제할까요?', '선택한 기록 1건의 이름·휴대전화·저장된 생년월일·저장 요청 및 기존 동의 이력을 DB에서 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.', () => deleteRecord(record.id)));
    actions.append(detail, remove); row.append(actions); return row;
  }));
  $('participant-visible-total').textContent = String(visible.length);
  $('participants-empty').hidden = visible.length > 0;
  $('participants-empty').textContent = page.summary.total === 0 ? '아직 DB에 저장된 체험 입력·모임 신청 기록이 없습니다.' : '현재 페이지에서 검색·필터 조건에 맞는 기록이 없습니다.';
  lockActions();
}
async function loadRecords() {
  const sequence = ++loadSequence;
  loadController?.abort(); loadController = new AbortController();
  page = null; visibleRecords = []; clearSelection(); clearDetails(); $('participant-rows').replaceChildren();
  $('participants-content').hidden = true; $('participants-access').hidden = true;
  status('서버에서 접근 권한과 실제 신청 목록을 확인하고 있습니다.');
  try {
    const personal = $('participant-reveal').checked;
    const response = await api(`/api/admin/participants?limit=${limit}&offset=${offset}&includePersonal=${personal}`, { signal: loadController.signal });
    const data = await response.json();
    if (sequence !== loadSequence) return;
    if (!Array.isArray(data.records) || !data.summary || !data.pagination || !Number.isSafeInteger(data.summary.total) || !Number.isSafeInteger(data.summary.withBirthData)) throw new Error('신청 목록 형식을 확인하지 못했습니다.');
    page = data;
    if (offset > 0 && offset >= page.pagination.total) { offset = Math.max(0, offset - limit); return void loadRecords(); }
    $('participants-content').hidden = false;
    $('participant-total').textContent = String(page.summary.total);
    $('participant-birth-total').textContent = String(page.summary.withBirthData);
    $('participants-previous').disabled = offset === 0;
    $('participants-next').disabled = !page.pagination.hasMore;
    $('participants-page-status').textContent = `${page.pagination.total}건 중 ${page.records.length ? offset + 1 : 0}–${offset + page.records.length}건`;
    renderRows();
    status(page.personalDataIncluded ? '관리자 권한을 확인했습니다. 전체 개인정보 표시 중입니다. 작업 후 표시를 해제해 주세요.' : '관리자 권한을 확인했습니다. 이름과 휴대전화는 마스킹되어 있습니다.');
    return true;
  } catch (error) {
    if (sequence !== loadSequence || error.name === 'AbortError') return;
    page = null; visibleRecords = []; clearSelection(); clearDetails(); $('participant-rows').replaceChildren(); $('participants-content').hidden = true;
    $('participants-access').hidden = ![401, 403].includes(error.status);
    status(error.message, true);
  }
}
async function deleteRecord(id) {
  if (pendingMutation) return;
  pendingMutation = true; renderRows();
  try { await api(`/api/admin/participants/${encodeURIComponent(id)}`, { method: 'DELETE' }); if (await loadRecords()) status('선택한 신청 1건을 DB에서 삭제했습니다.'); }
  catch (error) { if (!handleAccessFailure(error)) status(error.message, true); }
  finally { pendingMutation = false; if (page) renderRows(); else lockActions(); }
}
async function deleteSelected(ids) {
  if (pendingMutation || !ids.length || ids.length > limit) return;
  pendingMutation = true; renderRows();
  let removed = 0, missing = 0, failed = 0;
  try {
    for (const id of ids) {
      try { await api(`/api/admin/participants/${encodeURIComponent(id)}`, { method: 'DELETE' }); removed++; }
      catch (error) { if (error.status === 404) missing++; else { if (handleAccessFailure(error)) return; failed = ids.length - removed - missing; break; } }
    }
    if (await loadRecords()) status(`${removed}건 삭제 완료${missing ? ` · 이미 삭제·만료 ${missing}건` : ''}${failed ? ` · 처리하지 못한 ${failed}건은 새 목록에서 확인해 주세요.` : ''}`, failed > 0);
  } catch (error) { status(`${removed}건 삭제 후 목록을 새로 확인하지 못했어요. ${error.message}`, true); }
  finally { pendingMutation = false; if (page) renderRows(); else lockActions(); }
}
async function downloadCsv(ids = null) {
  if (pendingMutation) return;
  pendingMutation = true; if (page) renderRows(); else lockActions();
  try {
    const response = await api('/api/admin/participants/export', ids ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) } : {});
    const url = URL.createObjectURL(await response.blob());
    const link = el('a'); link.href = url; link.download = `SAI-participants-${ids ? 'selected-' : ''}${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(`${ids ? `선택한 ${ids.length}건의` : '전체 기록의'} CSV를 내려받았습니다. 개인정보가 포함된 파일의 보관·삭제를 별도로 관리해 주세요.`);
  } catch (error) { if (!handleAccessFailure(error)) status(error.message, true); }
  finally { pendingMutation = false; if (page) renderRows(); else lockActions(); }
}
function filterRecords() { if (!pendingMutation) { clearSelection(); renderRows(); } }
$('participant-search').addEventListener('input', filterRecords);
$('participant-topic').addEventListener('change', filterRecords);
$('participant-source').addEventListener('change', filterRecords);
$('participant-marketing').addEventListener('change', filterRecords);
$('participant-select-all').addEventListener('change', () => {
  if (pendingMutation || !page) return;
  const checked = $('participant-select-all').checked;
  for (const record of visibleRecords) { if (checked) selectedIds.add(record.id); else selectedIds.delete(record.id); }
  renderRows();
});
$('participant-clear-selection').addEventListener('click', () => { if (!pendingMutation) { clearSelection(); renderRows(); } });
$('participant-delete-selected').addEventListener('click', () => {
  if (pendingMutation || !selectedIds.size) return;
  const ids = [...selectedIds];
  confirmAction(`${ids.length}건을 선택 삭제할까요?`, `선택한 ${ids.length}건의 이름·연락처·생년월일·저장 및 동의 이력을 DB에서 영구 삭제합니다. 되돌릴 수 없으며, 선택하지 않은 기록은 삭제하지 않습니다.`, () => deleteSelected(ids));
});
$('participant-export-selected').addEventListener('click', () => {
  if (pendingMutation || !selectedIds.size) return;
  const ids = [...selectedIds];
  confirmAction(`${ids.length}건을 다운로드할까요?`, `선택한 ${ids.length}건의 전체 개인정보와 저장·동의 이력만 CSV로 내려받습니다. 마스킹 해제 여부와 관계없이 전체 개인정보가 포함되니 안전하게 보관해 주세요.`, () => downloadCsv(ids));
});
$('participant-reveal').addEventListener('change', () => { offset = 0; if (!$('participant-reveal').checked) $('participant-search').value = ''; clearDetails(); void loadRecords(); });
$('refresh-participants').addEventListener('click', () => { if (!pendingMutation) void loadRecords(); });
$('participants-previous').addEventListener('click', () => { if (!pendingMutation) { offset = Math.max(0, offset - limit); void loadRecords(); } });
$('participants-next').addEventListener('click', () => { if (!pendingMutation && page?.pagination.hasMore) { offset += limit; void loadRecords(); } });
$('participant-export').addEventListener('click', () => confirmAction('CSV를 내려받을까요?', '전체 기록의 이름·휴대전화·저장된 생년월일·저장 요청 및 과거 동의 이력이 파일에 포함됩니다. 이 기기의 안전한 장소에 보관하고 불필요한 사본은 삭제해 주세요.', downloadCsv));
$('close-participant-detail').addEventListener('click', clearDetails);
$('participant-cancel-action').addEventListener('click', () => { confirmedAction = null; $('participant-confirm-dialog').close(); });
$('participant-confirm-action').addEventListener('click', async () => { const action = confirmedAction; confirmedAction = null; $('participant-confirm-dialog').close(); if (action) await action(); });
$('participant-confirm-dialog').addEventListener('cancel', () => { confirmedAction = null; });
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => { if (event.target === dialog) { dialog.close(); if (dialog.id === 'participant-confirm-dialog') confirmedAction = null; } });
window.addEventListener('pagehide', () => { loadController?.abort(); loadSequence++; page = null; visibleRecords = []; clearSelection(); clearDetails(); $('participant-rows').replaceChildren(); $('participants-content').hidden = true; $('participant-reveal').checked = false; $('participant-search').value = ''; });
window.addEventListener('pageshow', (event) => { if (event.persisted) { offset = 0; void loadRecords(); } });
void loadRecords();
