import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const source = path.join(root, 'public');
const output = path.join(root, 'outputs', 'github-pages-site');
const canonical = 'https://sai-story-studio-20261022.youngjaetag.chatgpt.site';
const unusedPrivatePhotos = new Set(['experience/assets/garden.jpg', 'experience/assets/journal.jpg', 'experience/assets/pottery.jpg']);
if (path.relative(root, output) !== path.join('outputs', 'github-pages-site')) throw new Error('Unexpected build destination');
if (existsSync(output)) {
  if (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output) throw new Error('Unsafe build destination');
  rmSync(output, { recursive: true });
}
mkdirSync(output, { recursive: true });

// Drop only ancillary identity/provenance chunks; keep original image data bytes.
function privateMetadataFreePng(bytes) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error('Invalid PNG');
  const kept = [bytes.subarray(0,8)];
  let offset = 8, ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG');
    const size = bytes.readUInt32BE(offset), end = offset + size + 12;
    if (end > bytes.length) throw new Error('Truncated PNG chunk');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!['caBX','eXIf','iTXt','tEXt','zTXt'].includes(type)) kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || offset !== bytes.length) throw new Error('Invalid PNG end');
  return Buffer.concat(kept);
}

let fileCount = 0;
function copyPublic(directory, relative = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Public symlinks are not allowed');
    const rel = path.posix.join(relative, entry.name);
    if (unusedPrivatePhotos.has(rel)) continue;
    if (entry.name.startsWith('.') || /\.(sqlite3?|db|csv|log|pem|env)$/i.test(entry.name)) throw new Error('Private file in public source');
    const from = path.join(directory, entry.name), to = path.join(output, rel);
    if (entry.isDirectory()) { mkdirSync(to, { recursive: true }); copyPublic(from, rel); }
    else if (entry.isFile()) {
      mkdirSync(path.dirname(to), { recursive: true });
      if (entry.name.endsWith('.png')) writeFileSync(to, privateMetadataFreePng(readFileSync(from)));
      else copyFileSync(from, to);
      fileCount++;
    }
  }
}
copyPublic(source);

function redirectPage(target, text) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${target}"><title>사이 · SAI STUDIO</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f5fc;color:#342b40;font:16px/1.8 system-ui}main{padding:32px;text-align:center}a{color:#795c9d}</style><main><p>${text}</p><a href="${target}">계속하기 →</a></main></html>`;
}
writeFileSync(path.join(output, 'index.html'), redirectPage('./experience/', '사이 스튜디오를 열고 있어요.'));
writeFileSync(path.join(output, '.nojekyll'), '');
for (const name of ['operators','participants','admin']) {
  const target = `${canonical}/experience/${name === 'admin' ? 'operators' : name}`;
  const html = redirectPage(target, '기존의 보호된 운영자 로그인 화면으로 이동합니다.');
  writeFileSync(path.join(output, 'experience', `${name}.html`), html);
  mkdirSync(path.join(output, 'experience', name), { recursive: true });
  writeFileSync(path.join(output, 'experience', name, 'index.html'), html);
}
mkdirSync(path.join(output, 'experience', 'join'), { recursive: true });
writeFileSync(path.join(output, 'experience', 'join', 'index.html'), redirectPage('../index.html#meetup-registration', '모임 관심 신청을 열고 있어요.'));
writeFileSync(path.join(output, '404.html'), redirectPage('/experience/', '사이 스튜디오 첫 화면으로 이동합니다.'));
const home = readFileSync(path.join(output, 'experience', 'index.html'), 'utf8');
if (!home.includes('api-client.js') || home.includes('name="timeCorrection"')) throw new Error('Expected updated UI/API client missing');
const api = readFileSync(path.join(output, 'experience', 'api-client.js'), 'utf8');
if (!api.includes(canonical)) throw new Error('Expected canonical API origin missing');
console.log(JSON.stringify({ output, publicFilesCopied: fileCount, privateDataIncluded: false, publicOrigin: 'https://sai-story-studio.github.io', apiOrigin: canonical, adminAuthentication: 'original-secured-site' }));
