import { apiRoute, publicConfig } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(publicConfig); }
