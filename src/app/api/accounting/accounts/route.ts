import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  subtype: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export async function GET() {
  const res = await getApiContext("accounting.chartOfAccounts");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const accounts = await db.account.findMany({
    where: { organizationId: ctx.organizationId },
    include: { parent: { select: { id: true, name: true } }, _count: { select: { children: true } } },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  return apiOk({ accounts });
}

export async function POST(req: Request) {
  const res = await getApiContext("accounting.chartOfAccounts");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const account = await db.account.create({
      data: {
        organizationId: ctx.organizationId,
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        subtype: parsed.data.subtype ?? null,
        parentId: parsed.data.parentId ?? null,
      },
    });
    return apiOk({ account }, 201);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("An account with this code already exists");
    }
    return apiError("Failed to create account", 500);
  }
}