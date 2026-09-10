import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

export async function GET() {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.notification.count({
      where: { userId: ctx.userId, isRead: false },
    }),
  ]);

  return apiOk({ notifications, unreadCount });
}

const readSchema = z.object({
  ids: z.array(z.string().min(1)).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = readSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const where =
    parsed.data.all || !parsed.data.ids?.length
      ? { userId: ctx.userId, isRead: false as const }
      : { userId: ctx.userId, id: { in: parsed.data.ids }, isRead: false as const };

  await db.notification.updateMany({
    where,
    data: { isRead: true },
  });
  return apiOk({ ok: true });
}