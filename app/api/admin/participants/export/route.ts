import { apiRoute } from "@/lib/service";
import { exportParticipants } from "@/lib/participants";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(exportParticipants); }
export async function POST(request: Request) { return apiRoute(() => exportParticipants(request)); }
