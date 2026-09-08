import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().min(3).optional(),
  countryCode: z.string().min(2).optional(),
  timezone: z.string().optional(),
  fiscalYear: z.string().optional(),
});

export async function GET() {
  const res = await getApiContext("settings.company");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const org = await db.organization.findUnique({ where: { id: ctx.organizationId } });
  const settings = await db.setting.findMany({ where: { organizationId: ctx.organizationId } });
  return apiOk({ organization: org, settings });
}

export async function PATCH(req: Request) {
  const res = await getApiContext("settings.company");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const org = await db.organization.update({
    where: { id: ctx.organizationId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
      ...(parsed.data.address !== undefined ? { address: parsed.data.address || null } : {}),
      ...(parsed.data.currency ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.countryCode ? { countryCode: parsed.data.countryCode } : {}),
      ...(parsed.data.timezone ? { timezone: parsed.data.timezone } : {}),
      ...(parsed.data.fiscalYear ? { fiscalYear: parsed.data.fiscalYear } : {}),
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "organization_settings",
    entityId: org.id,
    metadata: { changes: parsed.data },
  });

  return apiOk({ organization: org });
}