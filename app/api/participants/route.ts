import { apiRoute } from "@/lib/service";
import { createParticipant, participantConfig } from "@/lib/participants";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(participantConfig); }
export async function POST(request: Request) { return apiRoute(() => createParticipant(request)); }
