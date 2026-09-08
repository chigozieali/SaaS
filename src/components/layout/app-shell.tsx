import { requireOrg } from "@/lib/access";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        organizationName={ctx.organization.name}
        permissions={ctx.permissions}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={ctx.user.name}
          userEmail={ctx.user.email}
          orgName={ctx.organization.name}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}