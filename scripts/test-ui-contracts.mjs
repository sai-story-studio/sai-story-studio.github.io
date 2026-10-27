import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import postcss from 'postcss';

const base = path.resolve('public/experience');
for (const file of ['style.css', 'participants.css', 'operators.css', 'admin-modern.css', 'detail-themes.css', 'detail-navigation.css', 'meetup-dialog.css']) {
  postcss.parse(fs.readFileSync(path.join(base, file), 'utf8'), { from: file });
}
for (const file of ['index.html', 'admin.html', 'join.html', 'participants.html', 'operators.html']) {
  const html = fs.readFileSync(path.join(base, file), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, `duplicate ID in ${file}`);
  for (const match of html.matchAll(/(?:href|src)="(\.\/[^\"]+)"/g)) {
    const local = match[1].split(/[?#]/)[0];
    assert.ok(fs.existsSync(path.resolve(base, local)), `missing ${local} in ${file}`);
  }
}
for (const file of fs.readdirSync(base).filter((name) => name.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join(base, file)], { stdio: 'pipe' });
}
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] || '{}').imports;
const releaseQuery = '?v=32-birthplace-completion';
const changedReleaseQuery = '?v=34-auto-solar-required';
const changedModules = new Set(['./app.js', './api-client.js', './birthplace-time.js', './join.js', './reading-records.js']);
const moduleEntries = [...html.matchAll(/<script type="module" src="(\.\/[^"?]+\.js)([^"]*)"/g)];
assert.equal(moduleEntries.length, 7);
assert.match(html, /href="\.\/style\.css\?v=32-birthplace-completion"/);
const visitedModules = new Set();
function checkModuleRefresh(specifier) {
  if (specifier.startsWith('./vendor/') || visitedModules.has(specifier)) return;
  visitedModules.add(specifier);
  const expectedQuery = changedModules.has(specifier) ? changedReleaseQuery : releaseQuery;
  assert.equal(importMap[specifier], `${specifier}${expectedQuery}`, `${specifier} must refresh whenever its source changes`);
  const source = fs.readFileSync(path.resolve(base, specifier), 'utf8');
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.\/[^'"]+\.js)['"]/g)) checkModuleRefresh(match[1]);
}
for (const [, entry, query] of moduleEntries) {
  assert.equal(importMap[entry], `${entry}${query}`, `${entry} entry and import-map URL must identify the same cached module`);
  checkModuleRefresh(entry);
}
assert.ok(visitedModules.size >= 27, 'static, popup, detail navigation and lazy PDF/report dependencies are covered by the import map');
assert.ok(html.includes('id="reading-detail-dialog"'));
assert.match(html, /id="reading-detail-top"[^>]*type="button"[^>]*aria-label="풀이 맨 위로 이동"[^>]*hidden/);
assert.equal(importMap['./detail-navigation.js'], `./detail-navigation.js${releaseQuery}`);
assert.ok(html.includes('PDF로 받기') && html.includes('id="detail-download-pdf"'));
assert.ok(!html.includes('결과 텍스트 저장') && !html.includes('텍스트로 저장'));
assert.ok(!html.includes('<details id="result-reflection"'));
assert.ok(!html.includes('id="phone-help"'));
assert.ok(html.includes('class="hero-korean"'));
assert.ok(html.includes('id="gender-label"') && html.includes('id="gender-help"'));
const app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
assert.match(html, /class="reading-method-description" aria-live="polite" aria-atomic="true"/);
assert.ok(html.includes('id="reading-method-name"') && html.includes('id="reading-method-description"'));
assert.ok(app.includes("$('reading-method-description').textContent = methodDescriptions[mode]"));
for (const phrase of ['태양궁', '여덟 글자와 오행', '12칸의 명반']) assert.ok(app.includes(phrase), `missing concise method definition: ${phrase}`);
const joinHtml = fs.readFileSync(path.join(base, 'join.html'), 'utf8');
assert.match(joinHtml, /http-equiv="refresh" content="0;url=\.\/index\.html#meetup-registration"/);
assert.ok(!joinHtml.includes('<form') && !joinHtml.includes('src="./join.js'), 'the old standalone signup page is only a compatibility redirect');
assert.equal(importMap['./join.js'], `./join.js${changedReleaseQuery}`);
assert.equal(importMap['./meetup-dialog.js'], `./meetup-dialog.js${releaseQuery}`);
assert.match(html, /<button[^>]*id="open-meetup-registration"[^>]*aria-controls="meetup-registration"/);
assert.match(html, /<dialog id="meetup-registration"[^>]*aria-labelledby="meetup-dialog-title"/);
assert.match(html, /<form id="join-form"/);
assert.match(html, /href="\.\/detail-themes\.css\?v=33-banner-weight"/);
assert.match(html, /href="\.\/meetup-dialog\.css\?v=32-birthplace-completion"/);
assert.ok(!html.match(/<input id="reading-phone"[^>]*>/)?.[0].includes('maxlength='), 'invalid pasted phone suffixes must not be silently truncated into a valid number');
assert.ok(!html.match(/<input name="phone"[^>]*>/)?.[0].includes('maxlength='));
assert.ok(app.includes("$('gender-field').hidden = !traditional"));
assert.ok(app.includes('form.elements.gender.required = traditional'));
assert.ok(app.includes('form.elements.gender.disabled = !traditional'));
assert.ok(app.includes("gender: mode !== 'zodiac' ? form.elements.gender.value || null : null"));
assert.ok(app.includes('buildMappingExplanation(result)') && app.includes('renderMappingExplanation(mapping)'));
assert.ok(app.includes("section.id === 'saju-da-yun' && section.table"));
const mainChartRenderer = app.slice(app.indexOf('function renderChart('), app.indexOf('function renderMappingExplanation('));
assert.ok(!mainChartRenderer.includes('renderManseBoard(') && !mainChartRenderer.includes('buildManseView('), 'main result stays compact; full natal tables belong in detail only');
assert.ok(mainChartRenderer.includes('day.hanja') && mainChartRenderer.includes('`${day.name} 일주`'));
assert.ok(!mainChartRenderer.includes('day.summary') && !mainChartRenderer.includes('day.note'), 'main day-pillar card shows only the compact name, not repeated long prose');
assert.ok(mainChartRenderer.includes('day.shortDescription') && mainChartRenderer.includes("'day-pillar-description'"), 'short symbolic copy appears beside the compact day-pillar card');
assert.ok(app.includes('buildManseView(currentReading)') && app.includes('renderManseBoard(manse)'));
assert.ok(app.includes("'manse-table'") && app.includes("section.id === 'saju-chart'"));
assert.ok(app.includes('section.groupLabel') && app.includes('section.paragraphs'));
const css = fs.readFileSync(path.join(base, 'style.css'), 'utf8');
assert.ok(css.includes("font-family: SAICaveat"));
assert.ok(css.includes("font-family: SAIInkLipquid"));
assert.ok(css.includes('.manse-table tbody tr:first-child > td:first-of-type { border-top-left-radius: 12px; }'));
assert.ok(css.includes('.manse-table tbody tr:last-child > td { border-bottom: 1px solid #c8c1ba; }'), 'last natal row overrides the global border reset');
const labelRule = css.match(/\.manse-table tbody th\s*\{([^}]+)\}/)?.[1] || '';
assert.ok(labelRule.includes('text-align: right') && labelRule.includes('4px 6px 4px 0'), 'row labels sit directly beside the natal grid');
assert.ok(css.includes('border-collapse: separate; border-spacing: 0;'));
const glyphRule = css.match(/\.manse-table \.manse-glyph-pair\s*\{([^}]+)\}/)?.[1] || '';
assert.ok(glyphRule.includes('top: 50%') && glyphRule.includes('left: 50%') && glyphRule.includes('translate(-50%, -50%)'));
const polarityRule = css.match(/\.manse-table \.manse-polarity\s*\{([^}]+)\}/)?.[1] || '';
assert.ok(polarityRule.includes('position: absolute') && polarityRule.includes('right: 4px') && polarityRule.includes('bottom: 4px'));
assert.ok(app.includes("makeTable('귀인·신살 · 천간과 지지'") && app.includes('column.auspiciousByLayer.stem') && app.includes('column.auspiciousByLayer.branch'));
assert.ok(app.includes('column.twelveStars.year') && app.includes('column.twelveStars.day'));
assert.ok(app.includes('귀인·신살 계산 기준과 지원 목록') && app.includes('match.basis') && app.includes('item.ruleNote'));
assert.ok(!app.includes('12신살·귀인·길성은 현재 미계산'));
const sky = fs.readFileSync(path.join(base, 'sky-motion.js'), 'utf8');
assert.ok(sky.includes("pageCanvas.dataset.density = '0.5'"));
assert.ok(sky.includes('window.scrollY'));

// Source-level UI contracts plus isolated, network-free simulations of the
// footer/navigation builders. These do not claim browser layout verification.
const cssTree = postcss.parse(css);
const calendarArrowRules = cssTree.nodes.filter(node => node.type === 'rule' && node.selector === '.calendar-field select');
assert.equal(calendarArrowRules.length, 1);
const calendarArrow = Object.fromEntries(calendarArrowRules[0].nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
assert.equal(calendarArrow.appearance, 'none');
assert.equal(calendarArrow['-webkit-appearance'], 'none');
assert.equal(calendarArrow['padding-right'], '44px');
assert.equal(calendarArrow['background-position'], 'right 16px center');
assert.equal(calendarArrow['background-size'], '12px 12px');
assert.ok(fs.existsSync(path.join(base, 'assets/select-chevron.svg')));
const forcedColors = cssTree.nodes.find(node => node.type === 'atrule' && node.name === 'media' && node.params === '(forced-colors: active)');
assert.ok(forcedColors?.toString().includes('appearance: auto') && forcedColors.toString().includes('background-image: none'));
function declaration(tree, selector, property) {
  let value;
  tree.walkRules((rule) => {
    if (rule.selector.split(',').map((part) => part.trim()).includes(selector)) {
      rule.walkDecls(property, (decl) => { value = decl.value; });
    }
  });
  return value;
}
const footer = html.match(/<footer class="site-footer">([\s\S]*?)<\/footer>/)?.[1] || '';
const footerInfo = footer.match(/<div class="footer-info">([\s\S]*?)<\/div>/)?.[1] || '';
assert.equal([...footerInfo.matchAll(/<(?:a|button)\b/g)].length, 2, 'footer information column has only privacy and operator-management controls');
assert.match(footerInfo, /<button\b[^>]*id="privacy-button"[^>]*>개인정보 안내<\/button>/);
assert.match(footerInfo, /<a href="\.\/operators\.html">운영자 관리<\/a>/);
assert.doesNotMatch(footerInfo, /\.\/(?:admin|participants)\.html/, 'private desks remain reachable through operator/menu navigation, not extra footer links');
const initialFooterLines = footerInfo.match(/<p>([\s\S]*?)<\/p>/)?.[1] || '';
assert.equal([...initialFooterLines.matchAll(/<span>/g)].length, 3, 'initial operator/contact/retention states use three separate lines');
assert.equal(declaration(cssTree, '.footer-info p > span', 'display'), 'block');
const footerUpdates = [...app.matchAll(/footerState\.replaceChildren\(\.\.\.\[[\s\S]*?\]\.map\(\(line\) => element\('span', line\)\)\);/g)].map((match) => match[0]);
assert.equal(footerUpdates.length, 2, 'both successful and failed configuration loads preserve the three-line footer');
for (const [index, source] of footerUpdates.entries()) {
  let rendered;
  vm.runInNewContext(source, {
    config: { operatorName: 'SYNTHETIC OPERATOR', contactEmail: 'synthetic@example.invalid', retentionDays: 90 },
    footerState: { replaceChildren(...children) { rendered = children; } },
    element: (tag, text) => ({ tag, text }),
  });
  assert.equal(rendered.length, 3, `footer state branch ${index} produces exactly three children`);
  assert.ok(rendered.every((node) => node.tag === 'span' && typeof node.text === 'string' && node.text.length > 0));
  if (index === 0) assert.deepEqual(rendered.map((node) => node.text), ['SYNTHETIC OPERATOR', '문의 synthetic@example.invalid', '모임 신청 90일 보관']);
}
assert.equal(declaration(cssTree, '.site-footer > .footer-main', 'position'), 'relative');
assert.equal(declaration(cssTree, '.site-footer > .footer-bottom', 'z-index'), '1');
assert.equal(declaration(cssTree, '.site-footer > .footer-main', 'z-index'), '1');
assert.equal(declaration(cssTree, '.site-footer > .footer-mini', 'z-index'), '0', 'animated footer star stays behind every footer text layer');
assert.ok(footer.indexOf('class="mini-scene footer-mini"') < footer.indexOf('class="wrap footer-main"'));

const shell = fs.readFileSync(path.join(base, 'site-shell.js'), 'utf8');
const navigationBuilders = shell.slice(0, shell.indexOf('const menuToggle'));
assert.ok(navigationBuilders.length > 0 && navigationBuilders.length < shell.length);
function navigationHost(className, initial) {
  const host = { children: [], classList: { contains: (name) => name === className },
    append(node) { node.parent = host; host.children.push(node); },
    querySelector(selector) { const href = selector.match(/^a\[href="([^"]+)"\]$/)?.[1]; return host.children.find((node) => node.href === href) || null; } };
  for (const href of initial) host.append(navigationLink(href));
  return host;
}
function navigationLink(href = '') {
  return { href, textContent: '', className: '', parent: null,
    after(node) { const host = this.parent; node.parent = host; host.children.splice(host.children.indexOf(this) + 1, 0, node); } };
}
const footerHost = navigationHost('footer-info', ['./operators.html']);
const menuHost = navigationHost('menu-inner', ['./operators.html']);
const navigationDocument = {
  querySelector: (selector) => selector === '.footer-info' ? footerHost : selector === '.menu-inner' ? menuHost : null,
  createElement: (tag) => { assert.equal(tag, 'a'); return navigationLink(); },
};
for (let repeat = 0; repeat < 2; repeat++) vm.runInNewContext(navigationBuilders, { document: navigationDocument });
assert.deepEqual(footerHost.children.map((node) => node.href), ['./operators.html'], 'shell never re-inserts participant/admin links into the reduced footer');
assert.deepEqual(menuHost.children.map((node) => node.href), ['./operators.html'], 'main menu keeps only the unified management entrance and insertion is idempotent');
assert.match(html, /class="menu-admin" href="\.\/operators\.html">운영자 관리<\/a>/);
assert.doesNotMatch(html.match(/class="menu-inner">([\s\S]*?)<\/dialog>/)?.[1] || '', /href="\.\/(?:admin|participants)\.html"/);
const emptyMenuHost = navigationHost('menu-inner', []);
vm.runInNewContext(navigationBuilders, { document: { ...navigationDocument, querySelector: (selector) => selector === '.menu-inner' ? emptyMenuHost : null } });
assert.deepEqual(emptyMenuHost.children.map((node) => node.href), ['./operators.html'], 'fallback adds only the management dashboard');
assert.match(html, /class="reading-heading"><div class="reading-heading-copy">/);
assert.match(html, /class="reading-heading-copy"><h2 id="reading-title">나의 성향 읽기<\/h2><p class="reading-method-description"[^>]*>[\s\S]*?<\/p><\/div><\/div>\s*<div class="reading-layout">/, 'the brief definition replaces the generic intro inside the left heading column');
assert.ok(!html.includes('생년월일로 시작해 보세요.'), 'the old generic intro is not duplicated beside the method definition');
assert.equal(declaration(cssTree, '.reading-heading', 'display'), 'grid');
const desktopHeading = cssTree.nodes.find((node) => node.type === 'rule' && node.selector === '.reading-heading');
assert.ok(desktopHeading.nodes.some((node) => node.prop === 'grid-template-columns' && node.value === 'minmax(0, 1fr) minmax(0, 1.05fr)'));
assert.equal(declaration(cssTree, '.reading-heading', 'column-gap'), 'var(--column-gap)');
assert.equal(declaration(cssTree, '.reading-heading .reading-method-description', 'margin'), '0');
for (const [property, value] of Object.entries({ padding: '0', border: '0', 'border-radius': '0', background: 'transparent', 'max-width': '100%' })) assert.equal(declaration(cssTree, '.reading-heading .reading-method-description', property), value);
for (const [property, value] of Object.entries({ 'font-size': '13px', position: 'relative', top: '5px' })) assert.equal(declaration(cssTree, '.reading-heading .reading-method-description', property), value);
assert.equal(declaration(cssTree, '.reading-method-description strong', 'white-space'), 'nowrap', 'the short method name stays together');
assert.ok(css.includes('.reading-heading { grid-template-columns: minmax(0, 1fr); row-gap: 16px; margin-bottom: 30px; }'));

const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] || '';
const headerLogo = header.match(/<a class="wordmark header-wordmark"[^>]*>([\s\S]*?)<\/a>/)?.[1] || '';
assert.equal(headerLogo.trim(), 'SAI STUDIO', 'main masthead stays one English wordmark, not a two-line duplicate');
assert.equal(declaration(cssTree, '.site-header', 'grid-template-columns'), '1fr auto 1fr', 'equal side tracks center the main masthead');
assert.equal(declaration(cssTree, '.site-header .header-wordmark', 'text-align'), 'center');
assert.equal(declaration(cssTree, '.site-header .header-wordmark', 'white-space'), 'nowrap');
assert.equal(declaration(cssTree, '.site-header .header-wordmark::before', 'content'), 'none', 'the old cropped artwork cannot duplicate the English masthead');
const operatorsHtml = fs.readFileSync(path.join(base, 'operators.html'), 'utf8');
const operatorsTree = postcss.parse(fs.readFileSync(path.join(base, 'operators.css'), 'utf8'));
const participantsHtml = fs.readFileSync(path.join(base, 'participants.html'), 'utf8');
const participantsTree = postcss.parse(fs.readFileSync(path.join(base, 'participants.css'), 'utf8'));
assert.match(operatorsHtml, /class="operators-brand"[^>]*><span>사이<\/span><small>SAI STUDIO<\/small>/);
assert.equal(declaration(operatorsTree, '.operators-page .operators-brand', 'display'), 'inline-flex');
assert.equal(declaration(operatorsTree, '.operators-page .operators-brand', 'flex-direction'), 'row');
assert.equal(declaration(operatorsTree, '.operators-page .operators-brand', 'align-items'), 'center');
assert.equal(declaration(operatorsTree, '.operators-page .operators-brand', 'white-space'), 'nowrap');
assert.match(participantsHtml, /class="p-brand"[^>]*><span class="p-brand-korean">사이<\/span><span class="p-brand-subtitle">PRIVATE DESK<\/span>/);
assert.equal(declaration(participantsTree, '.p-page .p-brand', 'display'), 'inline-flex');
assert.equal(declaration(participantsTree, '.p-page .p-brand', 'flex-direction') || 'row', 'row');
assert.equal(declaration(participantsTree, '.p-admin-page .p-brand', 'align-items'), 'center');
assert.equal(declaration(participantsTree, '.p-page .p-brand', 'white-space'), 'nowrap');
assert.equal(declaration(participantsTree, '.p-admin-page .p-brand .p-brand-korean', 'line-height'), '1');
assert.equal(declaration(participantsTree, '.p-admin-page .p-brand .p-brand-subtitle', 'line-height'), '1');
const operatorsHeader = operatorsHtml.match(/<header class="operators-header">([\s\S]*?)<\/header>/)?.[1] || '';
assert.doesNotMatch(operatorsHeader, /href="\.\/(?:admin|participants)\.html"/);
assert.ok(!operatorsHtml.includes('operators-quick-links'), 'duplicate desk navigation is removed');
for (const id of ['delivery-management', 'access-management', 'admin-content', 'operators-content', 'record-dialog', 'confirm-dialog', 'operator-confirm-dialog']) assert.ok(operatorsHtml.includes(`id="${id}"`));
assert.match(operatorsHtml, /href="\.\/participants\.html">체험·모임 기록 열기/);
assert.ok(operatorsHtml.indexOf('id="delivery-management"') < operatorsHtml.indexOf('id="access-management"'));
assert.match(fs.readFileSync(path.join(base, 'admin.html'), 'utf8'), /http-equiv="refresh" content="0;url=\.\/operators\.html#delivery-management"/);
assert.match(participantsHtml, /href="\.\/operators\.html#delivery-management"/);

const reportFields = html.match(/<fieldset id="ziwei-report-fields"([^>]*)>([\s\S]*?)<\/fieldset>/);
assert.ok(reportFields && /\bhidden\b/.test(reportFields[1]) && /\bdisabled\b/.test(reportFields[1]));
for (const field of ['ziweiReportMode', 'ziweiFocus', 'ziweiAsOf']) assert.ok(reportFields[2].includes(`name="${field}"`));
assert.doesNotMatch(reportFields[2], /ziweiCurrentAge|ziweiBoundary/);
assert.match(reportFields[2], /현재·다음 대운은 입력한 생년월일과 기준일로 자동 계산/);
assert.ok(app.includes("$('ziwei-report-fields').hidden = mode !== 'ziwei'") && app.includes("$('ziwei-report-fields').disabled = mode !== 'ziwei'"));
assert.ok(app.includes("...(mode === 'ziwei' ? { ziweiReport: {"));
assert.doesNotMatch(app, /ziweiCurrentAge|ziweiBoundary/);
for (const [property, field] of [['mode', 'ziweiReportMode'], ['focus', 'ziweiFocus'], ['asOf', 'ziweiAsOf']]) assert.ok(app.includes(`${property}: form.elements.${field}.value`));
assert.ok(app.includes('asOf: form.elements.ziweiAsOf.value,'), 'Ziwei requires a report date instead of silently falling back after it is cleared');
assert.ok(app.includes('requireReadingFields(mode)'));
for (const field of ['ziweiReportMode', 'ziweiFocus', 'ziweiAsOf']) assert.match(reportFields[2], new RegExp(`name="${field}"[^>]*\\brequired\\b`));
assert.ok(app.includes('reportBlocks(body)') && app.includes('section.highlights') && app.includes("'report-keypoint'"));
assert.equal(declaration(cssTree, '.reading-detail-section .report-paragraph .report-keypoint', 'font-weight'), '750');
assert.equal(declaration(cssTree, '.reading-detail-section .report-paragraph .report-block + .report-block', 'margin-top'), '17px');
assert.equal(declaration(cssTree, '.ziwei-report-options', 'grid-template-columns'), '1fr', 'narrow-screen report options have an explicit one-column override');
console.log('PASS CSS/HTML/modules, preserved footer/admin navigation, automatic Ziwei age UI, semantic personality highlights and intentional paragraph spacing. No server or personal data used.');
