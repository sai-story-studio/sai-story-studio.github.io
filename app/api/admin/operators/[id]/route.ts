import { apiRoute } from "@/lib/service";
import { removeOperator } from "@/lib/operators";

export const dynamic = "force-dynamic";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiRoute(async () => removeOperator(request, (await context.params).id));
}
