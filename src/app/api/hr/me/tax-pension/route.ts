import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  tin: z.string().optional(),
  taxOffice: z.string().optional(),
  pfaName: z.string().optional(),
  rsaPin: z.string().optional(),
  notes: z.string().optional(),
}).refine((v) => [v.tin, v.taxOffice, v.pfaName, v.rsaPin].some((f) => f?.trim()), {
  message: "Provide at least one field to change",
});

// Self-service tax/pension change request. Created as pending and applied to the
// employee record only after HR review (see /api/admin/tax-requests).
export async function POST(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
    select: { id: true },
  });
  if (!me) {
    return apiError("No employee record linked to your account. Ask an administrator to match your employee email to your login email.", 403);
  }

  const pending = await db.taxPensionEditRequest.findFirst({
    where: { employeeId: me.id, status: "pending" },
  });
  if (pending) return apiError("You already have a pending tax/pension change request");

  const request = await db.taxPensionEditRequest.create({
    data: {
      organizationId: ctx.organizationId,
      employeeId: me.id,
      requestedById: ctx.userId,
      tin: parsed.data.tin?.trim() || null,
      taxOffice: parsed.data.taxOffice?.trim() || null,
      pfaName: parsed.data.pfaName?.trim() || null,
      rsaPin: parsed.data.rsaPin?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      status: "pending",
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "tax_pension_edit_request",
    entityId: request.id,
    metadata: { fields: Object.keys(parsed.data).filter((k) => k !== "notes") },
  });

  return apiOk({ request }, 201);
}