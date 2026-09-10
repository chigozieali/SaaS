import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const requests = await db.bankDetailRequest.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
  return apiOk({ requests });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().optional(),
});

export async function PATCH(req: Request) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const request = await db.bankDetailRequest.findFirst({
    where: { id: parsed.data.id, organizationId: ctx.organizationId },
  });
  if (!request) return apiError("Bank detail request not found", 404);
  if (request.status !== "pending") return apiError("Request already reviewed");

  const updated = await db.$transaction(async (tx) => {
    const req = await tx.bankDetailRequest.update({
      where: { id: request.id },
      data: {
        status: parsed.data.status,
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        reviewNotes: parsed.data.reviewNotes || null,
      },
    });
    if (parsed.data.status === "approved") {
      await tx.employee.update({
        where: { id: request.employeeId },
        data: {
          bankName: request.bankName,
          bankAccountNumber: request.bankAccountNumber,
          bankAccountName: request.bankAccountName,
        },
      });
    }
    return req;
  }, { timeout: 30_000 });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "bank_detail_request",
    entityId: request.id,
    metadata: { status: parsed.data.status },
  });

  return apiOk({ request: updated });
}