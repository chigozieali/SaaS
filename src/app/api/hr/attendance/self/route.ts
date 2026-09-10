import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

function todayKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayStart(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

async function resolveMe(ctx: { organizationId: string; user: { email?: string | null } }) {
  return db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
  });
}

export async function GET() {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const me = await resolveMe(ctx);
  if (!me) {
    return apiError(
      "No employee record linked to your account. Ask an administrator to match your employee email to your login email.",
      403
    );
  }

  const key = todayKey();
  const record = await db.attendance.findUnique({
    where: { employeeId_date: { employeeId: me.id, date: dayStart(key) } },
  });

  return apiOk({
    record: record
      ? {
          id: record.id,
          date: record.date.toISOString(),
          checkIn: record.checkIn?.toISOString() ?? null,
          checkOut: record.checkOut?.toISOString() ?? null,
          hoursWorked: record.hoursWorked ? Number(record.hoursWorked) : null,
          overtimeHours: Number(record.overtimeHours ?? 0),
          status: record.status,
        }
      : null,
  });
}

const actionSchema = z.object({
  action: z.enum(["in", "out"]),
});

export async function POST(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const me = await resolveMe(ctx);
  if (!me) {
    return apiError(
      "No employee record linked to your account. Ask an administrator to match your employee email to your login email.",
      403
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid action");

  const key = todayKey();
  const date = dayStart(key);
  const now = new Date();

  const existing = await db.attendance.findUnique({
    where: { employeeId_date: { employeeId: me.id, date } },
  });

  if (parsed.data.action === "in") {
    if (existing && existing.checkIn) {
      return apiError(`Already checked in today at ${existing.checkIn.toLocaleTimeString()}`);
    }
    const record = await db.attendance.upsert({
      where: { employeeId_date: { employeeId: me.id, date } },
      update: { checkIn: now, notes: existing?.notes ?? null },
      create: {
        employeeId: me.id,
        date,
        checkIn: now,
        status: "present",
      },
    });
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "clock_in",
      entity: "attendance",
      entityId: record.id,
      metadata: { source: "self-service" },
    });
    return apiOk({ ok: true });
  }

  // action === "out"
  if (!existing || !existing.checkIn) {
    return apiError("You haven't clocked in yet today");
  }
  if (existing.checkOut) {
    return apiError(`Already checked out today at ${existing.checkOut.toLocaleTimeString()}`);
  }
  const hoursWorked = Math.round(((now.getTime() - existing.checkIn.getTime()) / 3.6e6) * 100) / 100;
  const record = await db.attendance.update({
    where: { id: existing.id },
    data: { checkOut: now, hoursWorked },
  });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "clock_out",
    entity: "attendance",
    entityId: record.id,
    metadata: { source: "self-service", hoursWorked },
  });
  return apiOk({ ok: true });
}