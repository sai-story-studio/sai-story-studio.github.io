import { validateOptionalPhone } from './phone-utils.js';

const VERSION = 'reading-records-v1';
export function recordConfigReady(config) {
  const record = config?.readingRecord;
  return Boolean(config?.collectionEnabled && config.operatorName && config.contactEmail
    && Number.isInteger(config.retentionDays) && config.retentionDays > 0
    && record?.enabled && record.consentVersion === VERSION && record.purpose && record.minimumAge === 14);
}

// Only the explicitly named record-storage action calls this allowlist.
// Birth time, gender and calculated personality/result text are excluded.
export function prepareReadingRecord(values, config, solarDate, now = new Date()) {
  if (!recordConfigReady(config)) return { kind: 'error', message: '기록 저장 준비 상태를 확인하지 못해 입력정보를 전송하지 않았어요.' };
  const name = String(values.name ?? '').trim();
  if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) return { kind: 'error', message: '기록을 저장하려면 이름을 30자 이내로 입력해 주세요.' };
  const phone = validateOptionalPhone(values.phone);
  if (!phone.valid || !phone.value) return { kind: 'error', message: phone.error || '기록을 저장하려면 휴대전화 번호를 입력해 주세요.' };
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (key) => parts.find((value) => value.type === key).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const date = typeof solarDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(solarDate) ? new Date(`${solarDate}T00:00:00Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== solarDate
    || solarDate < '1900-01-01' || solarDate > today) return { kind: 'error', message: '저장할 생년월일을 확인해 주세요.' };
  if (`${Number(solarDate.slice(0, 4)) + 14}${solarDate.slice(4)}` > today) return { kind: 'error', message: '입력 기록 저장은 만 14세 이상만 사용할 수 있어요. 저장 없이 결과는 볼 수 있어요.' };
  const payload = { source: 'reading', name, phone: phone.value.startsWith('+8210') ? `010${phone.value.slice(5)}` : phone.value,
    birthDate: solarDate, recordConsent: true, consentVersion: VERSION };
  if (['zodiac', 'saju', 'ziwei'].includes(values.topic)) payload.topic = values.topic;
  return { kind: 'ready', payload };
}

export function createReadingRecordController({ form, document: doc = document, request = fetch, uuid = () => crypto.randomUUID() }) {
  const $ = (id) => doc.getElementById(id);
  const buttons = [...form.querySelectorAll('button[type="submit"]')];
  const statuses = [$('reading-record-status'), $('result-record-status')];
  let config = null, pending = false, draft = null, activeRequest = null;
  function message(text, error = false) { for (const node of statuses) { node.textContent = text; node.classList.toggle('error', error); } }
  function sync() {
    for (const button of buttons) button.disabled = pending;
    $('calculate-button').disabled = pending || !recordConfigReady(config);
  }
  function setConfig(next) {
    config = next;
    for (const [id, value] of [['record-purpose', config?.readingRecord?.purpose], ['record-operator', config?.operatorName], ['record-contact', config?.contactEmail]]) $(id).textContent = value || '서버 설정 확인 전';
    $('record-retention').textContent = config?.retentionDays ? `${config.retentionDays}일` : '서버 설정 확인 전';
    $('reading-record-state').textContent = recordConfigReady(config)
      ? `기록 저장 시 이름·휴대전화·생년월일을 성향 체험 기록 관리 목적으로 ${config.retentionDays}일간 보관합니다.`
      : '지금은 기록 저장 준비 상태를 확인할 수 없어요. 저장 없이 결과 보기는 사용할 수 있어요.';
    sync();
  }
  function viewOnly() { message('이번에는 저장 없이 결과만 보여드려요. 새 입력 기록을 DB에 전송하지 않았어요.'); }
  async function save({ input, result }) {
    if (pending) return;
    const prepared = prepareReadingRecord({ name: input.nickname, phone: form.elements.phone?.value ?? '', topic: result.mode }, config,
      result.calculation?.details?.solarDate || (input.calendar === 'solar' ? input.birthDate : null));
    if (prepared.kind === 'error') { message(`${prepared.message} 결과는 그대로 볼 수 있어요.`, true); return; }
    const signature = JSON.stringify(prepared.payload);
    if (draft?.signature !== signature) draft = { signature, requestKey: uuid() };
    const payload = { ...prepared.payload, requestKey: draft.requestKey };
    pending = true; sync(); message('결과는 준비됐어요. 입력 기록을 저장하고 있어요…');
    activeRequest = new AbortController();
    const timer = setTimeout(() => activeRequest?.abort(), 15000);
    try {
      const response = await request('/api/participants', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: activeRequest.signal });
      let data; try { data = await response.json(); } catch { throw new Error('기록 저장 확인을 받지 못했어요.'); }
      if (!response.ok) throw new Error(data?.error?.message || '기록을 저장하지 못했어요.');
      if (data.status !== 'registered' || !data.id) throw new Error('기록 저장 확인을 받지 못했어요.');
      message('이름·휴대전화·생년월일을 입력 기록으로 저장했어요. 홍보 수신 동의나 문자·전화 발송으로 처리하지 않아요.');
    } catch (error) {
      message(`${error.name === 'AbortError' ? '기록 저장 여부를 확인하지 못했어요.' : error.message} 결과는 그대로 볼 수 있어요. 다시 기록 저장을 누르면 같은 신청번호로 재확인해요.`, true);
    } finally { clearTimeout(timer); activeRequest = null; pending = false; sync(); }
  }
  function suspend() { config = null; activeRequest?.abort(); sync(); }
  setConfig(null);
  return { setConfig, save, viewOnly, suspend, get pending() { return pending; } };
}
