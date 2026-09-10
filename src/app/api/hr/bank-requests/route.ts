import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
    select: { id: true },
  });
  if (!me) return apiOk({ requests: [] });

  const requests = await db.bankDetailRequest.findMany({
    where: { employeeId: me.id },
    orderBy: { requestedAt: "desc" },
  });
  return apiOk({ requests });
}

const postSchema = z.object({
  bankName: z.string().min(1),
  bankAccountNumber: z.string().min(1),
  bankAccountName: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
  });
  if (!me) {
    return apiError("No employee record linked to your account. Ask an administrator to match your employee email to your login email.", 403);
  }

  const pending = await db.bankDetailRequest.findFirst({
    where: { employeeId: me.id, status: "pending" },
  });
  if (pending) return apiError("You already have a pending bank detail request");

  const request = await db.bankDetailRequest.create({
    data: {
      organizationId: ctx.organizationId,
      employeeId: me.id,
      requestedById: ctx.userId,
      bankName: parsed.data.bankName,
      bankAccountNumber: parsed.data.bankAccountNumber,
      bankAccountName: parsed.data.bankAccountName,
      notes: parsed.data.notes || null,
      status: "pending",
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "bank_detail_request",
    entityId: request.id,
  });

  return apiOk({ request }, 201);
}