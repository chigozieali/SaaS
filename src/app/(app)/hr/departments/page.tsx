import { requireOrg } from "@/lib/access";
import { DepartmentsClient } from "@/components/hr/departments-client";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  await requireOrg("departments.view");
  return (
      <DepartmentsClient />
  );
}
