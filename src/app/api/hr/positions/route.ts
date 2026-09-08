import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function GET() {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const positions = await db.position.findMany({
    where: { organizationId: ctx.organizationId },
    include: { _count: { select: { employees: true } } },
    orderBy: { title: "asc" },
  });
  return apiOk({ positions });
}

export async function POST(req: Request) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const position = await db.position.create({
      data: {
        organizationId: ctx.organizationId,
        title: parsed.data.title,
        description: parsed.data.description || null,
      },
    });
    return apiOk({ position }, 201);
  } catch {
    return apiError("Failed to create position", 500);
  }
}