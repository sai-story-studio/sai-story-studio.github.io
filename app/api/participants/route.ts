import { apiRoute } from "@/lib/service";
import { createParticipant, participantConfig } from "@/lib/participants";
import { publicEndpoint, publicPreflight } from "@/lib/public-origin";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(participantConfig); }
export async function POST(request: Request) { return publicEndpoint(request, () => apiRoute(() => createParticipant(request))); }
export function OPTIONS(request: Request) { return publicPreflight(request); }
