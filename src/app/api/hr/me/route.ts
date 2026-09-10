import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  gender: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinRelation: z.string().optional(),
});

function isEmptyOrUndefined(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

// Self-service personal info update. Saved immediately (audit-logged).
export async function PUT(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
  });
  if (!me) {
    return apiError("No employee record linked to your account. Ask an administrator to match your employee email to your login email.", 403);
  }

  const data = parsed.data;
  const updated = await db.employee.update({
    where: { id: me.id },
    data: {
      phone: isEmptyOrUndefined(data.phone) ? me.phone : data.phone,
      address: isEmptyOrUndefined(data.address) ? null : data.address,
      maritalStatus: isEmptyOrUndefined(data.maritalStatus) ? me.maritalStatus : data.maritalStatus,
      nationality: isEmptyOrUndefined(data.nationality) ? me.nationality : data.nationality,
      gender: isEmptyOrUndefined(data.gender) ? me.gender : data.gender,
      nextOfKinName: isEmptyOrUndefined(data.nextOfKinName) ? me.nextOfKinName : data.nextOfKinName,
      nextOfKinPhone: isEmptyOrUndefined(data.nextOfKinPhone) ? me.nextOfKinPhone : data.nextOfKinPhone,
      nextOfKinRelation: isEmptyOrUndefined(data.nextOfKinRelation) ? me.nextOfKinRelation : data.nextOfKinRelation,
    },
    select: { id: true, firstName: true, lastName: true, phone: true, address: true, maritalStatus: true, nationality: true, gender: true, nextOfKinName: true, nextOfKinPhone: true, nextOfKinRelation: true },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "employee",
    entityId: me.id,
    metadata: { source: "self-service" },
  });

  return apiOk({ me: updated });
}