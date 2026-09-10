import bcrypt from "bcryptjs";
import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function PUT(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const user = await db.user.findUnique({ where: { id: ctx.userId } });
  if (!user || !user.passwordHash) return apiError("User not found", 404);
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return apiError("New password must be different from the current password");
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return apiError("Current password is incorrect", 400);

  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  return apiOk({ ok: true });
}