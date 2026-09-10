import { getApiContext, apiOk } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

type GapKey =
  | "bank"
  | "tin"
  | "taxOffice"
  | "pfa"
  | "rsa"
  | "nin"
  | "confirmation"
  | "acknowledgements";

const GAP_LABELS: Record<GapKey, string> = {
  bank: "Bank details",
  tin: "TIN",
  taxOffice: "Tax office",
  pfa: "PFA",
  rsa: "RSA PIN",
  nin: "NIN",
  confirmation: "Confirmation",
  acknowledgements: "Policy acknowledgements",
};

export async function GET() {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const employees = await db.employee.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      isConfirmed: true,
      bankAccountNumber: true,
      tin: true,
      taxOffice: true,
      pfaName: true,
      rsaPin: true,
      ssn: true,
      department: { select: { name: true } },
      position: { select: { title: true } },
      _count: {
        select: { acknowledgements: true, disciplinaryRecords: true },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const rows = employees.map((e) => {
    const gaps: GapKey[] = [];
    if (!e.bankAccountNumber) gaps.push("bank");
    if (!e.tin) gaps.push("tin");
    if (!e.taxOffice) gaps.push("taxOffice");
    if (!e.pfaName) gaps.push("pfa");
    if (!e.rsaPin) gaps.push("rsa");
    if (!e.ssn) gaps.push("nin");
    if (!e.isConfirmed) gaps.push("confirmation");
    if (e._count.acknowledgements === 0) gaps.push("acknowledgements");
    return {
      employeeId: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      employeeCode: e.employeeCode,
      department: e.department?.name ?? null,
      position: e.position?.title ?? null,
      hasBank: !!e.bankAccountNumber,
      hasTin: !!e.tin,
      hasTaxOffice: !!e.taxOffice,
      hasPfa: !!e.pfaName,
      hasRsa: !!e.rsaPin,
      hasNin: !!e.ssn,
      isConfirmed: e.isConfirmed,
      acknowledgementCount: e._count.acknowledgements,
      disciplinaryCount: e._count.disciplinaryRecords,
      gaps,
      gapCount: gaps.length,
    };
  });

  const counts = Object.fromEntries(
    (Object.keys(GAP_LABELS) as GapKey[]).map((key) => [
      key,
      rows.filter((r) => r.gaps.includes(key)).length,
    ])
  );

  return apiOk({
    rows,
    counts,
    gapLabels: GAP_LABELS,
    total: employees.length,
  });
}