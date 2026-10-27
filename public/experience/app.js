import { calculateReading } from './reading-engine.js';
import { validateOptionalPhone, bindPhoneInput } from './phone-utils.js';
import { describeDayPillar } from './day-pillar.js';
import { buildReadingDetail, readingResultSummary, sajuTimeCorrectionDisplay } from './reading-detail.js';
import { KOREAN_BIRTHPLACES, getKoreanBirthplace } from './birthplace-time.js';
import { chunkCopyText } from './text-layout.js';
import { createReadingRecordController } from './reading-records.js';
import { buildMappingExplanation } from './mapping-explanation.js';
import { buildManseView } from './manse-view.js';
import { reportSegments, reportParagraphRole, reportBlocks } from './report-format.js';

// Calculation is local. Only the clearly named record-storage action submits
// name/phone/solar birth date/topic. Advertising and delivery are not implied.
const $ = (id) => document.getElementById(id);
const form = $('reading-form');
bindPhoneInput($('reading-phone'));
const deliveryForm = $('delivery-form');
const readingRecord = createReadingRecordController({ form });
const modes = { zodiac: '별자리', saju: '사주', ziwei: '자미두수' };
const help = {
  zodiac: '통상적인 양력 생일 구간으로 별자리의 상징을 살펴봐요.',
  saju: '출생일의 원국을 계산해요. 생시와 전통 계산용 성별을 함께 입력하면 대운도 볼 수 있어요.',
  ziwei: '실제 자미두수 명반의 명궁 주성을 살펴봐요. 출생시간과 전통 계산용 성별이 필요합니다.',
};
const methodDescriptions = {
  zodiac: '양력 생일의 12별자리(태양궁)로 성향을 읽는 방식이에요.',
  saju: '태어난 연·월·일·시의 여덟 글자와 오행으로 기질과 흐름을 읽어요.',
  ziwei: '출생 정보로 만든 12칸의 명반과 별의 배치로 성향을 읽어요.',
};
let currentReading = null;
let currentInput = null;
let serviceConfig = null;
let participantInfoSequence = 0;
let pendingDelivery = false;
let pendingPdf = false;
let deliveryAttempt = null;
let deliveryViewGeneration = 0;
const deliveryDocuments = new WeakMap();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function setCopyText(node, text) {
  node.replaceChildren(...chunkCopyText(text).map((sentence) => element('span', sentence, 'copy-sentence')));
  return node;
}
function copyElement(tag, text, className) {
  return setCopyText(element(tag, null, className), text);
}
function reportParagraph(text, sectionId, index, highlights = []) {
  const paragraph = element('div', null, `report-paragraph${index === 0 ? ' report-lead' : ''}`);
  let body = text;
  let role = reportParagraphRole(sectionId, index);
  const ziweiRole = /^((?:Fact|Claim|Disclosure)\s*·[^\n]+)\n/u.exec(text);
  if (sectionId.startsWith('ziwei-') && ziweiRole) { role = ziweiRole[1]; body = text.slice(ziweiRole[0].length); }
  for (const block of reportBlocks(body)) {
    const node = element('p', null, 'report-block');
    for (const segment of reportSegments(block, highlights)) node.append(segment.strong
      ? element('strong', segment.text, segment.semantic ? 'report-keypoint' : 'report-term') : document.createTextNode(segment.text));
    paragraph.append(node);
  }
  if (role) paragraph.dataset.role = role;
  return paragraph;
}
function renderList(id, items) {
  $(id).replaceChildren(...(items || []).map((text) => element('li', text)));
}
function selectedMode() { return form.elements.mode.value; }
for (const city of KOREAN_BIRTHPLACES) {
  const option = element('option', city.name); option.value = city.id;
  form.elements.birthplaceId.append(option);
}
function syncBirthplaceControls() {
  const saju = selectedMode() === 'saju';
  const city = getKoreanBirthplace(form.elements.birthplaceId.value);
  $('saju-location-row').classList.toggle('is-saju', saju);
  $('birthplace-field').hidden = !saju;
  $('birthplace-correction-field').hidden = !saju;
  form.elements.birthplaceId.disabled = !saju;
  form.elements.timeCorrection.disabled = !saju || !city;
  if (!city) form.elements.timeCorrection.checked = false;
  $('time-warning').textContent = !saju
    ? '자미두수는 입력한 현지 시각을 그대로 사용하며 출생지·시간대·서머타임·진태양시를 보정하지 않아요.'
    : form.elements.timeCorrection.checked
      ? form.elements.birthTime.value
        ? '선택 도시의 대표 경도와 출생 당시 한국 표준시·서머타임으로 지역 평균태양시를 계산해요. 균시차는 적용하지 않으며 보정 기준은 결과에서 확인할 수 있어요.'
        : '생시를 모르면 도시와 보정 설정을 선택해도 시각을 추정하지 않아요. 시주는 비워 두고 확인된 출생일만 사용해요.'
      : '보정을 켜지 않으면 입력한 시각을 그대로 사용해요. 다른 만세력의 출생지·표준시·절기 적용 방식과 결과가 다를 수 있어요.';
}
function updateMode() {
  const mode = selectedMode();
  const traditional = mode !== 'zodiac';
  $('reading-method-name').textContent = `${modes[mode]}란?`;
  $('reading-method-description').textContent = methodDescriptions[mode];
  $('mode-help').textContent = help[mode];
  document.querySelector('.calendar-field').hidden = !traditional;
  $('time-fields').hidden = !traditional;
  $('time-warning').hidden = !traditional;
  $('gender-field').hidden = !traditional;
  $('ziwei-report-fields').hidden = mode !== 'ziwei';
  $('ziwei-report-fields').disabled = mode !== 'ziwei';
  $('gender-label').textContent = mode === 'saju' ? '성별 (선택)' : '전통 명반 계산용 성별';
  $('gender-help').textContent = mode === 'saju'
    ? '대운의 순행·역행 규칙에만 사용해요. 선택하지 않아도 원국과 세운은 볼 수 있어요.'
    : '명반의 전통 계산 규칙에만 쓰며, 성격이나 성 정체성을 판단하지 않아요.';
  form.elements.birthTime.required = mode === 'ziwei';
  form.elements.gender.required = mode === 'ziwei';
  $('time-optional').textContent = mode === 'ziwei' ? '필수' : '모르면 비워두세요';
  $('leap-field').hidden = !traditional || form.elements.calendar.value !== 'lunar';
  syncBirthplaceControls();
  $('form-error').textContent = '';
}
for (const radio of form.querySelectorAll('[name="mode"]')) radio.addEventListener('change', updateMode);
form.elements.calendar.addEventListener('change', updateMode);
form.elements.birthplaceId.addEventListener('change', syncBirthplaceControls);
form.elements.timeCorrection.addEventListener('change', syncBirthplaceControls);
form.elements.birthTime.addEventListener('input', syncBirthplaceControls);
form.elements.birthTime.addEventListener('change', syncBirthplaceControls);
form.addEventListener('reset', () => { requestAnimationFrame(updateMode); });
const today = new Date();
form.elements.ziweiAsOf.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
form.elements.birthDate.max = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
for (const button of document.querySelectorAll('[data-pick]')) button.addEventListener('click', () => {
  form.elements.mode.value = button.dataset.pick;
  updateMode();
  $('reading').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  (form.elements.birthDateDisplay || form.elements.birthDate).focus({ preventScroll: true });
});

function renderManseBoard(view) {
  const board = element('div', null, 'manse-board');
  const palette = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };
  function makeTable(caption, rows) {
    const table = element('table', null, 'manse-table');
    table.append(element('caption', caption));
    const cols = element('colgroup');
    for (let index = 0; index < 5; index++) cols.append(element('col'));
    table.append(cols);
    const head = element('thead'), header = element('tr');
    const corner = element('th', '항목', 'sr-only-label'); corner.scope = 'col'; header.append(corner);
    for (const column of view.columns) {
      const th = element('th', column.label); th.scope = 'col';
      if (column.key === 'day') th.classList.add('manse-day');
      header.append(th);
    }
    head.append(header); table.append(head);
    const body = element('tbody');
    for (const [label, kind, read] of rows) {
      const row = element('tr', null, kind === 'glyph' ? 'manse-glyph-row' : '');
      const title = element('th', label); title.scope = 'row'; row.append(title);
      for (const column of view.columns) {
        const cell = element('td', null, kind === 'stars' ? 'manse-stars-cell' : kind === 'twelve' ? 'manse-twelve-cell' : '');
        const value = read(column);
        if (column.key === 'day') cell.classList.add('manse-day');
        if (column.missing) { cell.classList.add('manse-missing'); cell.textContent = kind === 'glyph' ? '모름' : '—'; }
        else if (kind === 'glyph' && value) {
          cell.classList.add(`manse-${palette[value.element]}`);
          const pair = element('span', null, 'manse-glyph-pair');
          pair.append(element('span', value.name), element('b', value.glyph));
          cell.append(pair, element('small', `${value.polarity}${value.element}`, 'manse-polarity'));
        } else if (Array.isArray(value) && value.length) {
          for (const item of value) {
            const tag = kind === 'stars' && item.match(/^(.*?)(\(지지\)|\(간지\))$/);
            const line = element('span', tag ? null : item, 'manse-value-line');
            if (tag) line.append(element('span', tag[1], 'manse-star-name'), element('small', tag[2], 'manse-star-rule'));
            cell.append(line);
          }
        } else if (typeof value === 'string' && value) {
          cell.append(element('span', value.replace('·칠살', '\n칠살'), 'manse-value-line'));
        } else { cell.classList.add('manse-missing'); cell.textContent = '미확인'; }
        row.append(cell);
      }
      body.append(row);
    }
    table.append(body); return table;
  }
  board.append(makeTable('사주 원국 · 생시부터 생년 순서', [
    ['천간', 'glyph', (column) => column.stem],
    ['십성', 'text', (column) => column.stemTenGod],
    ['지지', 'glyph', (column) => column.branch],
    ['십성\n(본기)', 'text', (column) => column.branchTenGods?.[0]],
    ['지장간', 'text', (column) => column.hiddenStems?.join(' ')],
    ['12운성', 'text', (column) => column.growthStage],
  ]), makeTable('귀인·신살 · 천간과 지지', [
    ['천간', 'glyph', (column) => column.stem],
    ['귀인·\n신살', 'stars', (column) => column.auspiciousByLayer?.stem?.length ? column.auspiciousByLayer.stem : '—'],
    ['지지', 'glyph', (column) => column.branch],
    ['귀인·\n신살', 'stars', (column) => column.auspiciousByLayer?.branch?.length ? column.auspiciousByLayer.branch : '—'],
    ['12신살', 'twelve', (column) => column.twelveStars ? [`연 ${column.twelveStars.year}`, `일 ${column.twelveStars.day}`] : null],
  ]));
  board.append(element('p', '(지지)는 글자 자체의 분류, (간지)는 일주가 아닌 기둥의 간지 조합이에요. 12신살의 ‘연’은 연지 기준, ‘일’은 일지 기준이며 서로 합산하지 않아요.', 'manse-legend manse-support-note'));
  board.append(makeTable('원국 보조 정보', [
    ['지장간\n십성', 'text', (column) => column.branchTenGods],
    ['납음', 'text', (column) => column.naYin],
    ['공망', 'text', (column) => column.voidBranches?.join(' · ')],
  ]));
  board.append(element('p', '색은 오행, +는 양·−는 음을 뜻해요. 지지의 부호는 글자 기준으로 지장간 본기의 음양과는 별개예요. 좋고 나쁨의 점수는 아니에요.', 'manse-legend'));
  if (!view.facts.birthTimeKnown) board.append(element('p', '생시 모름: 시주는 채우지 않고 빈칸으로 남겼어요.', 'manse-legend'));
  const counts = element('p', null, 'manse-counts');
  counts.append(element('b', '본오행 글자 수'));
  for (const item of view.facts.literalCounts) counts.append(element('span', `${item.element} ${item.count}`));
  counts.append(element('small', `합계 ${view.facts.literalTotal}자`));
  board.append(counts, element('p', '귀인·신살의 —는 적용한 규칙에 해당 없음, 생시 모름 칸은 미확인이에요. 이름의 수는 길흉이나 성격의 점수가 아니에요.', 'manse-legend manse-support-note'));
  if (view.auspicious?.notes?.length) {
    const method = element('details', null, 'manse-method');
    method.append(element('summary', '귀인·신살 계산 기준과 지원 목록'));
    for (const note of view.auspicious.notes) method.append(element('p', note, 'manse-legend'));
    method.append(element('h5', '내 표에 표시된 근거'));
    const matches = element('dl', null, 'manse-match-list');
    for (const column of view.columns) {
      const entries = view.auspicious.matches.filter((match) => match.pillar === column.key);
      matches.append(element('dt', column.label));
      const description = element('dd');
      if (column.missing) description.append(element('p', '생시 모름 · 계산하지 않음'));
      else if (!entries.length) description.append(element('p', '지원 규칙에 해당하는 기본 귀인·신살 없음'));
      for (const match of entries) {
        const line = element('p');
        line.append(element('b', `${match.label} · ${match.layer === 'stem' ? '천간' : '지지'}`), element('span', match.basis));
        description.append(line);
      }
      matches.append(description);
    }
    method.append(matches, element('h5', '지원 항목과 12신살'));
    const catalog = element('dl', null, 'manse-catalog');
    for (const item of view.auspicious.catalog) {
      catalog.append(element('dt', `${item.label} · ${item.group}`), element('dd', `${item.description} ${item.ruleNote}`));
    }
    method.append(catalog, element('h5', '규칙 출처'));
    const sources = element('ul', null, 'manse-sources');
    for (const item of view.auspicious.sources) {
      const source = element('a', item.title);
      source.href = item.url; source.target = '_blank'; source.rel = 'noopener noreferrer';
      const li = element('li'); li.append(source); sources.append(li);
    }
    method.append(sources); board.append(method);
  }
  return board;
}

function renderChart(chart, result) {
  const mount = $('result-chart');
  mount.replaceChildren();
  if (!chart) return;
  if (chart.kind === 'saju') {
    const day = describeDayPillar(result);
    if (day) {
      const summary = element('div', null, 'day-pillar-summary');
      const card = element('section', null, 'day-pillar-card');
      card.setAttribute('aria-label', '나의 사주 일주');
      const name = element('h4', null, 'day-pillar-name');
      name.append(element('b', day.hanja), element('span', `${day.name} 일주`));
      card.append(element('p', '나의 일주', 'day-pillar-kicker'), name);
      const description = element('p', day.shortDescription, 'day-pillar-description');
      description.setAttribute('aria-label', '일주 상징으로 읽는 성향');
      summary.append(card, description);
      mount.append(summary);
    }
    const correction = sajuTimeCorrectionDisplay(result, { includePrivate: true });
    if (correction && (correction.applied || chart.timeCorrection?.method === 'local-mean-solar')) {
      const detail = element('details', null, 'saju-time-basis');
      detail.append(element('summary', correction.summary), element('p', [...correction.privateItems, correction.policy, ...correction.items].join('\n\n')));
      mount.append(detail);
    }
  } else if (chart.kind === 'ziwei') {
    const summary = element('div', null, 'chart-summary');
    const stars = chart.soulPalace.majorStars.map((star) => star.name).join(' · ') || '명궁 공궁';
    summary.append(element('b', `명궁 · ${stars}`), element('span', `${chart.fiveElementsClass} / ${chart.timeRange || chart.time}`));
    const detail = element('details', null, 'calculation-details');
    detail.append(element('summary', '12궁 주성 펼쳐보기'));
    const list = element('ul');
    for (const palace of chart.palaces) list.append(element('li', `${palace.name} (${palace.heavenlyStem}${palace.earthlyBranch}) · ${palace.majorStars.map((star) => star.name).join(' · ') || '주성 없음'}`));
    detail.append(list);
    mount.append(summary, detail);
  } else {
    const summary = element('div', null, 'chart-summary');
    summary.append(element('b', `${chart.symbol} ${chart.name}`), element('span', `${chart.element} · ${chart.modality}`));
    mount.append(summary);
  }
}
function renderMappingExplanation(mapping) {
  const article = element('article', null, 'mapping-explanation');
  article.append(element('h4', mapping.title), copyElement('p', mapping.source));
  const list = element('dl', null, 'mapping-axes');
  for (const axis of mapping.axes) {
    const row = element('div', null, 'mapping-axis');
    const title = element('dt');
    title.append(element('b', axis.letter), element('span', axis.name), element('small', axis.values));
    const description = element('dd');
    description.append(copyElement('p', axis.description), copyElement('p', axis.cause, 'mapping-cause'));
    row.append(title, description); list.append(row);
  }
  const details = element('details', null, 'mapping-source-details');
  details.append(element('summary', '오행·상징별 연결값 펼쳐보기'));
  for (const axis of mapping.axes) {
    details.append(element('h5', `${axis.name} · ${axis.pair}`));
    const terms = element('ul');
    terms.append(...axis.terms.map((term) => element('li', term))); details.append(terms);
  }
  article.append(list, copyElement('p', mapping.note, 'mapping-note'), details);
  return article;
}

function renderReading(result, input) {
  $('result-empty').hidden = true;
  $('result-content').hidden = false;
  $('result-reflection').hidden = false;
  $('result-kicker').textContent = `${modes[result.mode]}로 읽는 ${input.nickname || '나'}의 이야기 · MBTI 스타일`;
  $('result-type').textContent = result.type;
  $('result-title').textContent = result.title;
  setCopyText($('result-summary'), readingResultSummary(result));
  $('result-symbol').textContent = result.chart?.kind === 'zodiac' ? result.chart.symbol : result.mode === 'saju' ? '✿' : '☾';
  $('result-keywords').replaceChildren(...result.keywords.map((word) => element('span', `#${word}`)));
  const mapping = buildMappingExplanation(result);
  $('result-sections').replaceChildren(...result.sections.filter((section) => section.title !== '균형을 위한 질문'
    && !(section.title === '이 이야기의 중심' && result.summary.includes(section.text))
    && !(mapping && section.title === '네 글자로 연결한 이유')).map((section) => {
    const article = element('article');
    article.append(element('h4', section.title), copyElement('p', section.text));
    return article;
  }));
  if (mapping) $('result-sections').append(renderMappingExplanation(mapping));
  renderChart(result.chart, result);
  renderList('result-basis', result.basis);
  renderList('result-rules', result.calculation.rules);
  renderList('result-uncertainty', result.uncertainty);
  $('engine-version').textContent = `${result.calculation.engine} / ${result.calculation.version}`;
  $('result-content').focus({ preventScroll: true });
  if (window.innerWidth <= 700) $('result-panel').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (readingRecord.pending) return;
  $('form-error').textContent = '';
  $('result-panel').setAttribute('aria-busy', 'true');
  try {
    const mode = selectedMode();
    const input = {
      mode, nickname: form.elements.nickname.value.trim(), birthDate: form.elements.birthDate.value,
      birthTime: mode === 'zodiac' ? null : form.elements.birthTime.value || null,
      calendar: mode === 'zodiac' ? 'solar' : form.elements.calendar.value,
      leapMonth: mode !== 'zodiac' && form.elements.calendar.value === 'lunar' && form.elements.leapMonth.checked,
      gender: mode !== 'zodiac' ? form.elements.gender.value || null : null,
      ...(mode === 'saju' ? {
        birthplaceId: form.elements.birthplaceId.value || null,
        timeCorrection: form.elements.timeCorrection.checked ? 'local-mean-solar' : 'none',
      } : {}),
      ...(mode === 'ziwei' ? { ziweiReport: {
        mode: form.elements.ziweiReportMode.value,
        asOf: form.elements.ziweiAsOf.value || null,
        focus: form.elements.ziweiFocus.value,
      } } : {}),
    };
    const result = calculateReading(input);
    currentReading = result;
    currentInput = input;
    deliveryViewGeneration++;
    // Reset previous consent/contact whenever a new result is generated.
    deliveryForm.reset();
    $('delivery-message').textContent = '';
    $('delivery-message').classList.remove('success');
    renderReading(result, input);
    // Storage is tied to its explicitly named button, never ordinary viewing.
    const action = event.submitter?.value || 'view';
    if (action === 'save') void readingRecord.save({ input, result });
    else readingRecord.viewOnly();
    // The send action still only opens the delivery dialog; it does not POST.
    if (event.submitter?.value === 'send') {
      const phoneField = form.elements.namedItem('phone');
      const phone = validateOptionalPhone(phoneField?.value);
      if (!phone.valid) {
        $('form-error').textContent = phone.error;
        phoneField?.focus({ preventScroll: true });
      } else {
        void openDelivery({ phone: phone.value });
      }
    }
  } catch (error) {
    $('form-error').textContent = error instanceof Error ? error.message : '입력한 날짜와 시간을 다시 확인해 주세요.';
  } finally { $('result-panel').setAttribute('aria-busy', 'false'); }
});

async function downloadCurrentPdf(statusId) {
  if (!currentReading || pendingPdf) return;
  const reading = currentReading, input = currentInput;
  const buttons = ['download-result', 'detail-download-pdf', 'delivery-download-pdf'].map($);
  pendingPdf = true;
  buttons.forEach(button => { button.disabled = true; });
  $(statusId).textContent = '한글 글꼴과 표를 담아 PDF를 만들고 있어요…';
  try {
    const { downloadReadingPdf } = await import('./reading-pdf-export.js');
    await downloadReadingPdf({ reading, input, includeBirthData: true, localOnlyCorrection: true });
    $(statusId).textContent = 'PDF 파일을 만들었어요. 다운로드 목록 또는 기기의 저장·공유 메뉴를 확인해 주세요.';
  } catch {
    $(statusId).textContent = 'PDF를 만들지 못했어요. 네트워크 연결을 확인한 뒤 다시 눌러주세요. 화면의 결과는 그대로 남아 있어요.';
  } finally { pendingPdf = false; buttons.forEach(button => { button.disabled = false; }); }
}
$('download-result').addEventListener('click', () => { void downloadCurrentPdf('pdf-export-status'); });
$('detail-download-pdf').addEventListener('click', () => { void downloadCurrentPdf('detail-pdf-status'); });
$('delivery-download-pdf').addEventListener('click', () => { void downloadCurrentPdf('delivery-pdf-status'); });

async function updateServiceConfig() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('서비스 상태 확인 실패');
    serviceConfig = await response.json();
    const available = serviceConfig.collectionEnabled && (serviceConfig.deliveryConfigured?.email || serviceConfig.deliveryConfigured?.sms);
    $('delivery-fields').disabled = pendingDelivery || !available;
    $('collection-state').textContent = available
      ? '동의한 결과와 상세 풀이를 PDF로 첨부해 이메일로 보내드립니다. 발송 제공자 접수 후 수신함과 스팸함을 확인해 주세요.'
      : '이메일 발송 서비스 연결 전이라 이 창에서는 연락처를 받지 않습니다. 아래 PDF로 바로 저장을 이용하면 메일 신청 없이 보고서를 보관할 수 있어요.';
    for (const node of document.querySelectorAll('[data-result-delivery-state]')) node.textContent = available ? '요청한 이메일로 결과와 상세 풀이 PDF를 보냅니다. 발송 제공자 접수와 수신함 도착은 서로 다릅니다.' : '이메일 발송 서비스 연결 전입니다. PDF로 받기는 지금 바로 사용할 수 있어요.';
    $('operator-name').textContent = serviceConfig.operatorName || '설정 전 — 현재 수집하지 않음';
    $('contact-email').textContent = serviceConfig.contactEmail || '설정 전';
    $('retention-text').textContent = serviceConfig.retentionDays ? `신청일로부터 ${serviceConfig.retentionDays}일. 기간 만료 또는 삭제 요청 시 삭제합니다.` : '운영 전 보관기간 설정이 필요합니다.';
    const followup = $('followup-fields');
    if (followup) {
      followup.disabled = !serviceConfig.followupEnabled;
      $('meetup-purpose').textContent = serviceConfig.purposes?.followup || 'MBTI·별자리·사주 등 성향 이야기를 나누는 취미·교류 모임 일정 및 참가 안내';
    }
    return serviceConfig;
  } catch {
    serviceConfig = null;
    $('delivery-fields').disabled = true;
    $('collection-state').textContent = '이메일 발송 상태를 확인할 수 없어 연락처 입력을 잠갔습니다. PDF로 바로 저장은 사용할 수 있어요.';
    for (const node of document.querySelectorAll('[data-result-delivery-state]')) node.textContent = '성향 결과 발송 서비스 상태를 확인할 수 없어 결과 전달 신청을 잠갔습니다.';
    return null;
  }
}
async function updateParticipantInfo() {
  const sequence = ++participantInfoSequence;
  try {
    const response = await fetch('/api/participants/config', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('모임 신청 준비 상태 확인 실패');
    const config = await response.json();
    if (sequence !== participantInfoSequence) return;
    readingRecord.setConfig(config);
    for (const node of document.querySelectorAll('[data-participant-operator]')) node.textContent = config.operatorName || '운영 정보 확인 전';
    for (const node of document.querySelectorAll('[data-participant-contact]')) node.textContent = config.contactEmail || '문의처 확인 전';
    for (const node of document.querySelectorAll('[data-participant-retention]')) node.textContent = config.retentionDays ? `신청일로부터 ${config.retentionDays}일` : '보관기간 확인 전';
    $('meetup-collection-state').textContent = config.collectionEnabled ? '모임 관심 신청을 받고 있습니다. 장소와 일정은 준비 중이며 신청은 참가 확정이나 문자 발송 완료를 뜻하지 않습니다.' : '장소와 일정은 준비 중입니다. 모임 관심 신청 팝업에서 운영 정보와 DB 준비 상태를 확인한 뒤 신청을 받습니다.';
    $('privacy-participant-state').textContent = config.collectionEnabled ? '메인의 기록 저장 버튼 또는 모임 관심 신청 팝업의 신청으로만 DB에 저장합니다. 메인 입력 기록 저장은 홍보 수신 동의·모임 참가 확정·자동 발송을 뜻하지 않습니다.' : '현재 기록 저장은 준비 중입니다. 운영 정보와 DB 준비 상태가 확인되기 전에는 저장을 잠급니다.';
    const footerState = document.querySelector('.footer-info p');
    if (footerState) footerState.replaceChildren(...[
      config.operatorName || '운영 정보 확인 전',
      config.contactEmail ? `문의 ${config.contactEmail}` : '문의처 확인 전',
      config.retentionDays ? `모임 신청 ${config.retentionDays}일 보관` : '보관기간 확인 전',
    ].map((line) => element('span', line)));
  } catch {
    if (sequence !== participantInfoSequence) return;
    readingRecord.setConfig(null);
    for (const node of document.querySelectorAll('[data-participant-operator], [data-participant-contact], [data-participant-retention]')) node.textContent = '현재 서버 설정 확인 불가';
    $('meetup-collection-state').textContent = '모임 신청 준비 상태를 확인할 수 없습니다. 별도 신청 페이지에서 상태를 다시 확인해 주세요.';
    $('privacy-participant-state').textContent = '모임 신청 서비스 상태를 확인할 수 없어 운영 정보를 확정해 표시하지 않았습니다. 별도 신청 페이지에서 다시 확인해 주세요.';
    const footerState = document.querySelector('.footer-info p');
    if (footerState) footerState.replaceChildren(...['운영 정보 확인 불가', '모임 신청 팝업에서', '현재 정보를 다시 확인해 주세요.'].map((line) => element('span', line)));
  }
}
function setDeliveryContactChannel(channel) {
  const contact = deliveryForm.elements.contact;
  const sms = channel === 'sms';
  deliveryForm.elements.channel.value = channel;
  contact.type = sms ? 'tel' : 'email';
  contact.autocomplete = sms ? 'tel' : 'email';
  contact.placeholder = sms ? '010-0000-0000' : 'hello@example.com';
  const label = contact.labels?.[0];
  if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.nodeValue = sms ? '받을 휴대전화' : '받을 이메일';
}
async function openDelivery({ phone = '' } = {}) {
  if (!currentReading) return;
  const generation = ++deliveryViewGeneration;
  const dialog = $('delivery-dialog');
  $('delivery-fields').disabled = true;
  $('delivery-message').textContent = '';
  $('delivery-message').classList.remove('success');
  setDeliveryContactChannel('email');
  deliveryForm.elements.contact.value = '';
  if (!dialog.open) dialog.showModal();
  const config = await updateServiceConfig();
  if (!dialog.open || generation !== deliveryViewGeneration) return;
  if (pendingDelivery) { $('delivery-message').textContent = '이전 이메일 요청을 처리 중이에요. 완료되면 이 결과를 새로 신청할 수 있어요.'; return; }
  if (phone && config?.collectionEnabled && config.deliveryConfigured?.sms) {
    // This branch is available only after a real SMS service is configured.
    // The existing, separate result-delivery consent is still required.
    const option = deliveryForm.elements.channel.querySelector('option[value="sms"]');
    if (option) option.disabled = false;
    setDeliveryContactChannel('sms');
    deliveryForm.elements.contact.value = phone;
  } else if (phone) {
    $('delivery-message').textContent = '문자 발송은 준비 중입니다. 입력한 휴대전화는 서버로 전송하거나 신청 내역에 저장하지 않았습니다. 이메일 전달은 서비스가 준비되면 이 창에서 별도로 동의해 신청할 수 있어요.';
  }
}
$('open-delivery').addEventListener('click', () => { void openDelivery(); });
deliveryForm.elements.channel.addEventListener('change', () => {
  const channel = deliveryForm.elements.channel.value;
  if (channel === 'sms' && !(serviceConfig?.collectionEnabled && serviceConfig.deliveryConfigured?.sms)) {
    setDeliveryContactChannel('email');
    $('delivery-message').textContent = '문자 발송은 아직 준비 중입니다. 이메일 전달을 선택해 주세요.';
    return;
  }
  setDeliveryContactChannel(channel);
  deliveryForm.elements.contact.value = '';
});
$('reading-detail-button').addEventListener('click', () => {
  if (!currentReading || !currentInput) return;
  const detail = buildReadingDetail(currentReading, currentInput);
  $('reading-detail-label').textContent = detail.label;
  $('reading-detail-dialog').dataset.readingMode = currentReading.mode;
  $('reading-detail-dialog').classList.toggle('is-ziwei-report', currentReading.mode === 'ziwei');
  $('reading-detail-intro').hidden = currentReading.mode === 'ziwei';
  setCopyText($('reading-detail-intro'), detail.intro);
  const sections = detail.sections;
  const manse = currentReading.mode === 'saju' ? buildManseView(currentReading) : null;
  let lastGroup = '', chapterNumber = 0;
  $('reading-detail-sections').replaceChildren(...sections.flatMap((section, index) => {
    const output = [];
    const group = typeof section.groupLabel === 'string' ? section.groupLabel : '';
    if (group && group !== lastGroup) {
      lastGroup = group; chapterNumber++;
      const chapter = element('h3', null, 'reading-report-chapter');
      chapter.append(element('small', `CHAPTER ${String(chapterNumber).padStart(2, '0')}`), document.createTextNode(group.replace(/^\d+\s*[·.-]\s*/, '')));
      output.push(chapter);
    }
    const fullCycleTable = section.id === 'saju-da-yun' && section.table;
    const expandable = section.id === 'calculation' || fullCycleTable || section.collapsible === true;
    const article = element(expandable ? 'details' : 'section', null, `reading-detail-section${expandable ? ' reading-detail-method' : ''}`);
    const reportSection = Boolean(lastGroup);
    if (reportSection) article.classList.add('reading-report-section');
    if (section.id === 'saju-cycle-flow') article.classList.add('reading-detail-flow');
    if (expandable) article.append(element('summary', fullCycleTable ? '전체 대운표 펼쳐보기'
      : section.id === 'calculation' ? '내 풀이의 계산 근거' : `${section.title} 펼쳐보기`));
    else article.append(element('span', String(index + 1).padStart(2, '0'), 'reading-detail-number'), element(reportSection ? 'h4' : 'h3', section.id === 'ziwei-guidance' ? '[해석 안내]' : section.title));
    if (section.text) article.append(copyElement('p', section.id === 'ziwei-guidance' ? section.text.replace(/^\[해석 안내\]\s*/, '') : section.text));
    if (section.id === 'saju-chart') {
      if (manse) article.append(renderManseBoard(manse));
      else article.append(element('p', '원국의 세부 정보가 일치하지 않아 표를 표시하지 않았어요.'));
    } else if (section.table?.headers?.length && section.table?.rows?.length) {
      const wrapper = element('div', null, 'reading-detail-table-wrap');
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', section.table.caption || section.title);
      wrapper.tabIndex = 0;
      const table = element('table', null, 'reading-detail-table');
      if (section.table.headers.length <= 3) table.classList.add('is-compact');
      if (section.table.caption) table.append(element('caption', section.table.caption));
      const head = element('thead'), header = element('tr');
      for (const label of section.table.headers) {
        const cell = element('th', label); cell.scope = 'col';
        header.append(cell);
      }
      head.append(header);
      const body = element('tbody');
      for (const values of section.table.rows) {
        const row = element('tr');
        section.table.headers.forEach((label, column) => {
          const value = values[column] || '—';
          const cell = element(column === 0 ? 'th' : 'td');
          cell.textContent = value;
          if (column === 0) cell.scope = 'row';
          row.append(cell);
        });
        body.append(row);
      }
      table.append(head, body); wrapper.append(table);
      article.append(wrapper);
      if (section.table.headers.length > 3) article.append(element('p', '표가 화면보다 넓으면 옆으로 밀어 전체 내용을 볼 수 있어요.', 'reading-detail-table-hint'));
    }
    if (Array.isArray(section.paragraphs)) article.append(...section.paragraphs
      .filter((paragraph) => typeof paragraph === 'string' && paragraph.trim() && paragraph !== section.text)
      .map((paragraph, paragraphIndex) => reportParagraph(paragraph, section.id, paragraphIndex, section.highlights)));
    if (section.items?.length) {
      const list = element('ul');
      list.append(...section.items.map((item) => copyElement('li', item)));
      article.append(list);
    }
    if (section.id === 'calculation' && currentReading.mode === 'saju') {
      const correction = sajuTimeCorrectionDisplay(currentReading, { includePrivate: true });
      if (correction?.privateItems.length) article.append(...correction.privateItems.map((item) => element('p', item)));
    }
    output.push(article); return output;
  }));
  const notes = element('details');
  notes.append(element('summary', '풀이의 범위와 참고사항'), ...detail.notes.map((note) => copyElement('p', note)));
  $('reading-detail-notes').replaceChildren(...(currentReading.mode === 'ziwei' ? [notes] : [copyElement('p', '전통 상징을 쉽게 풀어 쓴 자기 탐색 이야기입니다. 실제 성격이나 미래를 확정하지 않아요.'), notes]));
  $('reading-detail-dialog').showModal();
});
$('privacy-button').addEventListener('click', () => { $('privacy-dialog').showModal(); void updateParticipantInfo(); void updateServiceConfig(); });
for (const close of document.querySelectorAll('[data-close]')) close.addEventListener('click', () => close.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
const syncDialogScroll = () => document.body.classList.toggle('has-dialog', Boolean(document.querySelector('dialog[open]')));
const dialogObserver = new MutationObserver(syncDialogScroll);
for (const dialog of document.querySelectorAll('dialog')) dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
window.addEventListener('pageshow', syncDialogScroll);
deliveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (pendingDelivery || !currentReading || !currentInput) return;
  const deliveryReading = currentReading, deliveryInput = currentInput;
  const generation = deliveryViewGeneration;
  const currentDeliveryView = () => generation === deliveryViewGeneration && deliveryReading === currentReading;
  const f = deliveryForm.elements;
  const channel = f.channel.value;
  const channelConfigured = channel === 'email' ? serviceConfig?.deliveryConfigured?.email
    : channel === 'sms' ? serviceConfig?.deliveryConfigured?.sms : false;
  if (!serviceConfig?.collectionEnabled || !channelConfigured) {
    $('delivery-message').textContent = channel === 'sms' ? '문자 발송은 준비 중이며 휴대전화를 전송하지 않았습니다.' : '결과 전달 서비스가 준비되기 전에는 연락처를 전송하지 않습니다.';
    return;
  }
  const storeBirthData = f.storeBirthData.checked;
  const followupConsent = f.followupConsent?.checked || false;
  const meetupTopics = followupConsent ? [...deliveryForm.querySelectorAll('[name="meetupTopics"]:checked')].map(input => input.value) : [];
  if (followupConsent && !meetupTopics.length) { $('delivery-message').textContent = '관심 있는 모임을 하나 이상 골라주세요.'; return; }
  const payload = {
    mode: currentReading.mode, storeBirthData, channel, contact: f.contact.value.trim(),
    // Technical calculation basis includes a date, so do not transmit it as
    // result prose. Birth information has its own separate optional consent.
    result: { type: currentReading.type, title: currentReading.title, summary: currentReading.summary, basis: [`${modes[currentReading.mode]}의 상징을 자체 규칙으로 해석`, `MBTI 스타일: ${currentReading.type}`, `키워드: ${currentReading.keywords.join(' · ')}`] },
    resultConsent: f.resultConsent.checked, ageConfirm14: f.ageConfirm14.checked,
    followupConsent, meetupTopics, consentVersion: serviceConfig.consentVersion,
  };
  if (currentInput.nickname) payload.nickname = currentInput.nickname;
  if (storeBirthData) {
    // Persist the equivalent solar date: the database field is explicitly solar.
    payload.birthDate = currentReading.calculation.details?.solarDate || currentInput.birthDate;
    if (currentInput.birthTime) payload.birthTime = currentInput.birthTime;
  }
  pendingDelivery = true;
  $('delivery-fields').disabled = true;
  $('delivery-message').textContent = '동의한 결과 보고서를 PDF 이메일로 준비하고 있어요…';
  try {
    let cached = deliveryDocuments.get(deliveryReading);
    if (!cached) { cached = {}; deliveryDocuments.set(deliveryReading, cached); }
    const documentKey = storeBirthData ? 'withBirth' : 'withoutBirth';
    if (!cached[documentKey]) {
      const { buildReadingPdfDocument } = await import('./reading-pdf-document.js');
      cached[documentKey] = buildReadingPdfDocument({ reading: deliveryReading, input: deliveryInput, includeBirthData: storeBirthData });
    }
    payload.document = cached[documentKey];
    const fingerprint = JSON.stringify(payload);
    if (!deliveryAttempt || deliveryAttempt.fingerprint !== fingerprint) deliveryAttempt = { fingerprint, requestKey: crypto.randomUUID() };
    payload.requestKey = deliveryAttempt.requestKey;
    const response = await fetch('/api/requests', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!currentDeliveryView()) return;
    if (!response.ok) throw new Error(data.error?.message || '신청을 저장하지 못했습니다.');
    $('delivery-message').textContent = data.status === 'sent' ? '발송 서비스가 PDF 이메일을 접수했어요. 수신함과 스팸함을 확인해 주세요. 수신함 도착 여부는 여기서 확인할 수 없어요.' : (data.message || '요청을 접수했어요. 아직 발송 완료 상태는 아니에요.');
    $('delivery-message').classList.add('success');
    if (data.status === 'sent') deliveryForm.reset();
  } catch (error) {
    if (currentDeliveryView()) $('delivery-message').textContent = error instanceof Error ? error.message : '전송에 실패했습니다. 다시 시도해 주세요.';
  } finally {
    pendingDelivery = false;
    $('delivery-fields').disabled = !(serviceConfig?.collectionEnabled && serviceConfig?.deliveryConfigured?.email);
    if (!currentDeliveryView() && $('delivery-dialog').open) $('delivery-message').textContent = '이전 요청 처리가 끝났어요. 지금 표시된 결과는 별도로 신청해 주세요.';
  }
});

// Original, code-native 3D ornaments. Static fallback remains if WebGL fails.
async function startOrbit() {
  try {
    const { default: initOrbit } = await import('./orbit.js');
    const cleanup = await initOrbit({ mount: $('orbit-scene'), toggle: $('motion-toggle'), reducedMotion: reducedMotion.matches || $('motion-toggle').getAttribute('aria-pressed') === 'true' });
    $('motion-toggle').hidden = false;
    window.addEventListener('pagehide', cleanup, {once:true});
  } catch { $('motion-toggle').hidden = true; }
}
updateMode();
// Browsers can restore checked radios after a navigation or reload. Synchronize
// the dependent calendar/time fields on the following paint as well.
window.addEventListener('pageshow', (event) => {
  requestAnimationFrame(updateMode);
  if (event.persisted) startOrbit();
  if (event.persisted) { void updateParticipantInfo(); void updateServiceConfig(); }
});
window.addEventListener('pagehide', () => { participantInfoSequence += 1; readingRecord.suspend(); });
void updateParticipantInfo();
void updateServiceConfig();
startOrbit();
