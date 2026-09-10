import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  type: z.enum(["asset", "liability", "equity", "revenue", "expense"]).optional(),
  subtype: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("accounting.chartOfAccounts");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const account = await db.account.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!account) return apiError("Account not found", 404);
  if (account.isSystem && parsed.data.isActive === false) {
    return apiError("System accounts cannot be deactivated");
  }
  if (parsed.data.parentId === id) {
    return apiError("An account cannot be its own parent");
  }

  try {
    const updated = await db.account.update({
      where: { id },
      data: {
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.subtype !== undefined ? { subtype: parsed.data.subtype || null } : {}),
        ...(parsed.data.parentId !== undefined ? { parentId: parsed.data.parentId || null } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "update",
      entity: "account",
      entityId: updated.id,
    });

    return apiOk({ account: updated });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return apiError("An account with this code already exists");
    }
    return apiError("Failed to update account", 500);
  }
}