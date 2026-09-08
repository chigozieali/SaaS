"use client";

import useSWR from "swr";
import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SettingsClient() {
  const { data, mutate } = useSWR("/api/admin/settings", fetcher);
  const [saving, setSaving] = useState(false);
  const org = data?.organization;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: (formData.get("email") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      currency: (formData.get("currency") as string) || undefined,
      countryCode: (formData.get("countryCode") as string) || undefined,
      timezone: (formData.get("timezone") as string) || undefined,
      fiscalYear: (formData.get("fiscalYear") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Settings saved");
      mutate();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to save settings");
    }
  }

  return (
    <div>
      <PageHeader title="Company Settings" description="Organization-wide configuration." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            These details appear across invoices, reports and payroll.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company name</Label>
                <Input id="name" name="name" defaultValue={org?.name ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={org?.email ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={org?.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={org?.address ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue={org?.currency ?? ""} placeholder="NGN" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country code</Label>
                <Input id="countryCode" name="countryCode" defaultValue={org?.countryCode ?? ""} placeholder="NG" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" name="timezone" defaultValue={org?.timezone ?? ""} placeholder="Africa/Lagos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscalYear">Fiscal year</Label>
                <Input id="fiscalYear" name="fiscalYear" defaultValue={org?.fiscalYear ?? ""} placeholder="Jan–Dec" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}