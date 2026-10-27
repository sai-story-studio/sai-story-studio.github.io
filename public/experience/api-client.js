export const PUBLIC_API_ORIGIN = 'https://sai-story-studio-20261022.youngjaetag.chatgpt.site';
export const PAGES_ORIGIN = 'https://sai-story-studio.github.io';
const routes = new Map([
  ['/api/config', 'GET'], ['/api/participants/config', 'GET'],
  ['/api/participants', 'POST'], ['/api/requests', 'POST'],
]);

export function resolvePublicApiRequest(path, options = {}, origin = globalThis.location?.origin) {
  const method = String(options.method || 'GET').toUpperCase();
  if (typeof path !== 'string' || routes.get(path) !== method) throw new Error('허용되지 않은 공개 신청 경로입니다.');
  if (origin === PAGES_ORIGIN) {
    const headers = new Headers(options.headers);
    for (const name of headers.keys()) {
      if (!['content-type', 'accept'].includes(name)) throw new Error('신청 요청에는 로그인·인증 헤더를 넣을 수 없습니다.');
    }
    return { url: `${PUBLIC_API_ORIGIN}${path}`, options: { ...options, method, headers,
      credentials: 'omit', mode: 'cors', redirect: 'error' } };
  }
  return { url: path, options: { ...options, method, credentials: 'same-origin' } };
}

export function publicApiFetch(path, options = {}) {
  const request = resolvePublicApiRequest(path, options);
  return globalThis.fetch(request.url, request.options);
}
