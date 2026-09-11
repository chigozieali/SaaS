import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { notifyUsersByEmail } from "@/lib/notify";

export async function GET() {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const requests = await db.taxPensionEditRequest.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true } },
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

  const request = await db.taxPensionEditRequest.findFirst({
    where: { id: parsed.data.id, organizationId: ctx.organizationId },
  });
  if (!request) return apiError("Tax/pension request not found", 404);
  if (request.status !== "pending") return apiError("Request already reviewed");

  const updated = await db.$transaction(async (tx) => {
    const req = await tx.taxPensionEditRequest.update({
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
          tin: request.tin ?? undefined,
          taxOffice: request.taxOffice ?? undefined,
          pfaName: request.pfaName ?? undefined,
          rsaPin: request.rsaPin ?? undefined,
        },
      });
    }
    return req;
  }, { timeout: 30_000 });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "tax_pension_edit_request",
    entityId: request.id,
    metadata: { status: parsed.data.status, employeeId: request.employeeId },
  });

  const worker = await db.employee.findFirst({
    where: { id: request.employeeId },
    select: { email: true },
  });
  await notifyUsersByEmail(ctx.organizationId, [worker?.email ?? ""], {
    title: parsed.data.status === "approved" ? "Tax & pension details updated" : "Tax & pension change request rejected",
    message:
      parsed.data.status === "approved"
        ? "Your tax and pension identifiers were updated."
        : `Your request to change tax/pension identifiers was rejected.${parsed.data.reviewNotes ? ` Note: ${parsed.data.reviewNotes}` : ""}`,
    type: parsed.data.status === "approved" ? "success" : "destructive",
    link: "/hr/my-account",
  }, "hr_requests");

  return apiOk({ request: updated });
}