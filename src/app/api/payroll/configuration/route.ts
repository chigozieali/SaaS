import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("payroll.configure");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const org = await db.organization.findUnique({ where: { id: ctx.organizationId } });

  const [configs, countries] = await Promise.all([
    db.payrollConfiguration.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        country: true,
        taxRules: { orderBy: { bracketOrder: "asc" } },
        deductionRules: true,
        contributionRules: true,
      },
      orderBy: { effectiveFrom: "desc" },
    }),
    db.country.findMany({ orderBy: { name: "asc" } }),
  ]);

  return apiOk({ configs, countries, org });
}

const configSchema = z.object({
  countryCode: z.string().min(2),
  name: z.string().min(1),
  currency: z.string().min(1),
  taxYear: z.string().optional(),
  effectiveFrom: z.string().min(1),
  taxRules: z.array(
    z.object({
      bracketOrder: z.number(),
      lowerBound: z.number(),
      upperBound: z.number().optional().nullable(),
      rate: z.number(),
      baseAmount: z.number().optional().nullable(),
    })
  ),
  deductionRules: z.array(
    z.object({
      name: z.string(),
      calculationType: z.string(),
      value: z.number(),
      cap: z.number().optional().nullable(),
    })
  ),
  contributionRules: z.array(
    z.object({
      name: z.string(),
      contributor: z.string(),
      calculationType: z.string(),
      value: z.number(),
      cap: z.number().optional().nullable(),
    })
  ),
});

export async function POST(req: Request) {
  const res = await getApiContext("payroll.configure");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  // Deactivate previous active config for country (versioning by effectiveFrom)
  await db.payrollConfiguration.updateMany({
    where: { organizationId: ctx.organizationId, countryCode: parsed.data.countryCode, isActive: true },
    data: { isActive: false, effectiveTo: new Date(parsed.data.effectiveFrom) },
  });

  const config = await db.payrollConfiguration.create({
    data: {
      organizationId: ctx.organizationId,
      countryCode: parsed.data.countryCode,
      name: parsed.data.name,
      currency: parsed.data.currency,
      taxYear: parsed.data.taxYear || null,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      isActive: true,
      taxRules: { create: parsed.data.taxRules },
      deductionRules: { create: parsed.data.deductionRules },
      contributionRules: { create: parsed.data.contributionRules },
    },
    include: { taxRules: true, deductionRules: true, contributionRules: true },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "payroll_configuration",
    entityId: config.id,
  });

  return apiOk({ config }, 201);
}