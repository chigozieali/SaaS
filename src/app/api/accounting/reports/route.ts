import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import {
  getProfitAndLoss,
  getBalanceSheet,
  getTrialBalance,
  getGeneralLedger,
} from "@/services/accounting/reports";

export async function GET(req: Request) {
  const res = await getApiContext("accounting.reports");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "pl";
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const accountId = url.searchParams.get("accountId") ?? undefined;

  const start = startParam ? new Date(startParam) : undefined;
  const end = endParam ? new Date(endParam) : undefined;

  try {
    switch (type) {
      case "balance_sheet":
        return apiOk({ report: await getBalanceSheet(ctx.organizationId, end) });
      case "trial_balance":
        return apiOk({ report: await getTrialBalance(ctx.organizationId) });
      case "general_ledger":
        return apiOk({ report: await getGeneralLedger(ctx.organizationId, accountId) });
      case "pl":
      default:
        return apiOk({ report: await getProfitAndLoss(ctx.organizationId, start, end) });
    }
  } catch (error) {
    console.error(error);
    return apiError("Failed to generate report", 500);
  }
}