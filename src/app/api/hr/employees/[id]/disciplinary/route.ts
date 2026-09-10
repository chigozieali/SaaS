import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const records = await db.disciplinaryRecord.findMany({
    where: { employeeId: id, employee: { organizationId: ctx.organizationId } },
    orderBy: { incidentDate: "desc" },
  });
  return apiOk({ records });
}

const postSchema = z.object({
  incidentDate: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  actionTaken: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!employee) return apiError("Employee not found", 404);

  const record = await db.disciplinaryRecord.create({
    data: {
      employeeId: id,
      incidentDate: new Date(parsed.data.incidentDate),
      type: parsed.data.type,
      description: parsed.data.description,
      actionTaken: parsed.data.actionTaken || null,
      recordedById: ctx.userId,
    },
  });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "disciplinary_record",
    entityId: record.id,
  });
  return apiOk({ record }, 201);
}