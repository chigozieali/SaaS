import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
});

const billSchema = z.object({
  vendorId: z.string().min(1),
  issueDate: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET() {
  const res = await getApiContext("accounting.bills");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const bills = await db.bill.findMany({
    where: { organizationId: ctx.organizationId },
    include: { vendor: true, lines: true, payments: true },
    orderBy: { issueDate: "desc" },
  });
  return apiOk({ bills });
}

export async function POST(req: Request) {
  const res = await getApiContext("accounting.bills");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = billSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const vendor = await db.vendor.findFirst({
    where: { id: parsed.data.vendorId, organizationId: ctx.organizationId },
  });
  if (!vendor) return apiError("Vendor not found", 404);

  const count = await db.bill.count({ where: { organizationId: ctx.organizationId } });
  const billNumber = `BILL-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const subtotal = parsed.data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  try {
    const bill = await db.bill.create({
      data: {
        organizationId: ctx.organizationId,
        vendorId: parsed.data.vendorId,
        billNumber,
        issueDate: new Date(parsed.data.issueDate),
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        status: "unpaid",
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: 0,
        total: Math.round(subtotal * 100) / 100,
        notes: parsed.data.notes || null,
        lines: {
          create: parsed.data.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: Math.round(l.quantity * l.unitPrice * 100) / 100,
            accountId: null,
          })),
        },
      },
      include: { vendor: true, lines: true },
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "bill",
      entityId: bill.id,
      metadata: { billNumber },
    });

    return apiOk({ bill }, 201);
  } catch (error) {
    console.error(error);
    return apiError("Failed to create bill", 500);
  }
}