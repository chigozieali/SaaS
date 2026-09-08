import { getApiContext, apiOk } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

export async function GET(req: Request) {
  const res = await getApiContext("settings.audit_logs");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const url = new URL(req.url);
  const take = Math.min(parseInt(url.searchParams.get("take") ?? "100", 10), 500);

  const logs = await db.auditLog.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  return apiOk({ logs });
}