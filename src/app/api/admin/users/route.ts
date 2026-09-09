import { z } from "zod";
import bcrypt from "bcryptjs";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const res = await getApiContext("settings.users");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const members = await db.userOrganization.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true, image: true, createdAt: true } },
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const grants = await db.userPermission.findMany({
    where: { organizationId: ctx.organizationId },
    select: { userId: true, permissionKey: true },
  });
  const grantsByUser = new Map<string, string[]>();
  for (const g of grants) {
    const list = grantsByUser.get(g.userId) ?? [];
    list.push(g.permissionKey);
    grantsByUser.set(g.userId, list);
  }

  const roles = await db.organizationRole.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
  });

  return apiOk({
    members: members.map((m) => ({
      ...m,
      grants: grantsByUser.get(m.userId) ?? [],
    })),
    roles,
    canSuper: hasPermission(ctx.permissions, "settings.super"),
  });
}

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  roleId: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("settings.users");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  // Only a Super Admin can assign the Super Admin role (or grant settings.super).
  if (parsed.data.roleId) {
    const role = await db.organizationRole.findFirst({
      where: { id: parsed.data.roleId, organizationId: ctx.organizationId },
      include: { permissions: true },
    });
    const isSuperRole =
      role &&
      (role.name === "Super Admin" ||
        role.permissions.some((rp) => rp.permissionKey === "settings.super"));
    if (isSuperRole && !hasPermission(ctx.permissions, "settings.super")) {
      return apiError("Only a Super Admin can assign this role", 403);
    }
  }

  const email = parsed.data.email.toLowerCase();

  // find-or-create user
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: parsed.data.name || email.split("@")[0],
        passwordHash: parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null,
      },
    });
  }

  // Add (or reactivate) membership with role
  const membership = await db.userOrganization.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId: ctx.organizationId },
    },
    update: { status: "active", roleId: parsed.data.roleId || null },
    create: {
      userId: user.id,
      organizationId: ctx.organizationId,
      roleId: parsed.data.roleId || null,
      status: "active",
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "user_membership",
    entityId: membership.id,
    metadata: { email },
  });

  return apiOk({ user, membership }, 201);
}