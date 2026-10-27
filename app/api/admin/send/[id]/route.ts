import { apiRoute, sendAdminResult } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiRoute(async () => sendAdminResult(request, (await context.params).id));
}
