import { requireOrg } from "@/lib/access";
import { hasPermission } from "@/lib/permissions";
import { UsersClient } from "@/components/admin/users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const ctx = await requireOrg("settings.users");
  return <UsersClient canSuper={hasPermission(ctx.permissions, "settings.super")} />;
}