import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { notifyUsersByEmail } from "@/lib/notify";

const employeeSelect = { id: true, firstName: true, lastName: true, employeeCode: true };
const coveringSelect = { id: true, firstName: true, lastName: true };

export async function GET() {
  const res = await getApiContext("leave.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const leaves = await db.leave.findMany({
    where: { employee: { organizationId: ctx.organizationId } },
    include: {
      employee: { select: employeeSelect },
      leaveType: true,
      coveringFor: { select: coveringSelect },
    },
    orderBy: { createdAt: "desc" },
  });
  return apiOk({ leaves });
}

const createSchema = z.object({
  employeeId: z.string().optional(),
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  days: z.number(),
  reason: z.string().optional(),
  coveringForId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const res = await getApiContext("leave.create");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  // Employees can only submit leave for themselves; managers/admins may create for others.
  const canManage = hasPermission(ctx.permissions, "employees.view");
  let targetEmployeeId = parsed.data.employeeId;
  if (!canManage) {
    const selfEmployee = await db.employee.findFirst({
      where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
    });
    if (!selfEmployee) {
      return apiError(
        "No employee record linked to your account. Ask an administrator to match your employee email to your login email.",
        403
      );
    }
    targetEmployeeId = selfEmployee.id;
  }

  const employee = await db.employee.findFirst({
    where: { id: targetEmployeeId, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  if (parsed.data.coveringForId) {
    if (parsed.data.coveringForId === employee.id) {
      return apiError("An employee cannot cover for themselves");
    }
    const covering = await db.employee.findFirst({
      where: { id: parsed.data.coveringForId, organizationId: ctx.organizationId },
    });
    if (!covering) return apiError("Covering employee not found", 404);
  }

  const leave = await db.leave.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      days: parsed.data.days,
      reason: parsed.data.reason || null,
      coveringForId: parsed.data.coveringForId || null,
      status: "pending",
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "leave",
    entityId: leave.id,
  });

  const worker = await db.employee.findFirst({
    where: { id: employee.id },
    select: { email: true, firstName: true, manager: { select: { email: true, firstName: true, lastName: true } } },
  });
  await notifyUsersByEmail(ctx.organizationId, [worker?.email ?? ""], {
    title: "Leave request submitted",
    message: `Your ${new Date(leave.startDate).toLocaleDateString()} – ${new Date(leave.endDate).toLocaleDateString()} request is awaiting approval.`,
    type: "info",
    link: "/hr/my-leave",
  });
  await notifyUsersByEmail(ctx.organizationId, [worker?.manager?.email ?? ""], {
    title: "New leave request to review",
    message: `${worker?.firstName ?? "An employee"} requests leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()}.`,
    type: "info",
    link: "/hr/leave",
  });

  return apiOk({ leave }, 201);
}