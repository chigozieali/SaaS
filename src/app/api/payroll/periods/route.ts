import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  payDate: z.string().optional(),
});

export async function GET() {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const periods = await db.payrollPeriod.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      runs: { include: { _count: { select: { lines: true } } } },
      _count: true,
    },
    orderBy: { startDate: "desc" },
  });
  return apiOk({ periods });
}

export async function POST(req: Request) {
  const res = await getApiContext("payroll.run");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);

  // Prevent overlapping active periods
  const overlapping = await db.payrollPeriod.findFirst({
    where: {
      organizationId: ctx.organizationId,
      status: { in: ["open", "processing"] },
      OR: [
        { startDate: { lte: endDate }, endDate: { gte: startDate } },
      ],
    },
  });
  if (overlapping) {
    return apiError(`Overlaps with active period "${overlapping.name}"`);
  }

  try {
    const period = await db.$transaction(async (tx) => {
      const p = await tx.payrollPeriod.create({
        data: {
          organizationId: ctx.organizationId,
          name: parsed.data.name,
          startDate,
          endDate,
          payDate: parsed.data.payDate ? new Date(parsed.data.payDate) : null,
          status: "open",
        },
      });

      await tx.payrollRun.create({
        data: {
          periodId: p.id,
          organizationId: ctx.organizationId,
          status: "draft",
        },
      });

      return p;
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "payroll_period",
      entityId: period.id,
    });
    return apiOk({ period }, 201);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("A payroll period with this name already exists");
    }
    return apiError("Failed to create payroll period", 500);
  }
}