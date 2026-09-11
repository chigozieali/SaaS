import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { NOTIFICATION_EVENTS } from "@/lib/notification-preferences";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const stored = await db.notificationPreference.findMany({
    where: { userId: ctx.userId, organizationId: ctx.organizationId },
    select: { eventKey: true, emailEnabled: true, inAppEnabled: true },
  });
  const byKey = new Map(stored.map((p) => [p.eventKey, p]));

  const preferences = NOTIFICATION_EVENTS.map((event) => ({
    eventKey: event.key,
    label: event.label,
    description: event.description,
    emailEnabled: byKey.get(event.key)?.emailEnabled ?? true,
    inAppEnabled: byKey.get(event.key)?.inAppEnabled ?? true,
  }));

  return apiOk({ preferences });
}

const putSchema = z.object({
  preferences: z.array(
    z.object({
      eventKey: z.enum([...NOTIFICATION_EVENTS.map((e) => e.key)] as [string, ...string[]]),
      emailEnabled: z.boolean(),
      inAppEnabled: z.boolean(),
    })
  ),
});

export async function PUT(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  await db.$transaction(
    parsed.data.preferences.map((p) =>
      db.notificationPreference.upsert({
        where: {
          userId_eventKey: { userId: ctx.userId, eventKey: p.eventKey },
        },
        create: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          eventKey: p.eventKey,
          emailEnabled: p.emailEnabled,
          inAppEnabled: p.inAppEnabled,
        },
        update: {
          emailEnabled: p.emailEnabled,
          inAppEnabled: p.inAppEnabled,
        },
      })
    )
  );

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "notification_preference",
    entityId: ctx.userId,
    metadata: { events: parsed.data.preferences.map((p) => p.eventKey) },
  });

  return apiOk({ ok: true });
}