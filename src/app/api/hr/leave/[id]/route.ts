import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { notifyUsersByEmail } from "@/lib/notify";

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
    include: { employee: { select: { email: true, firstName: true, lastName: true } } },
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

  const statusLabel =
    parsed.data.status === "approved"
      ? "approved"
      : parsed.data.status === "rejected"
        ? "rejected"
        : "cancelled";
  await notifyUsersByEmail(ctx.organizationId, [leave.employee.email ?? ""], {
    title: `Leave ${statusLabel}`,
    message: `Your leave request (${new Date(leave.startDate).toLocaleDateString()} – ${new Date(leave.endDate).toLocaleDateString()}) was ${statusLabel}.`,
    type: parsed.data.status === "approved" ? "success" : "warning",
    link: "/hr/my-leave",
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