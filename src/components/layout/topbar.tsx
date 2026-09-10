"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

interface TopbarProps {
  userName?: string | null;
  userEmail?: string | null;
  orgName: string;
}

export function Topbar({ userName, userEmail, orgName }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-6">
      <div className="flex-1">
        <p className="text-sm font-semibold">{orgName}</p>
        <p className="text-xs text-muted-foreground">Business management suite</p>
      </div>
      <NotificationBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src="" alt={userName ?? ""} />
              <AvatarFallback>{initials(userName ?? userEmail ?? "U")}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-0.5">
              <span className="text-sm font-medium">{userName ?? "User"}</span>
              <span className="text-xs text-muted-foreground">{userEmail}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/hr/my-records">
              <UserRound className="h-4 w-4" />
              My Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/hr/my-account">
              <Settings className="h-4 w-4" />
              My Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}