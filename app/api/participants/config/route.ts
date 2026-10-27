import { apiRoute } from "@/lib/service";
import { participantConfig } from "@/lib/participants";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(participantConfig); }
