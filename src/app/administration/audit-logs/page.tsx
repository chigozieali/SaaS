import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { AuditLogsClient } from "@/components/admin/audit-logs-client";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  await requireOrg("settings.audit_logs");
  return (
    <AppShell>
      <AuditLogsClient />
    </AppShell>
  );
}