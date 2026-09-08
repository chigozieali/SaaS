import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function GET() {
  const res = await getApiContext("accounting.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const periods = await db.accountingPeriod.findMany({
    where: { organizationId: ctx.organizationId },
    include: { _count: { select: { journalEntries: true } } },
    orderBy: { startDate: "asc" },
  });
  return apiOk({ periods });
}

export async function POST(req: Request) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const period = await db.accountingPeriod.create({
    data: {
      organizationId: ctx.organizationId,
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });
  return apiOk({ period }, 201);
}