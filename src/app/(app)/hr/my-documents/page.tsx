import { requireOrg } from "@/lib/access";
import { MyDocumentsClient } from "@/components/hr/my-documents-client";

export const dynamic = "force-dynamic";

export default async function MyDocumentsPage() {
  await requireOrg("employees.self");
  return <MyDocumentsClient />;
}