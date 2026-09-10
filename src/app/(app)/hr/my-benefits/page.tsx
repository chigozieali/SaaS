import { requireOrg } from "@/lib/access";
import { MyBenefitsClient } from "@/components/hr/my-benefits-client";

export const dynamic = "force-dynamic";

export default async function MyBenefitsPage() {
  await requireOrg("employees.self");
  return <MyBenefitsClient />;
}