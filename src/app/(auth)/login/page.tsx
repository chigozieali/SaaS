import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            L
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LedgerHR</h1>
          <p className="text-sm text-muted-foreground">
            Accounting, HR and Payroll in one place
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}