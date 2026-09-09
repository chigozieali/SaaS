import { requireOrg } from "@/lib/access";
import { JournalClient } from "@/components/accounting/journal-client";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  await requireOrg("accounting.journal");
  return (
      <JournalClient />
  );
}
