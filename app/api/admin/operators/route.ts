import { apiRoute } from "@/lib/service";
import { addOperator, listOperators } from "@/lib/operators";

export const dynamic = "force-dynamic";
export async function GET() { return apiRoute(listOperators); }
export async function POST(request: Request) { return apiRoute(() => addOperator(request)); }
