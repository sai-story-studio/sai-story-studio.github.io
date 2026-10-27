import { apiRoute, deleteAdminRecord } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiRoute(async () => deleteAdminRecord(request, (await context.params).id));
}
