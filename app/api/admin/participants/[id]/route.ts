import { apiRoute } from "@/lib/service";
import { deleteParticipant } from "@/lib/participants";

export const dynamic = "force-dynamic";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiRoute(async () => deleteParticipant(request, (await context.params).id));
}
