import { apiRoute } from "@/lib/service";
import { listParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiRoute(() => listParticipants(request)); }
