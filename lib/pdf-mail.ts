import { env } from "cloudflare:workers";
import { buildReadingPdf, PDF_FONT_PATHS } from "@/public/experience/reading-pdf.js";
import { validateReadingPdfDocument } from "@/public/experience/reading-pdf-document.js";

const MAX_FONT_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

type Result = { type: string; title: string; summary: string; basis: string[] };
type PdfMailSource = {
  mode: "saju" | "zodiac" | "ziwei";
  nickname: string | null;
  result: Result;
  document: unknown;
  includeBirthData: boolean;
};

function htmlText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

// Old requests retain their original summary-only consent. Never attach a newly
// inferred full report, raw birthday, contact, request UUID or tracking URL.
function legacyDocument(source: PdfMailSource) {
  return { version: 1, mode: source.mode, title: "사이 · 나의 성향 결과", subtitle: "이전 신청의 요약 결과",
    summary: [{ label: source.result.type, text: source.result.title }, { label: "핵심 이야기", text: source.result.summary }],
    sections: [{ id: "result-basis", title: "결과를 연결한 이유", chapter: "", text: "",
      paragraphs: [], items: source.result.basis }],
    notes: ["재미와 자기 탐색을 위한 해석이며 과학적 성격 검사·의학적 진단이 아닙니다."] };
}

async function readFixedFont(origin: string, pathname: string): Promise<Uint8Array> {
  if (!pathname.startsWith("/experience/fonts/") || pathname.includes("..") || /[?#]/.test(pathname)) throw new Error("font_path_invalid");
  const url = new URL(pathname, origin);
  if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin) throw new Error("font_origin_invalid");
  let response: Response;
  if (env.ASSETS) {
    // Only the allowlisted asset pathname is meaningful to this binding. No
    // public-host self-fetch, third-party font host or user-supplied URL.
    response = await env.ASSETS.fetch(new Request(new URL(pathname, "https://assets.internal"),
      { redirect: "error", signal: AbortSignal.timeout(15000) }));
  } else if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    // Development-only fallback. Never recurse through the deployed Worker.
    response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  } else throw new Error("pdf_asset_binding_unavailable");
  if (!response.ok || !response.body) throw new Error("font_unavailable");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_FONT_BYTES) throw new Error("font_too_large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_FONT_BYTES) { await reader.cancel(); throw new Error("font_too_large"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

function base64(bytes: Uint8Array): string {
  // Worker-safe, no Node Buffer dependency or single huge spread call.
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export async function buildPdfEmail(source: PdfMailSource, origin: string) {
  const document = validateReadingPdfDocument(source.document ?? legacyDocument(source), { includeBirthData: source.includeBirthData });
  const [regular, bold] = await Promise.all([
    readFixedFont(origin, PDF_FONT_PATHS.regular), readFixedFont(origin, PDF_FONT_PATHS.bold),
  ]);
  const bytes = await buildReadingPdf({ document, fontBytes: { regular, bold } });
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_PDF_BYTES
    || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("pdf_invalid");
  const greeting = source.nickname ? `${source.nickname}님,` : "안녕하세요,";
  const text = `${greeting}\n요청하신 사이 성향 결과를 PDF로 첨부했어요. 첨부 파일을 열어 확인해 주세요.\n\n이 메일은 직접 신청한 결과 전달용이며 모임·광고 안내가 아닙니다.\n재미와 자기 탐색을 위한 해석이며 과학적 성격 검사·의학적 진단이 아닙니다.`;
  const html = `<p>${htmlText(greeting)}</p><p>요청하신 사이 성향 결과를 <strong>PDF로 첨부</strong>했어요. 첨부 파일을 열어 확인해 주세요.</p><p>이 메일은 직접 신청한 결과 전달용이며 모임·광고 안내가 아닙니다.</p><p>재미와 자기 탐색을 위한 해석이며 과학적 성격 검사·의학적 진단이 아닙니다.</p>`;
  return { subject: "[사이] 요청하신 성향 결과 PDF가 도착했어요", text, html,
    attachments: [{ filename: `sai-${source.mode}-reading.pdf`, content: base64(bytes), content_type: "application/pdf" }] };
}

export async function sendPdfEmail(input: Awaited<ReturnType<typeof buildPdfEmail>> & {
  key: string; from: string; to: string; requestId: string;
}): Promise<string> {
  const { key, requestId, to, ...email } = input;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `result-pdf-v2/${requestId}` },
    body: JSON.stringify({ ...email, to: [to] }),
  });
  const value: unknown = await response.json();
  if (!response.ok || !value || typeof value !== "object" || !("id" in value)
    || typeof value.id !== "string" || !value.id.trim() || value.id.length > 200) throw new Error("provider_unconfirmed");
  return value.id;
}
