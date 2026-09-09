import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getUserPermissions, hasPermission } from "@/lib/permissions";

export type ApiContext = {
  userId: string;
  organizationId: string;
  permissions: Set<string>;
  isOwner: boolean;
  user: { id: string; name?: string | null; email?: string | null };
};

export async function getApiContext(
  requiredPermission?: string
): Promise<{ ctx: ApiContext } | { error: NextResponse }> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const membership = await db.userOrganization.findFirst({
    where: { userId: session.user.id, status: "active" },
    include: { role: true },
    orderBy: { isOwner: "desc" },
  });

  if (!membership) {
    return { error: NextResponse.json({ message: "No organization" }, { status: 403 }) };
  }

  const permissions = await getUserPermissions(session.user.id, membership.organizationId);
  if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
    return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }

  return {
    ctx: {
      userId: session.user.id,
      organizationId: membership.organizationId,
      permissions,
      isOwner: membership.isOwner,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    },
  };
}

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ message, details }, { status });
}

export function apiOk(data: unknown = { ok: true }, status = 200) {
  return NextResponse.json(data, { status });
}