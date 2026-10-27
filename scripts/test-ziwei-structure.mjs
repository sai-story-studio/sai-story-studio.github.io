import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildZiweiStructure as build } from '../public/experience/ziwei-structure.js';

const root = new URL('../public/experience/', import.meta.url), sandbox = {};
sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL('vendor/' + file, root), 'utf8'), sandbox, { filename: file });
const saved = Object.fromEntries(['Solar', 'Lunar', 'iztro'].map((key) => [key, globalThis[key]]));
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, iztro: sandbox.iztro });
const { calculateReading } = await import(new URL('reading-engine.js', root));
const plain = (value) => JSON.parse(JSON.stringify(value));
const defaults = { mode: 'ziwei', birthDate: '2000-08-16', birthTime: '03:37', gender: 'female', calendar: 'solar', leapMonth: false };
const config = { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'forward', algorithm: 'default' };
const read = (input = {}, options = { asOf: '2026-10-23' }) => calculateReading({ ...defaults, ...input }, options);
function direct(result, gender = 'female') {
  return sandbox.iztro.astro.withOptions({ type: 'solar', dateStr: result.chart.solarDate, timeIndex: result.calculation.details.timeIndex,
    gender, fixLeap: true, language: 'ko-KR', config });
}
let groups = 0, assertions = 0;
function eq(actual, expected) { assert.deepEqual(actual, expected); assertions++; }
function check(label, fn) { fn(); groups++; console.log('PASS ' + label); }
function issue(result, code) { return result.issues.some((item) => item.code === code); }
const base = read();
try {
  check('actual pinned palace decade ranges, birth summary and triad refs are copied, not current transits', () => {
    const vendor = direct(base), model = build(base);
    eq(model.status, 'verified'); eq(model.palaces.length, 12); eq(model.triads.length, 12); eq(model.majorStars.length, 14);
    eq(base.chart.bodyPalaceBranch, vendor.earthlyBranchOfBodyPalace); eq(base.chart.soulPalaceBranch, vendor.earthlyBranchOfSoulPalace);
    eq(base.chart.birthYearStem, vendor.rawDates.chineseDate.yearly[0]); eq(base.chart.birthLunarYear, vendor.rawDates.lunarDate.lunarYear);
    for (const p of base.chart.palaces) {
      const expected = vendor.palaces.find((v) => v.index === p.index);
      eq(p.decadal, plain(expected.decadal)); assert.equal('ages' in p, false);
      const s = vendor.surroundedPalaces(p.index);
      eq(base.chart.triadRefs.find((ref) => ref.targetIndex === p.index), { targetIndex: s.target.index, oppositeIndex: s.opposite.index, wealthIndex: s.wealth.index, careerIndex: s.career.index });
    }
    eq(model.decadals.table, Array.from(vendor.decadalList(), (row) => ({ palaceIndex: row.index, palaceName: row.palaceName,
      range: Array.from(row.ageRange), heavenlyStem: row.heavenlyStem, earthlyBranch: row.earthlyBranch })));
    eq(model.decadals.calculatedAge, 27); eq(model.decadals.ageSource, 'calculated'); eq(model.decadals.status, 'available');
    eq(model.decadals.current.range, [23,32]); eq(model.decadals.next.range, [33,42]);
    eq(model.decadals.ageConvention, 'nominal'); eq('horoscope' in model, false); eq('yearly' in model, false);
  });
  check('body palace is a location, not body/soul master star; all four structural positions are exact', () => {
    const model = build(base), vendor = direct(base), body = vendor.palaces.find((p) => p.isBodyPalace);
    eq(model.anchors.bodyIndex, body.index); eq(model.anchors.soulIndex, vendor.palace('命宫').index);
    eq(model.anchors.spiritIndex, vendor.palaces.find((p) => p.name === '복덕').index); assert.notEqual(base.chart.body, body.name);
    for (const ref of model.triads) {
      eq(ref.oppositeIndex, (ref.targetIndex + 6) % 12); eq(ref.wealthIndex, (ref.targetIndex + 8) % 12); eq(ref.careerIndex, (ref.targetIndex + 4) % 12);
    }
  });
  check('all ten yearly stems: independent canonical Lu/Quan/Ke/Ji table agrees with actual placements', () => {
    const stems = [...'甲乙丙丁戊己庚辛壬癸'];
    const expected = [['염정','파군','무곡','태양'],['천기','천량','자미','태음'],['천동','천기','문창','염정'],['태음','천동','천기','거문'],
      ['탐랑','태음','우필','천기'],['무곡','탐랑','천량','문곡'],['태양','무곡','태음','천동'],['거문','태양','문곡','문창'],['천량','자미','좌보','무곡'],['파군','거문','태음','탐랑']];
    const observed = new Set();
    for (let year = 1990; year < 2000; year++) {
      const result = read({ birthDate: year + '-08-16' }), model = build(result), index = stems.indexOf(result.chart.birthYearStem);
      observed.add(index); eq(model.mutagens.status, 'verified'); eq(model.mutagens.items.map((i) => i.star), expected[index]);
      eq(model.mutagens.items.map((i) => i.key), ['록','권','과','기']);
      for (const item of model.mutagens.items) {
        const p = model.palaces.find((p) => p.index === item.palaceIndex);
        eq(item.verified, true); assert.ok([...p.majorStars, ...p.minorStars].some((s) => s.name === item.star && s.mutagen === item.key));
      }
    }
    eq(observed.size, 10);
  });
  check('all 13 birth time sections × both genders: 14 majors, actual body flag, support types and three facts unchanged', () => {
    const times = ['00:37','01:37','03:37','05:37','07:37','09:37','11:37','13:37','15:37','17:37','19:37','21:37','23:37'];
    const brightness = new Set(); let emptySoul = null;
    for (const gender of ['male', 'female']) for (const birthTime of times) {
      const result = read({ gender, birthTime }), before = JSON.stringify(result), model = build(result), vendor = direct(result, gender);
      assert.ok(model); eq(model.status, 'verified'); eq(model.majorStars.length, 14); eq(new Set(model.majorStars.map((s) => s.name)).size, 14);
      eq(model.anchors.bodyIndex, vendor.palaces.find((p) => p.isBodyPalace).index); eq(model.mutagens.status, 'verified');
      eq(model.palaces.flatMap((p) => p.minorStars).filter((s) => s.type === 'soft').length, 6);
      eq(model.palaces.flatMap((p) => p.minorStars).filter((s) => s.type === 'tough').length, 6);
      for (const p of model.palaces) for (const s of [...p.majorStars, ...p.minorStars]) if (s.brightness) brightness.add(s.brightness);
      eq(JSON.stringify(result), before); eq(result.calculation.details.config, config);
      if (!result.chart.soulPalace.majorStars.length) emptySoul = result;
    }
    eq(brightness.size, 7); assert.ok(emptySoul);
    const model = build(emptySoul), soul = model.palaces.find((p) => p.index === model.anchors.soulIndex);
    eq(soul.majorStars, []); eq(emptySoul.calculation.details.mappingSource, 'oppositePalace');
    assert.ok(model.palaces.find((p) => p.index === (soul.index + 6) % 12).majorStars.length);
  });
  check('lunar leap-month halves and late-Zi new-year boundaries match direct vendor with normal year division', () => {
    for (const input of [
      { birthDate:'2020-04-15', calendar:'lunar', leapMonth:true, birthTime:'23:37' },
      { birthDate:'2020-04-16', calendar:'lunar', leapMonth:true },
      { birthDate:'2000-02-04', birthTime:'23:37' }, { birthDate:'2000-02-05', birthTime:'00:37' },
    ]) {
      const result = read(input), vendor = direct(result), model = build(result);
      eq(result.chart.birthYearStem, vendor.rawDates.chineseDate.yearly[0]); eq(model.status, 'verified');
      eq(model.decadals.table.length, 12); eq(model.mutagens.status, 'verified');
      eq(result.calculation.details.fixLeap, true); eq(result.calculation.details.config.yearDivide, 'normal');
    }
  });
  check('missing metadata is partial, never fabricated, and does not change natal 14-major facts', () => {
    const input = plain(base); delete input.chart.birthYearMutagens; delete input.chart.triadRefs; delete input.chart.bodyPalaceBranch;
    input.chart.palaces[0].decadal = null; delete input.chart.palaces[1].minorStars;
    const model = build(input);
    eq(model.status, 'partial'); eq(model.mutagens.status, 'missing'); eq(model.mutagens.items, []); eq(model.triads, []);
    eq(model.majorStars.length, 14); eq(model.decadals.status, 'missing'); eq(model.decadals.current, null);
    for (const code of ['BIRTH_MUTAGENS_MISSING','TRIADS_MISSING','BODY_BRANCH_MISSING','DECADAL_MISSING','STARS_MISSING']) eq(issue(model, code), true);
  });
  check('body flag/branch and triad contradictions are scoped conflicts with unsafe facts withheld', () => {
    let input = plain(base); input.chart.bodyPalaceBranch = '인';
    let model = build(input); eq(model.status, 'conflict'); eq(model.anchors.bodyIndex, null); eq(issue(model, 'BODY_BRANCH_CONFLICT'), true);
    input = plain(base); input.chart.palaces.find((p) => !p.isBodyPalace).isBodyPalace = true;
    model = build(input); eq(model.anchors.bodyIndex, null); eq(issue(model, 'BODY_PALACE_CONFLICT'), true);
    input = plain(base); input.chart.triadRefs[0].oppositeIndex = 0;
    model = build(input); eq(model.status, 'conflict'); eq(model.triads.length, 11); eq(issue(model, 'TRIAD_CONFLICT'), true);
    input = plain(base); input.chart.triadRefs[1] = input.chart.triadRefs[0];
    eq(issue(build(input), 'TRIAD_CONFLICT'), true);
  });
  check('canonical summary is independently checked; missing, swapped or duplicated palace tags stop Sihua interpretation', () => {
    for (const change of [
      r => { r.chart.birthYearMutagens.items.reverse(); },
      r => { r.chart.birthYearMutagens.source = '<img>'; },
      r => { r.chart.birthYearMutagens.yearStem = '甲'; },
      r => { r.chart.palaces.flatMap(p=>p.minorStars).find(s=>!s.mutagen).mutagen = '록'; },
      r => { r.chart.palaces.flatMap(p=>p.majorStars).find(s=>s.mutagen).mutagen = ''; },
    ]) {
      const input = plain(base); change(input);
      // Keep the duplicate soul summary synchronized only when a core star changes.
      input.chart.soulPalace = plain(input.chart.palaces.find(p=>p.name==='명궁'));
      const model = build(input); assert.ok(model); eq(model.mutagens.status, 'conflict'); eq(issue(model, 'BIRTH_MUTAGENS_CONFLICT'), true);
      eq(model.decadals.calculatedAge, 27); assert.ok(model.mutagens.conflicts.length);
    }
    const input = plain(base); input.chart.birthYearMutagens.items = null;
    const model = build(input); eq(model.mutagens.status, 'conflict'); eq(model.mutagens.items.every(i=>i.verified===false), true);
  });
  check('actual lunar nominal age selects current automatically; legacy manual values only cross-check', () => {
    const before = JSON.stringify(base), model = build(base, { mode:'DEEP', currentAge:27, boundary:'unknown', asOf:'2026-10-23', focus:'career' });
    eq(model.options.mode, 'DEEP'); eq(model.options.focus, 'career'); eq(model.decadals.status, 'available');
    eq(model.decadals.current.range, [23,32]); eq(model.decadals.next.range, [33,42]); eq(model.decadals.ageConflict, false);
    eq(model.decadals.ageSource, 'calculated'); eq(model.decadals.calculatedAge, 27);
    eq(model.decadals.referenceLunarYear, 2026); eq(model.decadals.birthLunarYear, 2000);
    eq(model.decadals.referenceDate, '2026-10-23'); eq(model.decadals.referenceDateSource, 'options');
    const conflict = build(base, { currentAge:40, asOf:'2026-10-23' });
    eq(conflict.decadals.status, 'age-conflict'); eq(conflict.decadals.current, null); eq(conflict.decadals.next, null); eq(conflict.decadals.inputAge, 40);
    eq(conflict.decadals.ageConflict, true); eq(issue(conflict, 'AGE_REFERENCE_CONFLICT'), true);
    const beforeBirth = build(base, { currentAge:1, asOf:'1999-08-16' }); eq(beforeBirth.decadals.ageConflict, true);
    eq(beforeBirth.decadals.status, 'reference-before-birth');
    const missing = plain(base); delete missing.chart.birthLunarYear;
    eq(build(missing, { currentAge:27, asOf:'2026-10-23' }).decadals.status, 'age-source-missing');
    eq(JSON.stringify(base), before);
  });
  check('start/end boundary ages provide both adjacent ranges; explicit user boundary remains disclosed', () => {
    let model = build(base, { currentAge:23, asOf:'2022-10-23', boundary:'no' });
    eq(model.decadals.boundary.isBoundary, true); eq(model.decadals.boundary.candidates.map(r=>r.range), [[13,22],[23,32]]);
    assert.ok(model.decadals.notes.some(n=>n.includes('경계 비해당 입력')));
    model = build(base, { currentAge:32, asOf:'2031-10-23' });
    eq(model.decadals.boundary.candidates.map(r=>r.range), [[23,32],[33,42]]);
    model = build(base, { currentAge:27, asOf:'2026-10-23', boundary:'yes' });
    eq(model.decadals.boundary.isBoundary, true); eq(model.decadals.boundary.candidates.length, 2);
    assert.ok(model.decadals.notes.some(n=>n.includes('이전 사용자 경계 입력')));
    model = build(base, { currentAge:122, asOf:'2121-10-23' });
    eq(model.decadals.next, null); eq(model.decadals.boundary.candidates.length, 1);
  });
  check('no manual age is needed; invalid overrides and out-of-table ages never invent periods', () => {
    for (const age of [null,undefined]) { const model=build(base,{currentAge:age});eq(model.decadals.calculatedAge,27);eq(model.decadals.status,'available'); }
    for (const age of [0, -1, 1.5, 151, '27', NaN]) {
      const model = build(base, { currentAge:age }); eq(model.decadals.current, null); eq(model.decadals.next, null);
      if (age != null) eq(model.decadals.status, 'invalid-age');
    }
    eq(build(base, { asOf:'2000-08-16' }).decadals.status, 'out-of-range');
    eq(build(base, { asOf:'2150-08-16' }).decadals.status, 'out-of-range');
    const invalid = plain(base); invalid.chart.palaces[0].decadal.range[1]++;
    const model = build(invalid, { currentAge:27 }); eq(model.decadals.status, 'conflict'); eq(model.decadals.current, null);
    const missing = plain(base); missing.chart.palaces[0].decadal = null;
    eq(build(missing, { currentAge:27 }).decadals.status, 'missing');
    const badDate = build(base, { currentAge:27, asOf:'2026-02-30' }); eq(badDate.options.asOf, null); eq(issue(badDate, 'INVALID_AS_OF'), true);
  });
  check('invalid 12-palace/14-major core, source summary disagreement and sparse arrays fail closed', () => {
    for (const input of [null, {}, { mode:'saju', chart:base.chart }]) eq(build(input), null);
    for (const change of [
      r=>{ r.chart.palaces.length=11; }, r=>{ r.chart.palaces[0]=null; }, r=>{ delete r.chart.palaces[0]; },
      r=>{ r.chart.palaces[0].index=1; }, r=>{ r.chart.palaces[0].name='명궁'; }, r=>{ r.chart.palaces[0].earthlyBranch='묘'; },
      r=>{ r.chart.palaces[0].heavenlyStem='을'; },
      r=>{ r.chart.palaces.find(p=>p.majorStars.length).majorStars[0].name='없는별'; },
      r=>{ r.chart.palaces.find(p=>p.majorStars.length).majorStars[0].brightness='wrong'; },
      r=>{ r.chart.palaces.find(p=>p.majorStars.length).majorStars=new Array(1); },
      r=>{ r.chart.soulPalace.index=11; }, r=>{ r.calculation.details.majorStars=['다른별']; },
      r=>{ const p=r.chart.palaces.find(p=>p.majorStars.length);p.majorStars.push(p.majorStars[0]); },
    ]) { const input=plain(base);change(input);eq(build(input),null); }
  });
  check('plain JSON, input/options immutability, deterministic frozen date and no runtime methods', () => {
    const input=plain(base), options={mode:'STANDARD', currentAge:27, asOf:'2026-10-23', focus:'wellbeing', boundary:'unknown'};
    const before=JSON.stringify(input), beforeOptions=JSON.stringify(options), result=build(input,options);
    eq(build(input,options),result);eq(plain(result),result);eq(JSON.stringify(input),before);eq(JSON.stringify(options),beforeOptions);
    result.palaces[0].majorStars.length=0;result.decadals.table[0].range[0]=999;result.mutagens.items[0].star='mutated';
    eq(JSON.stringify(input),before);eq(build(input,options).decadals.table[0].range[0],3);
    const noOptions=build(input);eq(noOptions.options.currentAge,null);eq(noOptions.options.asOf,'2026-10-23');
    eq(noOptions.decadals.calculatedAge,27);eq(noOptions.decadals.referenceDateSource,'chart');
    assert.ok(noOptions.notes.some(n=>n.includes('공궁')));assert.ok(noOptions.notes.some(n=>n.includes('유년')));
  });
  check('Lunar New Year, not Gregorian January first, changes the automatically calculated nominal age', () => {
    const result=read({birthDate:'2000-01-01'}),vendor=direct(result);
    eq(result.chart.birthLunarYear,1999);
    for(const year of [2022,2023,2024,2025,2026,2027]){
      const newYear=sandbox.Lunar.fromYmd(year,1,1).getSolar(),dates=[newYear.next(-1).toYmd(),newYear.toYmd()];
      const models=dates.map(asOf=>build(result,{asOf}));
      eq(models.map(m=>m.decadals.referenceLunarYear),[year-1,year]);
      eq(models[1].decadals.calculatedAge,models[0].decadals.calculatedAge+1);
      for(const [index,asOf]of dates.entries()){
        eq(models[index].decadals.calculatedAge,vendor.horoscope(asOf,0).age.nominalAge);
        eq(models[index].decadals.ageSource,'calculated');eq(models[index].decadals.ageConflict,false);
      }
    }
    eq(build(result,{asOf:'2026-01-01'}).decadals.calculatedAge,27);
    eq(build(result,{asOf:'2026-02-16'}).decadals.calculatedAge,27);
    eq(build(result,{asOf:'2026-02-17'}).decadals.calculatedAge,28);
    eq(build(result,{asOf:'2026-01-01',currentAge:28}).decadals.status,'age-conflict');
  });
  check('actual decade transition selects the next range exactly on its Lunar New Year date', () => {
    const before=build(base,{asOf:'2022-01-31'}),after=build(base,{asOf:'2022-02-01'}),vendor=direct(base);
    eq(before.decadals.calculatedAge,22);eq(before.decadals.current.range,[13,22]);
    eq(before.decadals.next.range,[23,32]);eq(before.decadals.nextTransitionDate,'2022-02-01');
    eq(after.decadals.calculatedAge,23);eq(after.decadals.current.range,[23,32]);
    eq(before.decadals.currentStartDate,sandbox.Lunar.fromYmd(2012,1,1).getSolar().toYmd());
    eq(after.decadals.currentStartDate,'2022-02-01');
    eq(after.decadals.current.palaceIndex,before.decadals.next.palaceIndex);
    eq(before.decadals.current.palaceIndex,vendor.horoscope('2022-01-31',0).decadal.index);
    eq(after.decadals.current.palaceIndex,vendor.horoscope('2022-02-01',0).decadal.index);
    eq(after.decadals.nextTransitionDate,sandbox.Lunar.fromYmd(2032,1,1).getSolar().toYmd());
    eq(after.decadals.boundary.isBoundary,true);eq(after.decadals.boundary.candidates.map(r=>r.range),[[13,22],[23,32]]);
  });
  check('late-Zi before New Year keeps the original civil DOB lunar year for age, independently of star day advance', () => {
    for(const birthTime of ['00:37','22:37','23:37','23:59']){
      const result=read({birthDate:'2026-02-16',birthTime}),vendor=direct(result);
      eq(result.chart.birthLunarYear,2025);eq(result.chart.birthLunarYear,vendor.rawDates.lunarDate.lunarYear);
      eq(result.chart.birthLunarYear,sandbox.Solar.fromYmd(2026,2,16).getLunar().getYear());
      for(const [asOf,expected]of [['2026-02-16',1],['2026-02-17',2],['2027-02-06',3]]){
        const model=build(result,{asOf});eq(model.decadals.calculatedAge,expected);
        eq(model.decadals.calculatedAge,vendor.horoscope(asOf,0).age.nominalAge);
        eq(model.decadals.birthLunarYear,2025);eq(model.decadals.ageSource,'calculated');
      }
    }
    const nextDay=read({birthDate:'2026-02-17',birthTime:'00:37'});
    eq(build(nextDay,{asOf:'2026-02-17'}).decadals.calculatedAge,1);
  });
  check('lunar leap dates and the 1900 lower-bound civil date use real lunar birth years, never Gregorian shortcuts', () => {
    for(const birthDate of ['2020-04-15','2020-04-16','2020-04-29']){
      const result=read({birthDate,calendar:'lunar',leapMonth:true,birthTime:'23:37'}),vendor=direct(result);
      for(const asOf of ['2026-02-16','2026-02-17']){
        const model=build(result,{asOf});eq(model.decadals.calculatedAge,vendor.horoscope(asOf,0).age.nominalAge);
        eq(model.decadals.birthLunarYear,2020);eq(model.decadals.ageSource,'calculated');
      }
    }
    const lower=read({birthDate:'1900-01-01'}),vendor=direct(lower),model=build(lower,{asOf:'2026-10-23'});
    eq(model.decadals.birthLunarYear,1899);eq(model.decadals.calculatedAge,vendor.horoscope('2026-10-23',0).age.nominalAge);
    eq(model.decadals.calculatedAge,128);eq(model.decadals.status,'out-of-range');eq(model.decadals.current,null);eq(model.decadals.next,null);
  });
  check('explicit future reference dates are scenarios, allowed without pretending that they are today', () => {
    const model=build(base,{asOf:'2090-08-16'});
    eq(model.decadals.referenceDate,'2090-08-16');eq(model.decadals.referenceLunarYear,2090);
    eq(model.decadals.calculatedAge,91);eq(model.decadals.status,'available');eq(model.decadals.current.range,[83,92]);
    assert.match(model.decadals.notes.join(' '),/미래라면.*오늘의 실제 상태나 사건 예언이 아닙니다/);
    eq(build(base,{asOf:'9999-13-01'}).decadals.status,'reference-required');
    eq(build(base,{asOf:'1899-12-31'}).decadals.status,'reference-required');
  });
  check('missing/conflicting DOB metadata and unsupported age convention cannot be overridden manually', () => {
    const missingDate=plain(base);delete missingDate.chart.solarDate;
    eq(build(missingDate,{currentAge:27}).decadals.status,'age-source-missing');
    const missingYear=plain(base);delete missingYear.chart.birthLunarYear;
    eq(build(missingYear,{currentAge:27}).decadals.ageSource,'unavailable');
    const wrongYear=plain(base);wrongYear.chart.birthLunarYear=1999;
    const yearConflict=build(wrongYear);eq(yearConflict.decadals.status,'age-conflict');eq(yearConflict.decadals.current,null);
    eq(yearConflict.decadals.calculatedAge,null);eq(issue(yearConflict,'BIRTH_LUNAR_YEAR_CONFLICT'),true);
    const wrongDate=plain(base);wrongDate.calculation.details.solarDate='2000-08-17';
    eq(build(wrongDate).decadals.status,'age-conflict');
    const unsupported=plain(base);unsupported.calculation.details.config.ageDivide='birthday';
    eq(build(unsupported).decadals.status,'unsupported-age-convention');
    const noReference=plain(base);delete noReference.chart.referenceDate;
    eq(build(noReference,{currentAge:27}).decadals.status,'reference-required');
    eq(build(noReference,{asOf:'2026-10-23'}).decadals.calculatedAge,27);
  });
  check('calendar absence/failure never falls back to Gregorian subtraction; unavailable transition dates stay null', () => {
    const originalSolar=globalThis.Solar,originalLunar=globalThis.Lunar;
    try{
      globalThis.Solar=undefined;let model=build(base);eq(model.decadals.status,'calendar-unavailable');eq(model.decadals.calculatedAge,null);eq(model.decadals.current,null);
      globalThis.Solar={fromYmd(){throw new Error('synthetic calendar failure');}};
      model=build(base);eq(model.decadals.status,'calendar-unavailable');eq(model.decadals.ageSource,'unavailable');
      globalThis.Solar=originalSolar;globalThis.Lunar=undefined;model=build(base);
      eq(model.decadals.status,'available');eq(model.decadals.calculatedAge,27);eq(model.decadals.currentStartDate,null);eq(model.decadals.nextTransitionDate,null);
    }finally{globalThis.Solar=originalSolar;globalThis.Lunar=originalLunar;}
  });
  check('explicit timestamp offsets freeze the Seoul date across Lunar New Year; unzoned timestamps stay Seoul civil time', () => {
    for(const asOf of ['2026-02-16T16:00:00Z','2026-02-16T16:00:00.000Z','2026-02-16T16:00:00+00:00','2026-02-17T01:00:00+09:00']){
      const result=read({}, {asOf});eq(result.chart.referenceDate,'2026-02-17');eq(build(result).decadals.calculatedAge,27);
    }
    const newYearBirth=read({birthDate:'2000-01-01'},{asOf:'2026-02-16T16:00:00Z'});
    eq(newYearBirth.chart.referenceDate,'2026-02-17');eq(build(newYearBirth).decadals.calculatedAge,28);
    eq(read({}, {asOf:'2026-02-16 23:59:59'}).chart.referenceDate,'2026-02-16');
    eq(read({}, {asOf:'2026-02-16T23:59:59'}).chart.referenceDate,'2026-02-16');
    eq(read({}, {asOf:'2026-02-17T08:00:00+10:00'}).chart.referenceDate,'2026-02-17');
    eq(read({}, {asOf:'2026-02-17T00:00:00+10:00'}).chart.referenceDate,'2026-02-16');
    for(const asOf of ['2026-02-30T16:00:00Z','2026-02-16T24:00:00Z','2026-02-16T16:60:00Z','2026-02-16T16:00:60Z','2026-02-16T16:00:00+24:00','2026-02-16 arbitrary']){
      eq(read({}, {asOf}).chart.referenceDate,null);
    }
  });
  check('engine freezes its Seoul reference date and helper has no clock dependency; all other readings and weights remain unchanged', () => {
    const earlier=read({}, {asOf:'2026-02-16'}),later=read({}, {asOf:'2090-08-16'});
    for(const key of ['type','summary','title','keywords','sections','basis','calculation'])eq(earlier[key],later[key]);
    eq(earlier.chart.palaces,later.chart.palaces);eq(earlier.chart.referenceDate,'2026-02-16');eq(later.chart.referenceDate,'2090-08-16');
    const frozen=read({},{});assert.match(frozen.chart.referenceDate,/^\d{4}-\d{2}-\d{2}$/);
    eq(build(frozen).decadals.referenceDate,frozen.chart.referenceDate);
    const invalid=read({}, {asOf:'2026-02-30'});eq(invalid.chart.referenceDate,null);eq(build(invalid).decadals.status,'reference-required');
    const snapshot=build(base),originalDate=globalThis.Date;
    try{
      globalThis.Date=class extends originalDate{constructor(...args){if(!args.length)throw new Error('Clock access forbidden in helper');super(...args);}};
      eq(build(base),snapshot);
    }finally{globalThis.Date=originalDate;}
    for(const mode of ['zodiac','saju']){
      const one=read({mode},{asOf:'2026-10-23 12:00:00'}),two=read({mode},{asOf:'2026-10-23 12:00:00'});
      eq(one,two);eq('referenceDate' in one.chart,false);
    }
  });
  console.log('\n'+groups+' ziwei-structure groups passed ('+assertions+' equality assertions plus structural checks). Synthetic/local vendor only; no requests or DB.');
} finally { Object.assign(globalThis,saved); }
