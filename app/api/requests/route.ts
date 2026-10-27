import { apiRoute, createRequest } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function POST(request: Request) { return apiRoute(() => createRequest(request)); }
