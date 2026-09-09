import { requireOrg } from "@/lib/access";
import { SettingsClient } from "@/components/admin/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireOrg("settings.company");
  return (
      <SettingsClient />
  );
}
