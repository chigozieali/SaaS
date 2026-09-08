import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("attendance.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const attendances = await db.attendance.findMany({
    where: { employee: { organizationId: ctx.organizationId } },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });
  return apiOk({ attendances });
}

const schema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  status: z.string().default("present"),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("attendance.create");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id: parsed.data.employeeId, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  const checkIn = parsed.data.checkIn ? new Date(parsed.data.checkIn) : null;
  const checkOut = parsed.data.checkOut ? new Date(parsed.data.checkOut) : null;
  const hoursWorked =
    checkIn && checkOut ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) : null;

  try {
    const attendance = await db.attendance.create({
      data: {
        employeeId: parsed.data.employeeId,
        date: new Date(parsed.data.date),
        checkIn,
        checkOut,
        hoursWorked: hoursWorked ? Math.round(hoursWorked * 100) / 100 : null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      },
    });
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "attendance",
      entityId: attendance.id,
    });
    return apiOk({ attendance }, 201);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("Attendance record already exists for this date");
    }
    return apiError("Failed to save attendance", 500);
  }
}