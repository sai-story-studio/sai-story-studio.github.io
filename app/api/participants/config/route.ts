import { apiRoute } from "@/lib/service";
import { participantConfig } from "@/lib/participants";
import { publicEndpoint, publicPreflight } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return publicEndpoint(request, () => apiRoute(participantConfig)); }
export function OPTIONS(request: Request) { return publicPreflight(request); }
