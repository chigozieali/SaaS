import { requireOrg } from "@/lib/access";
import { NotificationsClient } from "@/components/hr/notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireOrg("employees.self");
  return <NotificationsClient />;
}