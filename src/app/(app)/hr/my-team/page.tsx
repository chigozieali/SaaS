import { requireOrg } from "@/lib/access";
import { MyTeamClient } from "@/components/hr/my-team-client";

export const dynamic = "force-dynamic";

export default async function MyTeamPage() {
  await requireOrg("employees.self");
  return <MyTeamClient />;
}