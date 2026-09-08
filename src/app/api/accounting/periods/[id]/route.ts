import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const closeSchema = z.object({ isClosed: z.boolean() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const period = await db.accountingPeriod.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!period) return apiError("Period not found", 404);

  const updated = await db.accountingPeriod.update({
    where: { id },
    data: { isClosed: parsed.data.isClosed },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: parsed.data.isClosed ? "close_period" : "reopen_period",
    entity: "accounting_period",
    entityId: id,
  });

  return apiOk({ period: updated });
}