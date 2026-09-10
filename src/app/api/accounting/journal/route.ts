import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { postJournalEntry } from "@/services/accounting/journal";

export async function GET() {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const entries = await db.journalEntry.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      lines: { include: { account: true } },
      period: true,
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      postedBy: { select: { id: true, name: true } },
      reversedBy: { select: { id: true, name: true } },
      reversalOf: { select: { id: true, entryNumber: true, date: true, status: true } },
      reversals: { select: { id: true, entryNumber: true, date: true, status: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });
  return apiOk({ entries });
}

const journalSchema = z.object({
  date: z.string().min(1),
  reference: z.string().optional(),
  description: z.string().optional(),
  lines: z
    .array(
      z.object({
        accountCode: z.string().min(1),
        description: z.string().optional(),
        debit: z.number().optional().default(0),
        credit: z.number().optional().default(0),
      })
    )
    .min(2),
});

export async function POST(req: Request) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = journalSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const entry = await postJournalEntry({
      organizationId: ctx.organizationId,
      date: new Date(parsed.data.date),
      reference: parsed.data.reference,
      description: parsed.data.description,
      source: "manual",
      status: "draft",
      createdById: ctx.userId,
      lines: parsed.data.lines,
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create_journal",
      entity: "journal_entry",
      entityId: entry.id,
    });

    return apiOk({ entry }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post journal entry";
    return apiError(message, 400);
  }
}