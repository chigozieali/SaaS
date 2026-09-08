import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Forbidden" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Contact an administrator if you believe
          this is a mistake.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}