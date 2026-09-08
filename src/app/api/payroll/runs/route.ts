import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { computePayrollRun } from "@/services/payroll/service";

export async function GET() {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const runs = await db.payrollRun.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      period: true,
      _count: { select: { lines: true } },
      lines: { select: { netPay: true } },
    },
    orderBy: { runDate: "desc" },
  });

  // derive payroll cost (sum of gross) per run
  const enriched = runs.map((run) => ({
    ...run,
    netPayTotal: run.lines.reduce((s, l) => s + Number(l.netPay), 0),
  }));

  return apiOk({ runs: enriched });
}

/**
 * Run the payroll calculation engine for a draft run.
 */
export async function POST(req: Request) {
  const res = await getApiContext("payroll.run");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const { runId } = body ?? {};

  if (!runId) return apiError("runId is required");

  try {
    const result = await computePayrollRun(runId, ctx.organizationId);
    return apiOk({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payroll calculation failed";
    return apiError(message, 400);
  }
}