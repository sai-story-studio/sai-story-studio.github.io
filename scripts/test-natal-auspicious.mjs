import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateNatalAuspicious as calculate } from '../public/experience/natal-auspicious.js';
const stems=[...'甲乙丙丁戊己庚辛壬癸'],branches=[...'子丑寅卯辰巳午未申酉戌亥'];
const keys=['year','month','day','time'];
const awaitVendor=await readFile(new URL('../public/experience/vendor/lunar.js',import.meta.url),'utf8');
const pillar=(key,stem,branch)=>({key,stem,branch,ganZhi:stem+branch});
const vs=branch=>branches.indexOf(branch)%2?'乙':'甲';
const vb=stem=>stems.indexOf(stem)%2?'丑':'子';
function fixture(dayStem='甲',target='子',month='寅',dayBranch=vb(dayStem)) {
  return [pillar('year',vs(target),target),pillar('month',vs(month),month),pillar('day',dayStem,dayBranch),pillar('time','戊','辰')];
}
const clone=value=>JSON.parse(JSON.stringify(value));
let groups=0,assertions=0;
function eq(actual,expected){assert.deepEqual(actual,expected);assertions++;}
function check(label,run){run();groups++;console.log('PASS '+label);}
function has(result,key,layer,id){return result.matches.some(m=>m.id===id&&m.pillar===key&&m.layer===layer);}
check('all ten day stems × twelve targets: ten independent complete branch tables',()=>{
  const tables=[
    ['tianyi',['丑未','子申','亥酉','亥酉','丑未','子申','丑未','寅午','卯巳','卯巳']],
    ['wenchang',['巳','午','申','酉','申','酉','亥','子','寅','卯']],
    ['jinyu',['辰','巳','未','申','未','申','戌','亥','丑','寅']],
    ['wenqu',['亥','子','寅','卯','寅','卯','巳','午','申','酉']],
    ['taiji',['子午','子午','卯酉','卯酉','辰戌丑未','辰戌丑未','寅亥','寅亥','巳申','巳申']],
    ['luguan',['寅','卯','巳','午','巳','午','申','酉','亥','子']],
    ['yangren',['卯','','午','','午','','酉','','子','']],
    ['anlu',['亥','戌','申','未','申','未','巳','辰','寅','丑']],
    ['guangui',['巳','巳','申','申','亥','亥','寅','寅','申','申']],
    ['redcharm',['午','申','寅','未','辰','辰','戌','酉','子','申']],
  ];
  for(const [i,stem] of stems.entries()) for(const branch of branches){
    const result=calculate(fixture(stem,branch));assert.ok(result);
    for(const [id,targets] of tables) eq(has(result,'year','branch',id),targets[i].includes(branch));
    eq(has(result,'year','stem','tianyi'),false);
  }
});
check('modern Hakdang is month/time only, not natal Nayin school and not all four pillars',()=>{
  const expected=['亥','午','寅','酉','寅','酉','巳','子','申','卯'];
  for(const [i,stem] of stems.entries())for(const branch of branches){
    const input=fixture(stem,branch,branch);
    input[3]=pillar('time',vs(branch),branch);
    const result=calculate(input);
    eq(has(result,'month','branch','hakdang'),expected[i]===branch);
    eq(has(result,'time','branch','hakdang'),expected[i]===branch);
    eq(has(result,'year','branch','hakdang'),false);
    eq(has(result,'day','branch','hakdang'),false);
  }
});
check('all twelve month branches: TianDe and YueDe appropriate layer of every known pillar',()=>{
  const td=[['branch','巳'],['stem','庚'],['stem','丁'],['branch','申'],['stem','壬'],['stem','辛'],['branch','亥'],['stem','甲'],['stem','癸'],['branch','寅'],['stem','丙'],['stem','乙']];
  const yd=['壬','庚','丙','甲','壬','庚','丙','甲','壬','庚','丙','甲'];
  for(const [i,month]of branches.entries())for(const key of keys){
    const [layer,target]=td[i],input=fixture('甲','子',month);
    if(key!=='month') input[keys.indexOf(key)]=layer==='stem'?pillar(key,target,vb(target)):pillar(key,vs(target),target);
    let result=calculate(input);
    eq(has(result,key,layer,'tiande'),input[keys.indexOf(key)][layer]===target);
    eq(has(result,key,layer==='stem'?'branch':'stem','tiande'),false);
    if(key!=='month') input[keys.indexOf(key)]=pillar(key,yd[i],vb(yd[i]));
    result=calculate(input);
    eq(has(result,key,'stem','yuede'),input[keys.indexOf(key)].stem===yd[i]);
    eq(has(result,key,'branch','yuede'),false);
  }
  const input=fixture('丁','子','酉');input[3]=pillar('time','庚','戌');
  eq(has(calculate(input),'time','stem','yuede'),true);
  input[3]=pillar('time','甲','戌');input[3].hiddenStems=['庚'];
  eq(has(calculate(input),'time','stem','yuede'),false);
});
check('all sixty combinations: four classic Kuigang and seven modern Baihu, each whole pillar split into both layers',()=>{
  const kg=new Set(['壬辰','庚戌','戊戌','庚辰']),bh=new Set(['甲辰','乙未','丙戌','丁丑','戊辰','壬戌','癸丑']);
  for(let i=0;i<60;i++)for(const key of ['year','day','time']){
    const input=fixture();input[keys.indexOf(key)]=pillar(key,stems[i%10],branches[i%12]);
    const result=calculate(input),gz=input[keys.indexOf(key)].ganZhi;
    for(const layer of ['stem','branch']){
      eq(has(result,key,layer,'kuigang'),kg.has(gz));eq(has(result,key,layer,'baihu'),bh.has(gz));
    }
    if(key!=='day'&&kg.has(gz))assert.ok(result.byLayer[key].stem.includes('괴강살(간지)'));
  }
});
check('fixed branch families, Tianmen, five-character Xuanzhen and year seasonal Guchen/Guasu',()=>{
  for(const branch of branches){
    const result=calculate(fixture('甲',branch));
    eq(result.matches.some(m=>m.pillar==='year'&&m.id==='huagai'&&m.basis.startsWith('낱지지')),'辰戌丑未'.includes(branch));
    eq(result.matches.some(m=>m.pillar==='year'&&m.id==='taohua'&&m.basis.startsWith('낱지지')),'子午卯酉'.includes(branch));
    eq(result.byLayer.year.branch.includes('화개살(지지)'),'辰戌丑未'.includes(branch)&&!result.byLayer.year.branch.includes('화개살'));
    eq(result.byLayer.year.branch.includes('도화살(지지)'),'子午卯酉'.includes(branch)&&!result.byLayer.year.branch.includes('도화살'));
    eq(has(result,'year','branch','tianmen'),'戌亥'.includes(branch));
    eq(has(result,'year','branch','xuanzhen'),'卯午申'.includes(branch));
  }
  for(const stem of stems){
    const input=fixture();input[0]=pillar('year',stem,vb(stem));
    eq(has(calculate(input),'year','stem','xuanzhen'),'甲辛'.includes(stem));
  }
  const gs=['戌','戌','丑','丑','丑','辰','辰','辰','未','未','未','戌'];
  const gc=['寅','寅','巳','巳','巳','申','申','申','亥','亥','亥','寅'];
  for(const [i,base]of branches.entries())for(const target of branches){
    const input=fixture('甲',base);input[3]=pillar('time',vs(target),target);
    const result=calculate(input);
    eq(has(result,'time','branch','guasu'),target===gs[i]);eq(has(result,'time','branch','guchen'),target===gc[i]);
  }
});
check('12-shinsal complete independent 12×12 table: year and day remain separate, never merged into display rows',()=>{
  // Rows are target 子..亥; columns are the anchor 삼합 groups, independently transcribed.
  const names=['겁살','재살','천살','지살','연살','월살','망신살','장성살','반안살','역마살','육해살','화개살'];
  const tables={
    '寅午戌':[1,2,3,4,5,6,7,8,9,10,11,0],
    '申子辰':[7,8,9,10,11,0,1,2,3,4,5,6],
    '巳酉丑':[10,11,0,1,2,3,4,5,6,7,8,9],
    '亥卯未':[4,5,6,7,8,9,10,11,0,1,2,3],
  };
  for(const base of branches)for(const [i,target]of branches.entries()){
    const input=fixture(vs(base),base,'寅',base);input[3]=pillar('time',vs(target),target);
    const result=calculate(input),group=Object.keys(tables).find(g=>g.includes(base)),expected=names[tables[group][i]];
    eq(result.twelveByPillar.time,{year:expected,day:expected});
    eq(result.matches.filter(m=>m.pillar==='time'&&m.id.startsWith('twelve-')).length,2);
    eq(result.byPillar.time.includes(expected),['화개살'].includes(expected)&&result.byPillar.time.includes('화개살'));
  }
});
check('supplied public four-pillar example: all pictured thirteen types, all layers and distinct fixed/classical basis',()=>{
  const input=[['year','己卯'],['month','癸酉'],['day','丁丑'],['time','庚戌']].map(([key,gz])=>pillar(key,gz[0],gz[1]));
  const result=calculate(input),normalize=s=>s.replace(/\(.*?\)/g,'');
  const actual=new Set(Object.values(result.byPillar).flat().map(normalize));
  const expected=['천을귀인','문창귀인','문곡귀인','태극귀인','학당귀인','월덕귀인','괴강살','백호대살','화개살','천문성','과숙살','도화살','현침살'];
  for(const name of expected)eq(actual.has(name),true);
  eq(result.byLayer.time.stem,['월덕귀인','괴강살(간지)']);
  eq(result.byLayer.year.stem,[]);
  eq(result.byLayer.day.stem,['백호대살']);
  eq(result.twelveByPillar,{year:{year:'장성살',day:'재살'},month:{year:'재살',day:'장성살'},day:{year:'월살',day:'화개살'},time:{year:'천살',day:'반안살'}});
  const branchMatches=result.matches.filter(m=>m.id==='huagai'&&m.pillar==='day');
  assert.ok(branchMatches.some(m=>m.basis.includes('낱지지'))&&branchMatches.some(m=>m.basis.includes('일지')));
  eq(result.byLayer.day.branch.includes('화개살'),true);eq(result.byLayer.day.branch.includes('화개살(지지)'),false);
  eq(result.byPillar.day.includes('화개살(지지)'),false);
  // Both fixed and relational peach-blossom evidence remain, only one tag shows.
  const peach=calculate(fixture('甲','卯','寅','寅'));
  eq(peach.byLayer.year.branch.includes('도화살'),true);eq(peach.byLayer.year.branch.includes('도화살(지지)'),false);
  eq(peach.byPillar.year.includes('도화살(지지)'),false);
  const peachMatches=peach.matches.filter(m=>m.id==='taohua'&&m.pillar==='year');
  assert.ok(peachMatches.some(m=>m.basis.includes('낱지지'))&&peachMatches.some(m=>m.basis.includes('일지')));
  assert.equal(result.matches.some(m=>m.id==='huagai'&&m.pillar==='time'&&!m.basis.includes('낱지지')),false);
});
check('unknown time is null in every field; malformed, sparse, extra, missing and conflicting pillars fail closed',()=>{
  const result=calculate(fixture('辛','寅').slice(0,3));
  eq(result.byPillar.time,null);eq(result.byLayer.time,null);eq(result.twelveByPillar.time,null);
  eq(result.matches.some(m=>m.pillar==='time'),false);
  assert.match(result.notes.join(' '),/생시를 몰라.*전체 사주에 없다고 단정하지/);
  for(const input of [null,{},[],new Array(3),fixture().slice(0,2),[...fixture(),pillar('extra','甲','子')]])eq(calculate(input),null);
  for(const change of [
    a=>{a[0]=null;},a=>{a[0].key='day';},a=>{a[0].key='unknown';},a=>{a[0].ganZhi='乙丑';},
    a=>{a[0].stem='__proto__';},a=>{a[0]=pillar('year','甲','丑');},a=>{a[1].branch='<img>';},a=>{a[2].key='time';},
  ]){const input=fixture();change(input);eq(calculate(input),null);}
});
check('actual pinned vendor fixtures, 60 day cycle and unchanged source calculations',()=>{
  const sandbox={};vm.createContext(sandbox);
  vm.runInContext(awaitVendor,sandbox);
  function actual(y,m,d){
    const e=sandbox.Solar.fromYmdHms(y,m,d,8,37,0).getLunar().getEightChar();e.setSect(2);
    return ['Year','Month','Day','Time'].map(k=>pillar(k.toLowerCase(),e['get'+k+'Gan'](),e['get'+k+'Zhi']()));
  }
  const sample=calculate(actual(2005,12,23));
  eq(sample.byPillar.day.includes('천덕귀인'),true);eq(sample.byPillar.month.includes('문창귀인'),true);
  const geng=calculate(actual(2000,1,13));
  eq(geng.byLayer.day.stem.includes('천덕귀인'),true);eq(geng.byLayer.time.stem.includes('천덕귀인'),true);
  eq(geng.byLayer.day.stem.includes('월덕귀인'),true);eq(geng.byLayer.time.stem.includes('월덕귀인'),true);
  for(let day=1;day<=60;day++){
    const date=sandbox.Solar.fromYmd(2000,1,1).next(day-1),input=actual(date.getYear(),date.getMonth(),date.getDay()),before=JSON.stringify(input);
    const result=calculate(input);assert.ok(result);eq(JSON.stringify(input),before);
    eq(calculate([...input].reverse()),result);
    for(const key of keys)eq(result.byPillar[key],[...new Set([...result.byLayer[key].stem,...result.byLayer[key].branch])]);
  }
});
check('schema, source links, unique catalog IDs, supported count, determinism, immutability and no URL in PDF notes',()=>{
  const input=fixture('癸','卯'),before=JSON.stringify(input),result=calculate(input);
  eq(JSON.stringify(input),before);eq(calculate(input),result);eq(clone(result),result);
  eq(result.catalog.length,34);eq(result.supported.length,33);eq(new Set(result.catalog.map(i=>i.id)).size,34);
  eq(new Set(result.catalog.map(i=>i.description)).size,34);
  const ids=new Set(result.catalog.map(i=>i.id)),sourceIds=new Set(result.sources.map(i=>i.id));
  for(const item of result.catalog){assert.ok(item.description&&item.ruleNote&&sourceIds.has(item.sourceKey));}
  for(const match of result.matches){assert.ok(ids.has(match.id)&&sourceIds.has(match.sourceKey)&&match.basis&&match.label);assert.ok(keys.includes(match.pillar));assert.ok(['stem','branch'].includes(match.layer));}
  for(const key of keys)for(const layer of ['stem','branch'])eq(new Set(result.byLayer[key][layer]).size,result.byLayer[key][layer].length);
  for(const source of result.sources)assert.match(source.url,/^https:\/\/(luckclub\.cn|zh\.wikisource\.org|elderpine\.tistory\.com|www\.onstory\.fun|news\.nate\.com|www\.doilmun\.co\.kr|doc\.8-codes\.com)\//);
  eq(result.notes.length,3);assert.ok(result.notes.join('').length<=350);eq(/https?:\/\//.test(result.notes.join(' ')),false);
  assert.match(result.catalog.find(i=>i.id==='kuigang').ruleNote,/일격 성립으로 간주하지/);
  assert.match(result.catalog.find(i=>i.id==='hakdang').ruleNote,/납음 정학당과 다른/);
  result.catalog[0].label='mutated';result.sources[0].url='mutated';result.byLayer.year.branch.push('mutated');
  eq(JSON.stringify(input),before);eq(calculate(input).catalog[0].label,'천을귀인');
});
console.log('\n'+groups+' natal-symbol groups passed ('+assertions+' equality assertions plus structural checks). No requests or DB.');

