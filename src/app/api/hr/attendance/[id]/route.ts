import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const patchSchema = z.object({
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  hoursWorked: z.number().optional().nullable(),
  overtimeHours: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("attendance.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const record = await db.attendance.findFirst({
    where: { id, employee: { organizationId: ctx.organizationId } },
  });
  if (!record) return apiError("Attendance record not found", 404);

  const data = parsed.data;
  const checkIn = data.checkIn !== undefined ? (data.checkIn ? new Date(data.checkIn) : null) : record.checkIn;
  const checkOut = data.checkOut !== undefined ? (data.checkOut ? new Date(data.checkOut) : null) : record.checkOut;
  let hoursWorked: Prisma.Decimal | null = record.hoursWorked;
  if (data.hoursWorked !== undefined) {
    hoursWorked = data.hoursWorked === null ? null : new Prisma.Decimal(data.hoursWorked);
  } else if (data.checkIn !== undefined || data.checkOut !== undefined) {
    hoursWorked =
      checkIn && checkOut
        ? new Prisma.Decimal(Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100)
        : null;
  }

  const updated = await db.attendance.update({
    where: { id },
    data: {
      checkIn,
      checkOut,
      hoursWorked: hoursWorked === null ? null : new Prisma.Decimal(hoursWorked),
      ...(data.overtimeHours !== undefined ? { overtimeHours: new Prisma.Decimal(data.overtimeHours) } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "attendance",
    entityId: id,
  });

  return apiOk({ attendance: updated });
}