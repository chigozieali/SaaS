import { db } from "@/lib/prisma";

export type NotificationInput = {
  title: string;
  message?: string | null;
  type?: string;
  link?: string | null;
};

export async function notifyUsersByUserId(
  organizationId: string,
  userIds: string[],
  input: NotificationInput,
  eventKey?: string
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  // Skip users who have turned off in-app notifications for this event type.
  let targets = unique;
  if (eventKey) {
    const prefs = await db.notificationPreference.findMany({
      where: { userId: { in: unique }, eventKey, inAppEnabled: false },
      select: { userId: true },
    });
    if (prefs.length > 0) {
      const disabled = new Set(prefs.map((p) => p.userId));
      targets = unique.filter((id) => !disabled.has(id));
    }
  }
  if (targets.length === 0) return;

  await db.notification.createMany({
    data: targets.map((userId) => ({
      organizationId,
      userId,
      title: input.title,
      message: input.message ?? null,
      type: input.type ?? "info",
      link: input.link ?? null,
    })),
  });
}

/**
 * Notify users who have an active membership in the organization and whose
 * email matches one of the given employee emails. Used to route HR events
 * (payslips, leave, bank requests, policies) to the linked user account.
 */
export async function notifyUsersByEmail(
  organizationId: string,
  emails: string[],
  input: NotificationInput,
  eventKey?: string
) {
  const unique = [...new Set(emails.filter((e): e is string => !!e))];
  if (unique.length === 0) return;

  const users = await db.user.findMany({
    where: { email: { in: unique }, isActive: true },
    select: { id: true, email: true },
  });
  if (users.length === 0) return;

  const memberships = await db.userOrganization.findMany({
    where: {
      organizationId,
      userId: { in: users.map((u) => u.id) },
      status: "active",
    },
    select: { userId: true },
  });
  const activeIds = new Set(memberships.map((m) => m.userId));
  const targetUserIds = users.filter((u) => activeIds.has(u.id)).map((u) => u.id);
  if (targetUserIds.length > 0) {
    await notifyUsersByUserId(organizationId, targetUserIds, input, eventKey);
  }
}