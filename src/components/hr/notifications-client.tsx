"use client";

import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { BellOff, CheckCheck, Info, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleString();

type NotificationRow = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  success: Sparkles,
  warning: TriangleAlert,
  destructive: ShieldAlert,
  info: Info,
};

const typeVariant: Record<string, "success" | "warning" | "destructive" | "secondary" | "default"> = {
  success: "success",
  warning: "warning",
  destructive: "destructive",
  info: "secondary",
};

export function NotificationsClient() {
  const { data, mutate } = useSWR<{ notifications: NotificationRow[]; unreadCount: number }>(
    "/api/hr/notifications",
    fetcher
  );

  if (!data) return null;

  const { notifications, unreadCount } = data;

  async function markAllRead() {
    const res = await fetch("/api/hr/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      toast.success("All notifications marked as read");
      mutate();
    }
  }

  async function markRead(id: string) {
    const res = await fetch("/api/hr/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (res.ok) mutate();
  }

  const UnreadIcon = unreadCount ? CheckCheck : BellOff;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}.` : "You're all caught up."}
      >
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <UnreadIcon className="h-4 w-4" />
          {unreadCount > 0 ? "Mark all read" : "All read"}
        </Button>
      </PageHeader>

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="Payslips, leave updates, policy acknowledgements and more will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = typeIcon[n.type] ?? Info;
            const inner = (
              <Card
                className={`flex items-start gap-3 p-4 transition-colors hover:bg-accent ${n.isRead ? "opacity-70" : ""}`}
              >
                <div className="rounded-lg bg-muted p-2">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.isRead ? null : (
                      <Badge variant={typeVariant[n.type] ?? "secondary"}>{n.type}</Badge>
                    )}
                  </div>
                  {n.message ? <p className="text-sm text-muted-foreground">{n.message}</p> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(n.createdAt)}</p>
                </div>
                {!n.isRead ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markRead(n.id);
                    }}
                  >
                    Mark read
                  </Button>
                ) : null}
              </Card>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}