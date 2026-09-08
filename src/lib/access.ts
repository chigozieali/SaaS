import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserPermissions, hasPermission } from "@/lib/permissions";

export type OrgContext =
  | { ok: false; error: "no_session" | "no_org" }
  | {
      ok: true;
      user: { id: string; name?: string | null; email?: string | null };
      organizationId: string;
      organization: { id: string; name: string; slug: string; currency: string };
      permissions: Set<string>;
      isOwner: boolean;
    };

/**
 * Resolve the session and active organization. Redirects unauthenticated
 * users to /login. Returns a typed context or redirects.
 */
export async function requireOrg(
  requiredPermission?: string
): Promise<Extract<OrgContext, { ok: true }>> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await db.userOrganization.findFirst({
    where: { userId: session.user.id, status: "active" },
    include: { organization: true, role: true },
    orderBy: { isOwner: "desc" },
  });

  if (!membership) redirect("/onboarding");

  const orgId = membership.organizationId;
  const permissions = await getUserPermissions(session.user.id, orgId);

  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    redirect("/forbidden");
  }

  return {
    ok: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    organizationId: membership.organizationId,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      currency: membership.organization.currency,
    },
    permissions,
    isOwner: membership.isOwner,
  };
}

export async function requirePermission(permission: string): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await db.userOrganization.findFirst({
    where: { userId: session.user.id, status: "active" },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!membership) redirect("/onboarding");
  if (membership.isOwner) return;

  const keys = membership.role?.permissions.map((r) => r.permission.key) ?? [];
  if (!hasPermission(new Set(keys), permission)) redirect("/forbidden");
}

export async function can(permission: string, permissions: Set<string>): Promise<boolean> {
  return hasPermission(permissions, permission);
}
