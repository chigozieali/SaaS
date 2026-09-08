import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Create your organization" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Welcome!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t belong to any organization yet. Create an account with a new organization,
          or ask an administrator to invite you to an existing one.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/register">Create organization</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}