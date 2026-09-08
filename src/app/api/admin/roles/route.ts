import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { ALL_PERMISSIONS, PERMISSION_CATEGORIES } from "@/lib/permissions";

export async function GET() {
  const res = await getApiContext("settings.roles");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const roles = await db.organizationRole.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: { name: "asc" },
  });
  return apiOk({ roles, allPermissions: ALL_PERMISSIONS, categories: PERMISSION_CATEGORIES });
}

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

export async function POST(req: Request) {
  const res = await getApiContext("settings.roles");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const role = await db.$transaction(async (tx) => {
    const created = await tx.organizationRole.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });
    for (const key of parsed.data.permissions) {
      await tx.rolePermission.create({
        data: { roleId: created.id, permissionKey: key },
      });
    }
    return created;
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "role",
    entityId: role.id,
  });
  return apiOk({ role }, 201);
}

const updateRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(req: Request) {
  const res = await getApiContext("settings.roles");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const role = await db.organizationRole.findFirst({
    where: { id: parsed.data.id, organizationId: ctx.organizationId },
  });
  if (!role) return apiError("Role not found", 404);

  const updated = await db.$transaction(async (tx) => {
    if (parsed.data.name || parsed.data.description !== undefined) {
      await tx.organizationRole.update({
        where: { id: role.id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
        },
      });
    }
    if (parsed.data.permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      for (const key of parsed.data.permissions) {
        await tx.rolePermission.create({ data: { roleId: role.id, permissionKey: key } });
      }
    }
    return tx.organizationRole.findUnique({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } },
    });
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "role",
    entityId: role.id,
  });
  return apiOk({ role: updated });
}