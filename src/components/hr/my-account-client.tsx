"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/modules/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MyAccountClient() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/hr/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Password changed");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      toast.error(data?.message ?? "Failed to change password");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" description="Security and account settings." />

      <Card className="max-w-xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Change password</h2>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                minLength={6}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            <Lock className="mr-2 h-4 w-4" />
            {saving ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}