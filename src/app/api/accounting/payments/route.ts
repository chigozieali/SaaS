import { z } from "zod";
import { type Prisma } from "@prisma/client";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  invoiceId: z.string().optional().nullable(),
  billId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  amount: z.number().positive(),
  method: z.string().default("bank"),
  reference: z.string().optional(),
  date: z.string().optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("accounting.invoices");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const payment = await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: parsed.data.invoiceId || null,
          billId: parsed.data.billId || null,
          customerId: parsed.data.customerId || null,
          vendorId: parsed.data.vendorId || null,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference || null,
          date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        },
      });

      // Determine direction (invoice = money in, bill = money out)
      const isInvoicePayment = Boolean(parsed.data.invoiceId);
      const bookLine = isInvoicePayment
        ? [
            { accountCode: "1100", description: "Bank - payment received", debit: parsed.data.amount },
            { accountCode: "1200", description: "Accounts receivable", credit: parsed.data.amount },
          ]
        : [
            { accountCode: "2000", description: "Accounts payable", debit: parsed.data.amount },
            { accountCode: "1100", description: "Bank - payment made", credit: parsed.data.amount },
          ];

      // Post the double-entry journal
      const journalLines = bookLine.map((l) => ({
        accountCode: l.accountCode,
        description: l.description,
        debit: l.debit ?? 0,
        credit: l.credit ?? 0,
      }));

      await postJournalEntryTxn(tx, {
        organizationId: ctx.organizationId,
        date: p.date,
        reference: parsed.data.reference ?? `Payment ${p.id.slice(0, 8)}`,
        description: isInvoicePayment ? "Customer payment received" : "Vendor bill payment",
        source: isInvoicePayment ? "invoice_payment" : "bill_payment",
        createdById: ctx.userId,
        lines: journalLines,
      });

      // Update invoice/bill paid amounts
      if (parsed.data.invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
        if (inv) {
          const newPaid = Number(inv.amountPaid) + parsed.data.amount;
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              amountPaid: newPaid,
              status: newPaid >= Number(inv.total) ? "paid" : "partial",
            },
          });
        }
      }
      if (parsed.data.billId) {
        const bill = await tx.bill.findUnique({ where: { id: parsed.data.billId } });
        if (bill) {
          const newPaid = Number(bill.amountPaid) + parsed.data.amount;
          await tx.bill.update({
            where: { id: bill.id },
            data: {
              amountPaid: newPaid,
              status: newPaid >= Number(bill.total) ? "paid" : "partial",
            },
          });
        }
      }

      return p;
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "payment",
      entityId: payment.id,
    });

    return apiOk({ payment }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    return apiError(message, 400);
  }
}

// Tiny in-transaction journal poster to share code with the service layer
async function postJournalEntryTxn(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    date: Date;
    reference?: string;
    description?: string;
    source?: string;
    createdById?: string;
    lines: Array<{ accountCode: string; description?: string; debit: number; credit: number }>;
  }
) {
  const codes = params.lines.map((l) => l.accountCode);
  const accounts = await tx.account.findMany({
    where: { organizationId: params.organizationId, code: { in: codes } },
  });
  const map = new Map(accounts.map((a) => [a.code, a.id]));
  for (const l of params.lines) {
    if (!map.has(l.accountCode)) throw new Error(`Account ${l.accountCode} not found`);
  }

  const entryNumber = `PM-${Date.now().toString().slice(-8)}`;
  return tx.journalEntry.create({
    data: {
      organizationId: params.organizationId,
      entryNumber,
      date: params.date,
      reference: params.reference,
      description: params.description,
      status: "posted",
      source: params.source ?? "manual",
      createdById: params.createdById,
      lines: {
        create: params.lines.map((l) => ({
          accountId: map.get(l.accountCode)!,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
  });
}