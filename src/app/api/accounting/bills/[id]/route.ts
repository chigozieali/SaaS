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
  vendorId: z.string().min(1).optional(),
  issueDate: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("accounting.bills");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = billSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const bill = await db.bill.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!bill) return apiError("Bill not found", 404);
  if (bill.status === "paid" || bill.status === "cancelled") {
    return apiError("This bill can no longer be edited", 400);
  }
  if (parsed.data.vendorId) {
    const vendor = await db.vendor.findFirst({
      where: { id: parsed.data.vendorId, organizationId: ctx.organizationId },
    });
    if (!vendor) return apiError("Vendor not found", 404);
  }

  const data = parsed.data;
  let subtotal = Number(bill.subtotal) || 0;
  if (data.lines && data.lines.length > 0) {
    subtotal = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  }

  const updated = await db.$transaction(async (tx) => {
    if (data.lines && data.lines.length > 0) {
      await tx.billLine.deleteMany({ where: { billId: id } });
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
    const up = await tx.bill.update({
      where: { id },
      data: {
        ...(data.vendorId ? { vendorId: data.vendorId } : {}),
        ...(data.issueDate ? { issueDate: new Date(data.issueDate) } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(data.lines && data.lines.length > 0
          ? {
              subtotal: Math.round(subtotal * 100) / 100,
              taxAmount: 0,
              total: Math.round(subtotal * 100) / 100,
            }
          : {}),
        ...(lines ? { lines } : {}),
      },
      include: { vendor: true, lines: true, payments: true },
    });
    return up;
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "bill",
    entityId: id,
    metadata: { changes: parsed.data },
  });

  return apiOk({ bill: updated });
}