import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  managerId: z.string().optional().nullable(),
});

export async function GET() {
  const res = await getApiContext("departments.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const departments = await db.department.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });
  return apiOk({ departments });
}

export async function POST(req: Request) {
  const res = await getApiContext("departments.create");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const department = await db.department.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        code: parsed.data.code || null,
        managerId: parsed.data.managerId || null,
      },
    });
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "department",
      entityId: department.id,
    });
    return apiOk({ department }, 201);
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
      return apiError("A department with this name already exists");
    }
    return apiError("Failed to create department", 500);
  }
}

export async function PATCH(req: Request) {
  const res = await getApiContext("departments.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const body = await req.json().catch(() => null);

  const parsedData = z
    .object({ id: z.string(), name: z.string().optional(), code: z.string().optional(), managerId: z.string().optional().nullable() })
    .safeParse(body);
  if (!parsedData.success) return apiError("Invalid input");

  const department = await db.department.findFirst({
    where: { id: parsedData.data.id, organizationId: ctx.organizationId },
  });
  if (!department) return apiError("Department not found", 404);

  const updated = await db.department.update({
    where: { id: department.id },
    data: {
      ...(parsedData.data.name ? { name: parsedData.data.name } : {}),
      ...(parsedData.data.code !== undefined ? { code: parsedData.data.code || null } : {}),
      ...(parsedData.data.managerId !== undefined ? { managerId: parsedData.data.managerId || null } : {}),
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "department",
    entityId: updated.id,
  });
  return apiOk({ department: updated });
}