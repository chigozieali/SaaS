import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  action: z.literal("logout-all"),
});

// Invalidates every signed-in device for this user (including the current one)
// by bumping the global token version and deactivating all device sessions.
export async function POST(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const [user] = await db.$transaction([
    db.user.update({
      where: { id: ctx.userId },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    }),
    db.deviceSession.updateMany({
      where: { userId: ctx.userId, active: true },
      data: { active: false },
    }),
  ]);

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "logout_all",
    entity: "user",
    entityId: ctx.userId,
    metadata: { tokenVersion: user.tokenVersion },
  });

  return apiOk({ ok: true });
}