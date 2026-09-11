"use client";

import useSWR from "swr";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { Lock, LogOut, Mail, MonitorSmartphone, Trash2, Upload, UserRound } from "lucide-react";
import { PageHeader } from "@/components/modules/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");

function deviceLabel(ua: string | null) {
  if (!ua) return "Unknown device";
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("OPR/")) browser = "Opera";
  else if (ua.includes("Safari/")) browser = "Safari";
  let os = "OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";
  return `${browser} · ${os}`;
}

function maskId(v: string | null | undefined) {
  if (!v) return "—";
  if (v.length <= 4) return "••••••";
  return `••••••${v.slice(-4)}`;
}

type SessionRow = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  active: boolean;
  isCurrent: boolean;
};

type LoginRow = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  success: boolean;
  createdAt: string;
};

type PrefRow = {
  eventKey: string;
  label: string;
  description: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

type BankRequestRow = {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: string;
  notes: string | null;
  reviewNotes: string | null;
  requestedAt: string;
};

type TaxRequestRow = {
  id: string;
  status: string;
  requestedAt: string;
};

type MeData = {
  me: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    maritalStatus: string | null;
    nationality: string | null;
    gender: string | null;
    nextOfKinName: string | null;
    nextOfKinPhone: string | null;
    nextOfKinRelation: string | null;
    photoUrl: string | null;
  } | null;
  user: { name: string | null; email: string | null };
  bank: {
    current: { bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null };
    requests: BankRequestRow[];
  };
  taxPension: {
    tin: string | null;
    taxOffice: string | null;
    pfaName: string | null;
    rsaPin: string | null;
    requests: TaxRequestRow[];
  };
  sessions: SessionRow[];
  loginHistory: LoginRow[];
  notificationPreferences: PrefRow[];
};

const statusVariant: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  active: "success",
};

type ProfileMe = NonNullable<MeData["me"]>;

function initialProfile(me: ProfileMe) {
  return {
    phone: me.phone ?? "",
    address: me.address ?? "",
    maritalStatus: me.maritalStatus ?? "",
    nationality: me.nationality ?? "",
    gender: me.gender ?? "",
    photoUrl: me.photoUrl ?? "",
    nextOfKinName: me.nextOfKinName ?? "",
    nextOfKinPhone: me.nextOfKinPhone ?? "",
    nextOfKinRelation: me.nextOfKinRelation ?? "",
  };
}

function ProfileForm({ me, onMutate }: { me: ProfileMe; onMutate: () => void }) {
  const [profile, setProfile] = useState(initialProfile(me));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Photo uploaded");
      setProfile((p) => ({ ...p, photoUrl: d.url }));
    } else {
      toast.error(d?.message ?? "Upload failed");
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hr/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Profile updated");
      onMutate();
    } else {
      toast.error(d?.message ?? "Failed to update profile");
    }
  }

  return (
    <form onSubmit={saveProfile} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.photoUrl || undefined} alt="Profile" />
          <AvatarFallback>
            {me.firstName[0]}
            {me.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
            {profile.photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProfile((p) => ({ ...p, photoUrl: "" }))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF up to 5 MB.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input id="profile-phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-address">Address</Label>
          <Input id="profile-address" value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-gender">Gender</Label>
          <Input id="profile-gender" value={profile.gender} onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-marital">Marital status</Label>
          <Input id="profile-marital" value={profile.maritalStatus} onChange={(e) => setProfile((p) => ({ ...p, maritalStatus: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-nationality">Nationality</Label>
          <Input id="profile-nationality" value={profile.nationality} onChange={(e) => setProfile((p) => ({ ...p, nationality: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-nok">Next of kin</Label>
          <Input
            id="profile-nok"
            value={profile.nextOfKinName}
            onChange={(e) => setProfile((p) => ({ ...p, nextOfKinName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-nok-phone">Next of kin phone</Label>
          <Input
            id="profile-nok-phone"
            value={profile.nextOfKinPhone}
            onChange={(e) => setProfile((p) => ({ ...p, nextOfKinPhone: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-nok-rel">Next of kin relationship</Label>
          <Input
            id="profile-nok-rel"
            value={profile.nextOfKinRelation}
            onChange={(e) => setProfile((p) => ({ ...p, nextOfKinRelation: e.target.value }))}
          />
        </div>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function PrefsPanel({ initial }: { initial: PrefRow[] }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function togglePref(p: PrefRow, field: "emailEnabled" | "inAppEnabled", value: boolean) {
    const next = prefs.map((x) => (x.eventKey === p.eventKey ? { ...x, [field]: value } : x));
    setPrefs(next);
    setSaving(true);
    const res = await fetch("/api/hr/me/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferences: next.map((x) => ({ eventKey: x.eventKey, emailEnabled: x.emailEnabled, inAppEnabled: x.inAppEnabled })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to update preferences");
      setPrefs(prefs);
    }
  }

  return (
    <div className="space-y-3">
      {prefs.map((p) => (
        <div key={p.eventKey} className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={p.inAppEnabled} onCheckedChange={(v) => togglePref(p, "inAppEnabled", v)} disabled={saving} />
              <span className="text-xs">In-app</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={p.emailEnabled} onCheckedChange={(v) => togglePref(p, "emailEnabled", v)} disabled={saving} />
              <span className="text-xs">Email</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MyAccountClient() {
  const { data, mutate, isLoading } = useSWR<MeData>("/api/hr/me", fetcher);
  const [savingBank, setSavingBank] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [moneyForm, setMoneyForm] = useState({ bankName: "", bankAccountNumber: "", bankAccountName: "", notes: "" });
  const [taxForm, setTaxForm] = useState({ tin: "", taxOffice: "", pfaName: "", rsaPin: "", notes: "" });

  const me = data?.me ?? null;

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    const res = await fetch("/api/hr/me/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }),
    });
    setSavingPassword(false);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Password changed");
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      toast.error(d?.message ?? "Failed to change password");
    }
  }

  async function submitBank(e: React.FormEvent) {
    e.preventDefault();
    setSavingBank(true);
    const res = await fetch("/api/hr/bank-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(moneyForm),
    });
    setSavingBank(false);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Bank change request submitted for approval");
      setMoneyForm({ bankName: "", bankAccountNumber: "", bankAccountName: "", notes: "" });
      mutate();
    } else {
      toast.error(d?.message ?? "Failed to submit bank request");
    }
  }

  async function submitTax(e: React.FormEvent) {
    e.preventDefault();
    setSavingTax(true);
    const res = await fetch("/api/hr/me/tax-pension", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taxForm),
    });
    setSavingTax(false);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Tax/pension change request submitted for approval");
      setTaxForm({ tin: "", taxOffice: "", pfaName: "", rsaPin: "", notes: "" });
      mutate();
    } else {
      toast.error(d?.message ?? "Failed to submit tax/pension request");
    }
  }

  async function logoutSession(id: string) {
    setLoggingOut(id);
    const res = await fetch(`/api/hr/me/sessions/${id}`, { method: "DELETE" });
    setLoggingOut(null);
    if (res.ok) {
      toast.success("Session signed out");
      mutate();
    } else {
      toast.error("Failed to sign out session");
    }
  }

  async function logoutAll() {
    if (!window.confirm("Sign out of every device, including this one?")) return;
    setLoggingOutAll(true);
    const res = await fetch("/api/hr/me/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout-all" }),
    });
    if (res.ok) {
      toast.success("Signed out of all devices");
      await signOut({ callbackUrl: "/login" });
    } else {
      setLoggingOutAll(false);
      toast.error("Failed to sign out all devices");
    }
  }

  const pendingBank = (data?.bank.requests ?? []).some((r) => r.status === "pending");
  const pendingTax = (data?.taxPension.requests ?? []).some((r) => r.status === "pending");

  if (isLoading) {
    return (
      <div>
        <PageHeader title="My Account" description="Profile, security and preferences." />
        <Card className="p-4 text-sm text-muted-foreground">Loading account…</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Account" description="Profile, security, bank details and preferences." />

      {me === null && (
        <Card className="border-warning/40 p-4 text-sm">
          No employee record is linked to your login yet. Contact an administrator to match your employee email to your
          login email — until then, bank and tax/pension changes are unavailable.
        </Card>
      )}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="bank">Bank accounts</TabsTrigger>
          <TabsTrigger value="tax">Tax &amp; Pension</TabsTrigger>
          <TabsTrigger value="sessions">Sessions &amp; security</TabsTrigger>
        </TabsList>

        {/* ---------------- Profile ---------------- */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Profile details</h2>
            </div>
            {me ? (
              <ProfileForm me={me} onMutate={mutate} />
            ) : (
              <p className="text-sm text-muted-foreground">Profile editing is unavailable until an employee record is linked to your account.</p>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Change password</h2>
            </div>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-current">Current password</Label>
                <Input
                  id="account-current"
                  type="password"
                  autoComplete="current-password"
                  value={password.currentPassword}
                  onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account-new">New password</Label>
                  <Input
                    id="account-new"
                    type="password"
                    autoComplete="new-password"
                    value={password.newPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-confirm">Confirm new password</Label>
                  <Input
                    id="account-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={password.confirmPassword}
                    onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" disabled={savingPassword}>
                <Lock className="mr-2 h-4 w-4" />
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* ---------------- Notifications ---------------- */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Notification preferences</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Choose how you want to be notified for each event type. In-app toggles apply immediately to notifications; email
              toggles control email digests.
            </p>
            <PrefsPanel initial={data?.notificationPreferences ?? []} />
          </Card>
        </TabsContent>

        {/* ---------------- Bank accounts ---------------- */}
        <TabsContent value="bank" className="space-y-4">
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold">Current bank details</h2>
            {data?.bank.current?.bankName ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{data.bank.current.bankName}</p>
                <p className="text-muted-foreground">
                  {data.bank.current.bankAccountName} · {data.bank.current.bankAccountNumber}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bank details on record yet.</p>
            )}

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold">Request a bank change</h3>
              {pendingBank ? (
                <p className="text-sm text-muted-foreground">
                  You have a pending bank change request. New requests cannot be submitted until it is reviewed by HR.
                </p>
              ) : (
                <form onSubmit={submitBank} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank name</Label>
                      <Input id="bankName" value={moneyForm.bankName} onChange={(e) => setMoneyForm((f) => ({ ...f, bankName: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountNumber">Account number</Label>
                      <Input id="bankAccountNumber" value={moneyForm.bankAccountNumber} onChange={(e) => setMoneyForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountName">Account name</Label>
                    <Input id="bankAccountName" value={moneyForm.bankAccountName} onChange={(e) => setMoneyForm((f) => ({ ...f, bankAccountName: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankNotes">Notes (optional)</Label>
                    <Input id="bankNotes" value={moneyForm.notes} onChange={(e) => setMoneyForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <Button type="submit" disabled={savingBank || me === null}>
                    {savingBank ? "Submitting…" : "Submit for approval"}
                  </Button>
                </form>
              )}
            </div>

            {(data?.bank.requests ?? []).length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold">Request history</h3>
                <div className="space-y-2">
                  {(data?.bank.requests ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="text-sm">
                        <p className="font-medium">
                          {r.bankName} · {r.bankAccountNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtDate(r.requestedAt)}</p>
                        <p className="text-xs italic text-muted-foreground">{r.reviewNotes ?? r.notes ?? ""}</p>
                      </div>
                      <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ---------------- Tax & Pension ---------------- */}
        <TabsContent value="tax" className="space-y-4">
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold">Tax &amp; pension identifiers</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">TIN</p>
                <p className="mt-0.5 font-medium">{data?.taxPension.tin || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tax office</p>
                <p className="mt-0.5 font-medium">{data?.taxPension.taxOffice || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">PFA</p>
                <p className="mt-0.5 font-medium">{data?.taxPension.pfaName || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">RSA PIN</p>
                <p className="mt-0.5 font-medium">{maskId(data?.taxPension.rsaPin)}</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-1 text-sm font-semibold">Request a change</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Changes are submitted to HR for approval and applied only once approved. RSA PIN is stored encrypted at rest
                and never shown in full.
              </p>
              {pendingTax ? (
                <p className="text-sm text-muted-foreground">
                  You have a pending tax/pension change request. New requests cannot be submitted until it is reviewed by HR.
                </p>
              ) : (
                <form onSubmit={submitTax} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tin">TIN</Label>
                      <Input id="tin" value={taxForm.tin} onChange={(e) => setTaxForm((f) => ({ ...f, tin: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxOffice">Tax office</Label>
                      <Input id="taxOffice" value={taxForm.taxOffice} onChange={(e) => setTaxForm((f) => ({ ...f, taxOffice: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pfaName">PFA</Label>
                      <Input id="pfaName" value={taxForm.pfaName} onChange={(e) => setTaxForm((f) => ({ ...f, pfaName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rsaPin">RSA PIN</Label>
                      <Input id="rsaPin" value={taxForm.rsaPin} onChange={(e) => setTaxForm((f) => ({ ...f, rsaPin: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxNotes">Notes (optional)</Label>
                    <Textarea id="taxNotes" value={taxForm.notes} onChange={(e) => setTaxForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                  </div>
                  <Button type="submit" disabled={savingTax || me === null}>
                    {savingTax ? "Submitting…" : "Submit for approval"}
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ---------------- Sessions & security ---------------- */}
        <TabsContent value="sessions" className="space-y-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Active sessions</h2>
              </div>
              <Button variant="destructive" size="sm" onClick={logoutAll} disabled={loggingOutAll}>
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOutAll ? "Signing out…" : "Log out from all devices"}
              </Button>
            </div>
            <div className="space-y-2">
              {(data?.sessions ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {deviceLabel(s.userAgent)}
                      {s.isCurrent && <Badge variant="success">This device</Badge>}
                      {!s.active && <Badge variant="secondary">Signed out</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.ip ?? "IP unknown"} · Signed in {fmtDate(s.createdAt)} · Last active {fmtDate(s.lastSeenAt)}
                    </p>
                  </div>
                  {s.active && (
                    <Button size="sm" variant="ghost" className="h-7 shrink-0" disabled={loggingOut === s.id} onClick={() => logoutSession(s.id)}>
                      Log out
                    </Button>
                  )}
                </div>
              ))}
              {(data?.sessions ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No active sessions tracked.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Login history</h2>
            <div className="space-y-2">
              {(data?.loginHistory ?? []).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{deviceLabel(l.userAgent)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.ip ?? "IP unknown"} · {fmtDate(l.createdAt)}
                    </p>
                  </div>
                  <Badge variant={l.success ? "success" : "destructive"}>{l.success ? "Success" : "Failed"}</Badge>
                </div>
              ))}
              {(data?.loginHistory ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No login activity recorded yet.</p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}