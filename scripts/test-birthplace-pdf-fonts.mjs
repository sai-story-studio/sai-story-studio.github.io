import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import { calculateReading } from '../public/experience/reading-engine.js';
import { KOREAN_BIRTHPLACES } from '../public/experience/birthplace-time.js';
import { buildReadingPdfDocument } from '../public/experience/reading-pdf-document.js';
import { buildReadingPdf } from '../public/experience/reading-pdf.js';
import fontkit from '../public/experience/vendor/fontkit-bundle.js';
const experience = new URL('../public/experience/', import.meta.url);
const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; vm.createContext(sandbox);
for (const file of ['lunar.js', 'iztro.min.js']) vm.runInContext(await readFile(new URL(`vendor/${file}`, experience), 'utf8'), sandbox);
Object.assign(globalThis, { Solar: sandbox.Solar, Lunar: sandbox.Lunar, LunarUtil: sandbox.LunarUtil, iztro: sandbox.iztro });
const fontBytes = Object.fromEntries(await Promise.all(['regular', 'bold'].map(async weight=>[weight,new Uint8Array(await readFile(new URL(`fonts/sai-pdf-${weight}.ttf`,experience)))])));
const coverage = Object.fromEntries(Object.entries(fontBytes).map(([weight,bytes])=>[weight,new Set(fontkit.create(bytes).characterSet)]));
let sample;
for(const city of KOREAN_BIRTHPLACES) {
  const input = { mode:'saju',birthDate:'1999-09-22',birthTime:'00:20',calendar:'solar',gender:'female',birthplaceId:city.id,timeCorrection:'local-mean-solar' };
  const reading = calculateReading(input,{asOf:'2026-10-23 12:00:00'});
  const document = buildReadingPdfDocument({reading,input,includeBirthData:true,localOnlyCorrection:true});
  assert.ok(JSON.stringify(document).includes(city.name));
  const normalized=JSON.stringify(document).replace(/[\u2011\u2012\u2013\u2014\u2212]/g,'-');
  for(const [weight,points] of Object.entries(coverage)) {
    const missing=[...new Set([...normalized].filter(char=>!points.has(char.codePointAt(0))))];
    assert.deepEqual(missing,[],`${city.name} ${weight}: missing ${missing.join('')}`);
  }
  sample??=document;
}
console.log(`PASS local corrected PDFs for all ${KOREAN_BIRTHPLACES.length} supported cities: both weights cover every output glyph.`);
if(process.argv.includes('--sample')) {
  // The parent marks the artifact operation immediately before this opt-in.
  const folder=new URL('../output/pdf/',import.meta.url);await mkdir(folder,{recursive:true});
  const bytes=await buildReadingPdf({document:sample,fontBytes});
  await writeFile(new URL('sai-saju-corrected-sample.pdf',folder),bytes);
  console.log(`PASS corrected local PDF sample created (${bytes.length} bytes). Synthetic only, no external requests.`);
}
