import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
});

export async function GET() {
  const res = await getApiContext("accounting.invoices");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const customers = await db.customer.findMany({
    where: { organizationId: ctx.organizationId },
    include: { _count: { select: { invoices: true } } },
    orderBy: { name: "asc" },
  });
  return apiOk({ customers });
}

export async function POST(req: Request) {
  const res = await getApiContext("accounting.invoices");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const customer = await db.customer.create({
    data: {
      organizationId: ctx.organizationId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      taxId: parsed.data.taxId || null,
    },
  });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "customer",
    entityId: customer.id,
  });
  return apiOk({ customer }, 201);
}