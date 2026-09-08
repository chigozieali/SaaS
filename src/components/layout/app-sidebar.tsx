"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navigation, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

interface AppSidebarProps {
  organizationName: string;
  permissions: Set<string>;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

function hasAccess(item: NavItem, permissions: Set<string>): boolean {
  if (!item.permission) return true;
  return permissions.has(item.permission) || permissions.has("*");
}

function isChildWithHref(item: NavItem): item is NavItem & { href: string } {
  return Boolean(item.href);
}

export function AppSidebarImpl({
  organizationName,
  permissions,
}: Omit<AppSidebarProps, "isCollapsed" | "onToggle">) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const visibleItems = navigation.filter((item) =>
    item.children?.some((c) => hasAccess(c, permissions))
  );

  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));

  const isActiveGroup = (item: NavItem) =>
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false;

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-3 border-b border-white/5">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              L
            </span>
            <span className="truncate">{organizationName}</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto text-sidebar-muted-foreground"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-0.5">
          {visibleItems.map((item) => {
            if (item.children) {
              const active = isActiveGroup(item);
              const open = openGroups[item.title] ?? active;
              return (
                <Collapsible key={item.title} open={open} onOpenChange={() => toggleGroup(item.title)}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        "text-sidebar-foreground hover:bg-sidebar-muted",
                        active && "bg-sidebar-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1 text-left">{item.title}</span>}
                      {!collapsed && (
                        <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {!collapsed && (
                      <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l pl-3">
                        {item.children
                          .filter(isChildWithHref)
                          .filter((c) => hasAccess(c, permissions))
                          .map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-muted-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground",
                                pathname.startsWith(child.href) &&
                                  "bg-sidebar-muted text-sidebar-foreground"
                              )}
                            >
                              <child.icon className="h-3.5 w-3.5 shrink-0" />
                              {child.title}
                            </Link>
                          ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            }
            if (!hasAccess(item, permissions)) return null;
            return (
              <Link
                key={item.href!}
                href={item.href!}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-muted",
                  pathname.startsWith(item.href!) && "bg-sidebar-muted"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.title}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

export { AppSidebarImpl as AppSidebar };