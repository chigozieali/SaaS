import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  daysAllowed: z.number().int().positive(),
  isPaid: z.boolean().default(true),
});

export async function GET() {
  const res = await getApiContext("leave.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const types = await db.leaveType.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
  });
  return apiOk({ leaveTypes: types });
}

export async function POST(req: Request) {
  const res = await getApiContext("leave.create");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const leaveType = await db.leaveType.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        daysAllowed: parsed.data.daysAllowed,
        isPaid: parsed.data.isPaid,
      },
    });
    return apiOk({ leaveType }, 201);
  } catch {
    return apiError("Failed to create leave type", 500);
  }
}