import { requireOrg } from "@/lib/access";
import { RolesClient } from "@/components/admin/roles-client";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requireOrg("settings.roles");
  return (
      <RolesClient />
  );
}
