import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
    select: { id: true },
  });
  if (!me) {
    return apiError(
      "No employee record linked to your account. Ask an administrator to match your employee email to your login email.",
      403
    );
  }

  const leave = await db.leave.findFirst({
    where: { id, employeeId: me.id, employee: { organizationId: ctx.organizationId } },
  });
  if (!leave) return apiError("Leave request not found", 404);
  if (leave.status !== "pending") {
    return apiError("Only pending leave requests can be cancelled");
  }

  const updated = await db.leave.update({
    where: { id },
    data: { status: "cancelled" },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "cancelled",
    entity: "leave",
    entityId: id,
    metadata: { source: "self-service" },
  });

  return apiOk({ leave: updated });
}