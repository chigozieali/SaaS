import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            L
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Set up your organization to get started.
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}