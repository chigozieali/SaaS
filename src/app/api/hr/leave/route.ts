import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("leave.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const leaves = await db.leave.findMany({
    where: { employee: { organizationId: ctx.organizationId } },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      leaveType: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return apiOk({ leaves });
}

const createSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  days: z.number(),
  reason: z.string().optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("leave.create");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id: parsed.data.employeeId, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  const leave = await db.leave.create({
    data: {
      employeeId: parsed.data.employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      days: parsed.data.days,
      reason: parsed.data.reason || null,
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
  return apiOk({ leave }, 201);
}