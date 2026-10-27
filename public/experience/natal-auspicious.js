/**
 * Natal correspondences, NOT daily almanac 吉神, diagnosis or prediction.
 * Independently transcribed tables; primary editions/identified authors are
 * listed in SOURCES. SAI display extensions are explicitly labeled per match.
 * Pure data only: no calendar calls, DOM, network, storage or input mutation.
 */
const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const KEYS = ['year', 'month', 'day', 'time'];
const KEY_NAMES = { year: '연', month: '월', day: '일', time: '시' };
const SOURCES = [
  { id: 'tan-yuan', title: '명리탐원 권삼 원문 · 천을·문창·금여·천덕·월덕', url: 'https://luckclub.cn/bazi/009/004/' },
  { id: 'sanming', title: '고금도서집성 수록 삼명통회 · 태극·십간록 원문', url: 'https://zh.wikisource.org/zh/欽定古今圖書集成/博物彙編/藝術典/第599卷' },
  { id: 'sanming-branches', title: '삼명통회 권이 · 장성·화개·함지 원문', url: 'https://zh.wikisource.org/wiki/三命通會/卷二' },
  { id: 'yuanhai', title: '연해자평 · 괴강 일격 원문', url: 'https://zh.wikisource.org/wiki/淵海子平' },
  { id: 'wuxing', title: '오행정기 · 고진과숙·현침 문자 원문', url: 'https://zh.wikisource.org/wiki/五行精紀' },
  { id: 'kim-literary', title: '김실근 본인 강좌 · 현대 한국 문곡·학당표', url: 'https://elderpine.tistory.com/m/11302843' },
  { id: 'onstory', title: '온스토리 개발자 공개 신살 기술표 · 현대 한국표', url: 'https://www.onstory.fun/doc/programming/saju/sinsal' },
  { id: 'noh-baihu', title: '노병한 본인 칼럼 · 원국 네 기둥의 백호 7간지', url: 'https://news.nate.com/view/20241230n03485' },
  { id: 'kim-tianmen', title: '김현성 본인 사주자료 · 술해 천문성 (색인 원문 확인)', url: 'https://www.doilmun.co.kr/bbs/board.php?bo_table=sub06_04&me_code=6040&wr_id=124' },
  { id: 'jeonghae', title: '정해 만세력 공식 강의 · 연지·일지 기준 12신살표', url: 'https://doc.8-codes.com/docs/lecture/19/' },
];
const TIANYI = ['丑未','子申','亥酉','亥酉','丑未','子申','丑未','寅午','卯巳','卯巳'];
const WENCHANG = ['巳','午','申','酉','申','酉','亥','子','寅','卯'];
const JINYU = ['辰','巳','未','申','未','申','戌','亥','丑','寅'];
const WENQU = ['亥','子','寅','卯','寅','卯','巳','午','申','酉'];
const HAKDANG = ['亥','午','寅','酉','寅','酉','巳','子','申','卯'];
const TAIJI = ['子午','子午','卯酉','卯酉','辰戌丑未','辰戌丑未','寅亥','寅亥','巳申','巳申'];
const LUGUAN = ['寅','卯','巳','午','巳','午','申','酉','亥','子'];
const YANGREN = ['卯','','午','','午','','酉','','子',''];
const ANLU = ['亥','戌','申','未','申','未','巳','辰','寅','丑'];
const GUANGUI = ['巳','巳','申','申','亥','亥','寅','寅','申','申'];
const REDCHARM = ['午','申','寅','未','辰','辰','戌','酉','子','申'];
const TIANDE = {
  寅:['stem','丁'],卯:['branch','申'],辰:['stem','壬'],巳:['stem','辛'],
  午:['branch','亥'],未:['stem','甲'],申:['stem','癸'],酉:['branch','寅'],
  戌:['stem','丙'],亥:['stem','乙'],子:['branch','巳'],丑:['stem','庚'],
};
const YUEDE = {寅:'丙',午:'丙',戌:'丙',申:'壬',子:'壬',辰:'壬',亥:'甲',卯:'甲',未:'甲',巳:'庚',酉:'庚',丑:'庚'};
const KUIGANG = ['壬辰','庚戌','戊戌','庚辰'];
const BAIHU = ['甲辰','乙未','丙戌','丁丑','戊辰','壬戌','癸丑'];
const TWELVE = ['겁살','재살','천살','지살','연살','월살','망신살','장성살','반안살','역마살','육해살','화개살'];
const GROUPS = [
  {branches:'寅午戌',start:'亥',huagai:'戌',taohua:'卯'},
  {branches:'申子辰',start:'巳',huagai:'辰',taohua:'酉'},
  {branches:'巳酉丑',start:'寅',huagai:'丑',taohua:'午'},
  {branches:'亥卯未',start:'申',huagai:'未',taohua:'子'},
];
const MEANINGS = {
  tianyi:'도움과 조율, 서로의 빈틈을 채우는 협력의 상징입니다.',
  wenchang:'배움과 표현, 생각을 글과 말로 다듬는 상징입니다.',
  jinyu:'정돈과 품위, 자신의 생활을 소중히 가꾸는 상징입니다.',
  tiande:'배려와 완충, 날카로운 상황을 부드럽게 다루는 상징입니다.',
  yuede:'관용과 협력, 주변과 접점을 찾는 태도의 상징입니다.',
  wenqu:'사색과 창작, 배운 것을 자기 언어로 풀어내는 상징입니다.',
  taiji:'시작과 마무리, 흐름 전체를 살피는 상징입니다.',
  hakdang:'학습과 탐구, 차근차근 익히고 연습하는 상징입니다.',
  kuigang:'주관과 결단, 뚜렷한 기준을 세우는 상징입니다.',
  baihu:'집중과 추진, 강한 에너지를 신중하게 쓰는 상징입니다.',
  huagai:'몰입과 성찰, 혼자 깊이 파고드는 시간의 상징입니다.',
  tianmen:'근원과 의미의 탐구, 눈에 보이지 않는 원리를 묻는 상징입니다.',
  guasu:'고요와 독립, 혼자 생각을 정리하는 여백의 상징입니다.',
  taohua:'표현과 교류, 자신만의 매력을 드러내는 상징입니다.',
  xuanzhen:'세밀함과 예리함, 작은 차이를 살피는 상징입니다.',
  luguan:'자립과 숙련, 익힌 역량을 꾸준히 사용하는 상징입니다.',
  yangren:'주도성과 힘, 에너지의 방향을 의식하는 상징입니다.',
  anlu:'드러나지 않는 지원과 준비, 뒤에서 쌓는 기반의 상징입니다.',
  guangui:'배움의 틀과 역할, 익힌 지식을 체계화하는 상징입니다.',
  redcharm:'감각과 개성, 생생하게 자신을 표현하는 상징입니다.',
  doctor:'돌봄과 회복의 관심, 일상의 균형을 살피는 상징입니다.',
  guchen:'독립과 자기 충전, 자신의 속도를 찾는 상징입니다.',
  'twelve-0':'경쟁과 경계, 지키고 나눌 몫을 돌아보는 상징입니다.',
  'twelve-1':'외부 변수와 대응, 상황을 살피고 조정하는 상징입니다.',
  'twelve-2':'큰 흐름과 수용, 뜻대로 되지 않는 부분을 살피는 상징입니다.',
  'twelve-3':'이동과 활동, 새로운 자리에 적응하는 상징입니다.',
  'twelve-4':'주목과 교류, 사람들 사이에 자신을 드러내는 상징입니다.',
  'twelve-5':'멈춤과 재정비, 익숙한 기반을 돌아보는 상징입니다.',
  'twelve-6':'노출과 점검, 바깥에 보이는 모습을 살피는 상징입니다.',
  'twelve-7':'중심과 책임, 방향을 잡고 이끄는 상징입니다.',
  'twelve-8':'발판과 연결, 다음 단계의 준비를 갖추는 상징입니다.',
  'twelve-9':'이동과 변화, 자리를 바꾸며 경험을 넓히는 상징입니다.',
  'twelve-10':'관계의 간격과 조율, 서로 다른 속도를 살피는 상징입니다.',
  'twelve-11':'정리와 깊이, 경험을 안으로 모아 되새기는 상징입니다.',
};
function definition(id,label,group,sourceKey,ruleNote) {
  return {id,label,group,description:MEANINGS[id],ruleNote,sourceKey};
}
const CATALOG = [
  definition('tianyi','천을귀인','귀인','tan-yuan','명리탐원 일간표. 갑·무·경은 축미, 신은 인오. 주야 효력은 판정하지 않습니다.'),
  definition('wenchang','문창귀인','귀인','tan-yuan','명리탐원 일간표로 실제 지지를 대조합니다. 삼명통회의 다른 문창표와 혼합하지 않습니다.'),
  definition('jinyu','금여록','귀인','tan-yuan','명리탐원 일간표로 실제 지지를 대조합니다.'),
  definition('tiande','천덕귀인','귀인','tan-yuan','절입 월지표. 연해자평의 곤신·건해·간인·손사 독법입니다. 원문의 일주 우선과 구별하여 알려진 모든 기둥의 해당 층 일치를 표시합니다.'),
  definition('yuede','월덕귀인','귀인','tan-yuan','절입 월지 삼합표. 원문의 일주 우선과 구별하여 알려진 모든 천간의 일치를 표시합니다.'),
  definition('wenqu','문곡귀인','현대 한국표','kim-literary','김실근의 현대 일간표로 알려진 모든 지지를 대조합니다.'),
  definition('taiji','태극귀인','귀인','sanming','고전 태극 대응지를 일간으로 대조하는 SAI 표시 정책입니다. 양끝·사고를 모두 갖춘 입격이나 길한 효력은 판정하지 않습니다.'),
  definition('hakdang','학당귀인','현대 한국표','kim-literary','김실근 현대 일간표의 월지·시지만 대조합니다. 고전의 납음 정학당과 다른 규칙입니다.'),
  definition('kuigang','괴강살','간지 조합','yuanhai','연해자평의 임진·경술·무술·경진 네 일주 목록입니다. 다른 기둥은 같은 간지 일치만 표시하며 괴강 일격 성립으로 간주하지 않습니다.'),
  definition('baihu','백호대살','현대 한국표','noh-baihu','노병한의 현대 일곱 간지표로 네 기둥을 대조합니다. 택일 백호입중궁과 구별하며 질병·사고는 해석하지 않습니다.'),
  definition('huagai','화개살','지지형·삼합','sanming-branches','진술축미 자체는 화개지 표시이며 연지·일지 삼합 기준 성립은 별도 근거로 구별합니다.'),
  definition('tianmen','천문성','현대 한국표','kim-tianmen','김현성의 술·해 천문성 분류입니다. 고전의 모든 천문 규칙이나 능력 판정으로 일반화하지 않습니다.'),
  definition('guasu','과숙살','연지 기준','wuxing','인묘진→축, 사오미→진, 신유술→미, 해자축→술의 연지 계절군표입니다. 성별·결혼 결과는 판정하지 않습니다.'),
  definition('taohua','도화살','지지형·삼합','sanming-branches','자오묘유 자체는 도화지 표시이며 연지·일지 삼합 기준 함지와 구별합니다.'),
  definition('xuanzhen','현침살','문자 분류','wuxing','오행정기 다섯 문자표의 천간 갑·신과 지지 묘·오·신입니다. 현대 세 문자표와 구별합니다.'),
  definition('luguan','건록','일간 기준','sanming','고전 십간록 대응지를 일간으로 대조합니다. 12운성 행의 건록과 별도 분류입니다.'),
  definition('yangren','양인살','현대 한국표','onstory','개발자 기술표의 양간 다섯 개만 대조합니다. 음간 양인표는 채택하지 않습니다.'),
  definition('anlu','암록','현대 한국표','onstory','개발자 기술표의 일간 대비 지지 대응을 사용합니다.'),
  definition('guangui','관귀학관','현대 한국표','onstory','개발자 기술표의 일간 대비 지지 대응으로 현대 학당귀인과 구별합니다.'),
  definition('redcharm','홍염살','현대 한국표','onstory','개발자 한국표의 갑오·을신·병인·정미·무진·기진·경술·신유·임자·계신입니다. 고전의 다른 표와 혼합하지 않습니다.'),
  definition('doctor','천의성','현대 한국표','onstory','절입 월지의 앞 지지 분류입니다. 건강·질병이나 의료 능력을 판정하지 않습니다.'),
  definition('guchen','고신살','연지 기준','wuxing','인묘진→사, 사오미→신, 신유술→해, 해자축→인의 연지 계절군표입니다. 가족·관계 결과는 판정하지 않습니다.'),
  ...TWELVE.map((label,index)=>definition('twelve-'+index,label,'12신살','jeonghae','삼합국 겁살부터 지지 순서로 대조합니다. 연지·일지 기준을 별도 행으로 표시하고 지지형 분류와 합치지 않습니다.')),
];
const BY_ID = Object.fromEntries(CATALOG.map(item=>[item.id,item]));
const STEM_TABLES = [['tianyi',TIANYI],['wenchang',WENCHANG],['jinyu',JINYU],['wenqu',WENQU],['taiji',TAIJI],['luguan',LUGUAN],['yangren',YANGREN],['anlu',ANLU],['guangui',GUANGUI],['redcharm',REDCHARM]];
function validCore(pillars) {
  if (!Array.isArray(pillars)||![3,4].includes(pillars.length)
    ||Array.from(pillars).some(p=>!p||!KEYS.includes(p.key))
    ||new Set(pillars.map(p=>p.key)).size!==pillars.length) return null;
  const byKey=Object.fromEntries(pillars.map(p=>[p.key,p]));
  if (!['year','month','day'].every(key=>byKey[key])) return null;
  for (const p of pillars) if (typeof p.stem!=='string'||p.stem.length!==1||!STEMS.includes(p.stem)
    ||typeof p.branch!=='string'||p.branch.length!==1||!BRANCHES.includes(p.branch)
    ||p.ganZhi!==p.stem+p.branch||STEMS.indexOf(p.stem)%2!==BRANCHES.indexOf(p.branch)%2) return null;
  return byKey;
}
const copy=value=>JSON.parse(JSON.stringify(value));
/** Missing time is null, distinct from no correspondence in a known pillar. */
export function calculateNatalAuspicious(pillars) {
  const byKey=validCore(pillars); if (!byKey) return null;
  const byLayer=Object.fromEntries(KEYS.map(key=>[key,byKey[key]?{stem:[],branch:[]}:null]));
  const twelveByPillar=Object.fromEntries(KEYS.map(key=>[key,null])),matches=[];
  const anchor=byKey.day.stem,stemIndex=STEMS.indexOf(anchor),month=byKey.month.branch;
  function add(id,p,layer,basis,label=BY_ID[id].label,display=true) {
    if (display&&!byLayer[p.key][layer].includes(label)) byLayer[p.key][layer].push(label);
    matches.push({id,label,pillar:p.key,layer,basis,sourceKey:BY_ID[id].sourceKey});
  }
  for (const key of KEYS) {
    const p=byKey[key]; if (!p) continue;
    for (const [id,table] of STEM_TABLES) if (table[stemIndex].includes(p.branch))
      add(id,p,'branch','일간 '+anchor+' → '+p.branch+' · '+KEY_NAMES[key]+'지 대조');
    if (['month','time'].includes(key)&&HAKDANG[stemIndex]===p.branch)
      add('hakdang',p,'branch','현대 한국 일간 '+anchor+' → '+p.branch+' · 월지·시지 한정');
    const [layer,target]=TIANDE[month];
    if (p[layer]===target) add('tiande',p,layer,'절입 월지 '+month+' → '+(layer==='stem'?'천간':'지지')+' '+target+' · 전기둥 표시 확장');
    if (p.stem===YUEDE[month]) add('yuede',p,'stem','절입 월지 '+month+' → 천간 '+p.stem+' · 전기둥 표시 확장');
    for (const [id,table] of [['kuigang',KUIGANG],['baihu',BAIHU]]) if (table.includes(p.ganZhi)) {
      const label=BY_ID[id].label+(key==='day'?'':'(간지)');
      const basis=KEY_NAMES[key]+'주 '+p.ganZhi+' 전체 조합 · '+(id==='kuigang'&&key!=='day'?'고전 일주 목록의 SAI 타주 표시 확장':id==='baihu'?'현대 한국 7간지표':'고전 네 일주 목록');
      add(id,p,'stem',basis,label); add(id,p,'branch',basis,label);
    }
    if ('辰戌丑未'.includes(p.branch)) add('huagai',p,'branch','낱지지 '+p.branch+' · 사고지 화개지 분류, 삼합 성립과 별개','화개살(지지)');
    if ('子午卯酉'.includes(p.branch)) add('taohua',p,'branch','낱지지 '+p.branch+' · 사왕지 도화지 분류, 삼합 성립과 별개','도화살(지지)');
    if ('戌亥'.includes(p.branch)) add('tianmen',p,'branch','낱지지 '+p.branch+' · 김현성 현대 술해 천문성 분류');
    if ('甲辛'.includes(p.stem)) add('xuanzhen',p,'stem','낱천간 '+p.stem+' · 오행정기 문자 분류');
    if ('卯午申'.includes(p.branch)) add('xuanzhen',p,'branch','낱지지 '+p.branch+' · 오행정기 다섯 문자표의 지지');
    const yi=BRANCHES.indexOf(byKey.year.branch);
    const season=yi===0||yi===11||yi===1?3:yi<=4?0:yi<=7?1:2;
    if (p.branch===['丑','辰','未','戌'][season]) add('guasu',p,'branch','연지 '+byKey.year.branch+' 계절군 → '+p.branch);
    if (p.branch===['巳','申','亥','寅'][season]) add('guchen',p,'branch','연지 '+byKey.year.branch+' 계절군 → '+p.branch);
    if (p.branch===BRANCHES[(BRANCHES.indexOf(month)+11)%12]) add('doctor',p,'branch','절입 월지 '+month+'의 앞 지지 '+p.branch+' · 현대 한국표');
    twelveByPillar[key]={};
    for (const baseKey of ['year','day']) {
      const base=byKey[baseKey].branch,group=GROUPS.find(item=>item.branches.includes(base));
      const index=(BRANCHES.indexOf(p.branch)-BRANCHES.indexOf(group.start)+12)%12;
      twelveByPillar[key][baseKey]=TWELVE[index];
      add('twelve-'+index,p,'branch',KEY_NAMES[baseKey]+'지 '+base+' · 삼합 '+group.branches+' → '+p.branch,TWELVE[index],false);
      if (p.branch===group.huagai) add('huagai',p,'branch',KEY_NAMES[baseKey]+'지 '+base+' · 삼합 '+group.branches+' → 화개 '+p.branch);
      if (p.branch===group.taohua) add('taohua',p,'branch',KEY_NAMES[baseKey]+'지 '+base+' · 삼합 '+group.branches+' → 함지 '+p.branch);
    }
  }
  // Keep both provenance records, but prefer the relational name in display.
  for (const key of KEYS) if (byLayer[key]) for (const name of ['화개살','도화살']) {
    if (byLayer[key].branch.includes(name)) byLayer[key].branch=byLayer[key].branch.filter(label=>label!==name+'(지지)');
  }
  const byPillar=Object.fromEntries(KEYS.map(key=>[key,byLayer[key]?[...new Set([...byLayer[key].stem,...byLayer[key].branch])]:null]));
  return {byPillar,byLayer,twelveByPillar,matches,catalog:copy(CATALOG),supported:[...new Set(CATALOG.map(item=>item.label))],sources:copy(SOURCES),notes:[
    '고전·현대 한국표 중 출처를 확인한 22개 분류와 12신살입니다. 지지형·간지 일치와 연·일지 기준을 근거에서 구분하며 모든 유파의 신살을 망라하지 않습니다.',
    '천덕·월덕은 알려진 모든 기둥을 대조하는 표시 범위입니다. 지장간·주야 효력·합충·공망에 따른 성립과 길흉의 강약은 판정하지 않습니다.',
    (byKey.time?'실제 네 기둥만 대조했습니다.':'생시를 몰라 시주는 미확인입니다. 세 기둥에 일치가 없어도 전체 사주에 없다고 단정하지 않습니다.')+' 명칭은 전통 상징이며 건강·재산·관계·미래의 결과를 보장하지 않습니다.',
  ]};
}
