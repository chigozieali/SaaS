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
  customerId: z.string().min(1).optional(),
  issueDate: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  discount: z.number().default(0).optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("accounting.invoices");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const invoice = await db.invoice.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!invoice) return apiError("Invoice not found", 404);
  if (invoice.status !== "draft") {
    return apiError("Only draft invoices can be edited", 400);
  }
  if (parsed.data.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: parsed.data.customerId, organizationId: ctx.organizationId },
    });
    if (!customer) return apiError("Customer not found", 404);
  }

  const data = parsed.data;
  const discount = data.discount !== undefined ? data.discount : Number(invoice.discount) || 0;
  let subtotal = Number(invoice.subtotal) || 0;
  if (data.lines && data.lines.length > 0) {
    subtotal = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  }

  const updated = await db.$transaction(async (tx) => {
    if (data.lines && data.lines.length > 0) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    }
    const lines = data.lines && data.lines.length > 0
      ? {
          create: data.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: Math.round(l.quantity * l.unitPrice * 100) / 100,
            accountId: null,
          })),
        }
      : undefined;
    const up = await tx.invoice.update({
      where: { id },
      data: {
        ...(data.customerId ? { customerId: data.customerId } : {}),
        ...(data.issueDate ? { issueDate: new Date(data.issueDate) } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.discount !== undefined ? { discount: Math.round(discount * 100) / 100 } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.lines && data.lines.length > 0
          ? {
              subtotal: Math.round(subtotal * 100) / 100,
              taxAmount: Number(invoice.taxAmount) || 0,
              total: Math.round((subtotal - discount) * 100) / 100,
            }
          : {}),
        ...(lines ? { lines } : {}),
      },
      include: { customer: true, lines: true, payments: true },
    });
    return up;
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "invoice",
    entityId: id,
    metadata: { changes: parsed.data },
  });

  return apiOk({ invoice: updated });
}