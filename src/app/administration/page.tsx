import Link from "next/link";
import { Users, KeyRound, ScanLine, Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrg } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const ctx = await requireOrg("settings.view");
  const items = [
    {
      href: "/administration/settings",
      title: "Company Settings",
      description: "Organization name, currency, timezone and fiscal year.",
      icon: SettingsIcon,
      visible: ctx.permissions.has("settings.company"),
    },
    {
      href: "/administration/users",
      title: "Users",
      description: "Invite team members and assign roles.",
      icon: Users,
      visible: ctx.permissions.has("settings.users"),
    },
    {
      href: "/administration/roles",
      title: "Roles & Permissions",
      description: "Define roles and granular permissions.",
      icon: KeyRound,
      visible: ctx.permissions.has("settings.roles"),
    },
    {
      href: "/administration/audit-logs",
      title: "Audit Logs",
      description: "Review the full action history of your organization.",
      icon: ScanLine,
      visible: ctx.permissions.has("settings.audit_logs"),
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground">
            Manage {ctx.organization.name}.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {items
            .filter((i) => i.visible)
            .map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <item.icon className="h-4 w-4" /> {item.title}
                    </CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
        </div>
      </div>
    </AppShell>
  );
}