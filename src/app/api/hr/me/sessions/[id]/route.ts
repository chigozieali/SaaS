import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

// Log out a single device: deactivates that device session. The JWT callback
// re-checks session `active` on every request, so the device is signed out on
// its next call.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const session = await db.deviceSession.findFirst({
    where: { id, userId: ctx.userId },
  });
  if (!session) return apiError("Session not found", 404);

  await db.deviceSession.update({
    where: { id },
    data: { active: false },
  });

  return apiOk({ ok: true });
}