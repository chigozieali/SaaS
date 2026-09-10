import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  documentId: z.string().min(1),
});

export async function POST(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!me) {
    return apiError(
      "No employee record linked to your account. Ask an administrator to match your employee email to your login email.",
      403
    );
  }

  const doc = await db.employeeDocument.findFirst({
    where: { id: parsed.data.documentId, employeeId: me.id },
  });
  if (!doc) return apiError("Document not found", 404);

  await db.$transaction(async (tx) => {
    await tx.employeeDocument.update({
      where: { id: doc.id },
      data: { acknowledgedAt: new Date() },
    });
    await tx.policyAcknowledgement.create({
      data: {
        employeeId: me.id,
        policyName: doc.name,
        documentId: doc.id,
      },
    });
  }, { timeout: 30_000 });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "acknowledge",
    entity: "employee_document",
    entityId: doc.id,
    metadata: { source: "self-service" },
  });

  return apiOk({ ok: true });
}