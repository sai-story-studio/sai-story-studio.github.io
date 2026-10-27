// Only the public registration/configuration surface is shared with Pages.
// Administrator routes must continue using requireSameOrigin and Sites identity.
export const PAGES_ORIGIN = "https://sai-story-studio.github.io";
const PUBLIC_METHODS: Record<string, readonly string[]> = {
  "/api/config": ["GET"],
  "/api/participants/config": ["GET"],
  "/api/participants": ["POST"],
  "/api/requests": ["POST"],
};

export function isAllowedPublicOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin !== "null"
    && (origin === new URL(request.url).origin || origin === PAGES_ORIGIN));
}

function denied(): Response {
  return Response.json({ error: { code: "ORIGIN_REQUIRED", message: "허용된 사이트에서 보낸 공개 신청만 처리할 수 있습니다." } }, {
    status: 403, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" },
  });
}

function corsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Credentials");
  headers.set("Access-Control-Allow-Origin", PAGES_ORIGIN);
  const vary = new Set((headers.get("Vary") || "").split(",").map(value => value.trim()).filter(Boolean));
  vary.add("Origin"); headers.set("Vary", [...vary].join(", "));
  // No Access-Control-Allow-Credentials: Pages never receives a Sites session.
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function publicEndpoint(request: Request, action: () => Promise<Response>): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin && origin !== PAGES_ORIGIN) return denied();
  if (origin !== PAGES_ORIGIN) return action();
  const allowed = PUBLIC_METHODS[new URL(request.url).pathname];
  if (!allowed?.includes(request.method)) return denied();
  return corsHeaders(await action());
}

export function publicPreflight(request: Request): Response {
  const methods = PUBLIC_METHODS[new URL(request.url).pathname];
  const method = request.headers.get("Access-Control-Request-Method");
  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (request.method !== "OPTIONS" || request.headers.get("Origin") !== PAGES_ORIGIN
    || !method || !methods?.includes(method) || requestedHeaders.some(name => name !== "content-type")) return denied();
  const response = corsHeaders(new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }));
  response.headers.set("Access-Control-Allow-Methods", methods.join(", "));
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
  return response;
}
