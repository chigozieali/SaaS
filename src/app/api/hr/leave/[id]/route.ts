import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const actionSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("leave.approve");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid status");

  const leave = await db.leave.findFirst({
    where: { id, employee: { organizationId: ctx.organizationId } },
  });
  if (!leave) return apiError("Leave request not found", 404);

  const updated = await db.leave.update({
    where: { id },
    data: {
      status: parsed.data.status,
      approvedById: parsed.data.status === "approved" ? ctx.userId : null,
      approvedAt: parsed.data.status === "approved" ? new Date() : null,
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: parsed.data.status,
    entity: "leave",
    entityId: id,
  });
  return apiOk({ leave: updated });
}