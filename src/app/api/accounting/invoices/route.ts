import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  accountCode: z.string().optional(),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string().min(1),
  dueDate: z.string().optional(),
  discount: z.number().default(0),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET() {
  const res = await getApiContext("accounting.invoices");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const invoices = await db.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { customer: true, lines: true, payments: true },
    orderBy: { issueDate: "desc" },
  });
  return apiOk({ invoices });
}

export async function POST(req: Request) {
  const res = await getApiContext("accounting.invoices");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const customer = await db.customer.findFirst({
    where: { id: parsed.data.customerId, organizationId: ctx.organizationId },
  });
  if (!customer) return apiError("Customer not found", 404);

  const count = await db.invoice.count({ where: { organizationId: ctx.organizationId } });
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const subtotal = parsed.data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = subtotal - parsed.data.discount;

  try {
    const invoice = await db.invoice.create({
      data: {
        organizationId: ctx.organizationId,
        customerId: parsed.data.customerId,
        invoiceNumber,
        issueDate: new Date(parsed.data.issueDate),
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        status: "draft",
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: 0,
        discount: parsed.data.discount,
        total: Math.round(total * 100) / 100,
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
      include: { customer: true, lines: true },
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber },
    });

    return apiOk({ invoice }, 201);
  } catch (error) {
    console.error(error);
    return apiError("Failed to create invoice", 500);
  }
}