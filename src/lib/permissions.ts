import { db } from "@/lib/prisma";
import { ALL_PERMISSIONS } from "./permission-constants";

export * from "./permission-constants";

// Fetch the permission keys granted to a user within an organization.
// Merges the role's permissions with any direct per-user grants (Super Admin).
export async function getUserPermissions(
  userId: string,
  organizationId: string
): Promise<Set<string>> {
  const [membership, grants] = await Promise.all([
    db.userOrganization.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    }),
    db.userPermission.findMany({
      where: { userId, organizationId },
      select: { permissionKey: true },
    }),
  ]);

  if (!membership) return new Set();

  if (membership.isOwner) return new Set(ALL_PERMISSIONS);

  const keys = new Set(grants.map((g) => g.permissionKey));
  for (const rp of membership.role?.permissions ?? []) keys.add(rp.permission.key);
  return keys;
}