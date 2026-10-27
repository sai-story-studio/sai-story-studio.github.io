import { apiRoute, publicConfig } from "@/lib/service";
import { publicEndpoint, publicPreflight } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return publicEndpoint(request, () => apiRoute(publicConfig)); }
export function OPTIONS(request: Request) { return publicPreflight(request); }
