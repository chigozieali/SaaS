import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const allowed = new Set(ALL_PERMISSIONS);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("settings.super");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const membership = await db.userOrganization.findUnique({
    where: { userId_organizationId: { userId: id, organizationId: ctx.organizationId } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: { select: { id: true, name: true } },
    },
  });
  if (!membership) return apiError("User not found in this organization", 404);

  const grants = await db.userPermission.findMany({
    where: { userId: id, organizationId: ctx.organizationId },
    select: { permissionKey: true, grantedAt: true },
  });

  return apiOk({ member: membership, grants: grants.map((g) => g.permissionKey) });
}

const putSchema = z.object({
  permissionKeys: z.array(z.string()),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("settings.super");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const membership = await db.userOrganization.findUnique({
    where: { userId_organizationId: { userId: id, organizationId: ctx.organizationId } },
  });
  if (!membership) return apiError("User not found in this organization", 404);

  const uniqueKeys = [...new Set(parsed.data.permissionKeys)];
  const invalid = uniqueKeys.filter((k) => !allowed.has(k));
  if (invalid.length) return apiError(`Unknown permission keys: ${invalid.join(", ")}`);

  await db.$transaction(
    async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id, organizationId: ctx.organizationId } });
      for (const key of uniqueKeys) {
        await tx.userPermission.create({
          data: { userId: id, organizationId: ctx.organizationId, permissionKey: key, grantedById: ctx.userId },
        });
      }
    },
    { timeout: 30_000 }
  );

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "user_permissions",
    entityId: id,
    metadata: { permissionKeys: uniqueKeys },
  });

  return apiOk({ grants: uniqueKeys });
}