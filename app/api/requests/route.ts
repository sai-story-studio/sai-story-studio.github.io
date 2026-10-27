import { apiRoute, createRequest } from "@/lib/service";
import { publicEndpoint, publicPreflight } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export async function POST(request: Request) { return publicEndpoint(request, () => apiRoute(() => createRequest(request))); }
export function OPTIONS(request: Request) { return publicPreflight(request); }
