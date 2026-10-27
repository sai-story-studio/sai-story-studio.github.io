import { apiRoute, listAdminRecords } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiRoute(() => listAdminRecords(request)); }
