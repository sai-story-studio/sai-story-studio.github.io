import { apiRoute, exportAdminRecords } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(exportAdminRecords); }
