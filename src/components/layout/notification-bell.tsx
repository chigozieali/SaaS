"use client";

import Link from "next/link";
import useSWR from "swr";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotifData = { notifications: unknown[]; unreadCount: number };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  return res.json();
};

export function NotificationBell() {
  const { data } = useSWR<NotifData>("/api/hr/notifications", fetcher, {
    refreshInterval: 60_000,
  });
  const unread = data?.unreadCount ?? 0;

  return (
    <Link href="/hr/notifications" aria-label="Notifications">
      <Button variant="ghost" className="relative h-9 w-9 rounded-full" size="icon">
        <Bell className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
    </Link>
  );
}