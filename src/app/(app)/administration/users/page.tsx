import { requireOrg } from "@/lib/access";
import { UsersClient } from "@/components/admin/users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireOrg("settings.users");
  return (
      <UsersClient />
  );
}
