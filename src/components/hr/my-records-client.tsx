"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { CalendarCheck2, Pencil, Plane, Landmark, UsersRound, Wallet, FileText, HeartPulse, Settings, BellRing } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type Me = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelation?: string | null;
  hireDate: string | null;
  employmentType?: string;
  payFrequency?: string | null;
  salaryGrade?: { id: string; name: string } | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
};

type BankRequest = {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: string;
  reviewNotes?: string | null;
  requestedAt: string;
};

type MyRecordsData = {
  me: Me | null;
  leaves: { id: string; status: string; days: number }[];
  leaveBalance: { name: string; allowed: number; taken: number; pending: number; carryover: number; remaining: number }[];
  payslips: { netPay: string; periodName: string }[];
  ytdDeductions: { name: string; amount: number }[];
  overtimeByMonth: { month: string; hours: number }[];
  documents?: { id: string; name: string; acknowledgedAt: string | null; category: string | null }[];
  payday: { frequency: string; lastPayDate: string | null; nextPayDate: string | null };
  currency: string;
};

type NotifRow = { id: string; title: string; message: string | null; isRead: boolean; createdAt: string; link: string | null };

const statusVariant: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

const links = [
  { title: "My Attendance", href: "/hr/my-attendance", icon: CalendarCheck2, desc: "Your time and relief coverage" },
  { title: "My Leave", href: "/hr/my-leave", icon: Plane, desc: "Leave balance, history and requests" },
  { title: "My Payslips", href: "/hr/my-payslips", icon: Wallet, desc: "Your payslips and salary" },
  { title: "My Documents", href: "/hr/my-documents", icon: FileText, desc: "Contracts, policies and acknowledgements" },
  { title: "My Benefits", href: "/hr/my-benefits", icon: HeartPulse, desc: "Enrolled benefits and contributions" },
  { title: "My Account", href: "/hr/my-account", icon: Settings, desc: "Security and account settings" },
  { title: "Notifications", href: "/hr/notifications", icon: BellRing, desc: "Your latest updates" },
  { title: "My Team", href: "/hr/my-team", icon: UsersRound, desc: "Colleagues and their leave status" },
];

export function MyRecordsClient() {
  const { data, mutate } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const { data: bankData, mutate: mutateBank } = useSWR<{ requests: BankRequest[] }>(
    "/api/hr/bank-requests",
    fetcher
  );
  const { data: notifData } = useSWR<{ notifications: NotifRow[]; unreadCount: number }>(
    "/api/hr/notifications",
    fetcher
  );
  const me = data?.me ?? null;
  const leaves = data?.leaves ?? [];
  const leaveBalance = data?.leaveBalance ?? [];
  const payslips = data?.payslips ?? [];
  const ytdDeductions = data?.ytdDeductions ?? [];
  const overtimeByMonth = data?.overtimeByMonth ?? [];
  const documents = data?.documents ?? [];
  const bankRequests = bankData?.requests ?? [];
  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const [editOpen, setEditOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    address: "",
    maritalStatus: "",
    nationality: "",
    gender: "",
    nextOfKinName: "",
    nextOfKinPhone: "",
    nextOfKinRelation: "",
  });
  const [bankForm, setBankForm] = useState({ bankName: "", bankAccountNumber: "", bankAccountName: "", notes: "" });

  if (!data) return null;

  if (!me) {
    return (
      <div>
        <PageHeader title="My Records" description="Your HR overview." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  const totalAllowed = leaveBalance.reduce((a, b) => a + b.allowed, 0);
  const totalRemaining = leaveBalance.reduce((a, b) => a + b.remaining, 0);
  const totalTaken = leaveBalance.reduce((a, b) => a + b.taken, 0);
  const currency = data.currency ?? "NGN";
  const pendingBank = bankRequests.find((r) => r.status === "pending");
  const pendingLeaveCount = leaves.filter((l) => l.status === "pending").length;
  const pendingAckCount = documents.filter((d) => !d.acknowledgedAt).length;
  const nextPayday = data.payday?.nextPayDate
    ? new Date(data.payday.nextPayDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : null;
  const payFrequency = (data.payday?.frequency ?? "monthly").replace(/_/g, " ") || "monthly";

  const pendingActions = [
    { label: "Leave request awaiting approval", count: pendingLeaveCount, href: "/hr/my-leave" },
    { label: "Bank detail change pending review", count: pendingBank ? 1 : 0, href: "/hr/my-records" },
    { label: "Policy awaiting acknowledgement", count: pendingAckCount, href: "/hr/my-documents" },
  ].filter((a) => a.count > 0);

  const stats = [
    {
      title: "Next payday",
      value: nextPayday ?? "—",
      sub: `${payFrequency}${data.payday?.lastPayDate ? ` · last ${data.payday.lastPayDate}` : ""}`,
    },
    { title: "Leave remaining", value: `${totalRemaining.toFixed(1)} days`, sub: `${totalTaken.toFixed(1)} / ${totalAllowed.toFixed(1)} used` },
    { title: "Pending actions", value: String(pendingActions.reduce((a, b) => a + b.count, 0)), sub: "Notifications & approvals" },
    {
      title: "Latest net pay",
      value: payslips.length ? formatMoney(Number(payslips[0].netPay), currency) : "—",
      sub: payslips.length ? payslips[0].periodName : "No payslip yet",
    },
  ];

  function openEdit(employee: Me) {
    setForm({
      phone: employee.phone ?? "",
      address: employee.address ?? "",
      maritalStatus: employee.maritalStatus ?? "",
      nationality: employee.nationality ?? "",
      gender: employee.gender ?? "",
      nextOfKinName: employee.nextOfKinName ?? "",
      nextOfKinPhone: employee.nextOfKinPhone ?? "",
      nextOfKinRelation: employee.nextOfKinRelation ?? "",
    });
    setEditOpen(true);
  }

  async function savePersonal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hr/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: form.phone || undefined,
        address: form.address || undefined,
        maritalStatus: form.maritalStatus || undefined,
        nationality: form.nationality || undefined,
        gender: form.gender || undefined,
        nextOfKinName: form.nextOfKinName || undefined,
        nextOfKinPhone: form.nextOfKinPhone || undefined,
        nextOfKinRelation: form.nextOfKinRelation || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Personal info updated");
      setEditOpen(false);
      mutate();
    } else {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to update");
    }
  }

  async function submitBankRequest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hr/bank-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName: bankForm.bankName,
        bankAccountNumber: bankForm.bankAccountNumber,
        bankAccountName: bankForm.bankAccountName,
        notes: bankForm.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Bank detail change requested — pending approval");
      setBankForm({ bankName: "", bankAccountNumber: "", bankAccountName: "", notes: "" });
      setBankOpen(false);
      mutateBank();
    } else {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to submit request");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi, ${me.firstName}`} description="Your personal HR overview." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title} className="p-4">
            <p className="text-xs text-muted-foreground">{s.title}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
            {"sub" in s && s.sub ? (
              <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">{String(s.sub)}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending actions</h2>
            <Badge variant={pendingActions.length > 0 ? "warning" : "secondary"}>
              {pendingActions.length}
            </Badge>
          </div>
          {pendingActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
          ) : (
            <ul className="space-y-2">
              {pendingActions.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent">
                    <span>{a.label}</span>
                    <Badge variant="secondary">{a.count}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent notifications</h2>
            <Button variant="ghost" size="sm" className="h-7" asChild>
              <Link href="/hr/notifications">
                View all{unreadCount > 0 ? ` (${unreadCount} unread)` : ""}
              </Link>
            </Button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Payslips, leave updates and policy acknowledgements will show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "/hr/notifications"}
                    className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent ${n.isRead ? "opacity-70" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {n.title}
                        {!n.isRead ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-destructive align-middle" /> : null}
                      </span>
                      {n.message ? <span className="block truncate text-muted-foreground">{n.message}</span> : null}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="h-full p-5 transition-colors hover:bg-accent">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-muted p-2">
                  <l.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{l.title}</p>
                  <p className="text-sm text-muted-foreground">{l.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Profile</h2>
              <Button variant="outline" size="sm" onClick={() => openEdit(me)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
            <DetailGrid>
              <DetailField label="Employee code">
                <span className="font-mono">{me.employeeCode}</span>
              </DetailField>
              <DetailField label="Email">{me.email ?? "—"}</DetailField>
              <DetailField label="Phone">{me.phone ?? "—"}</DetailField>
              <DetailField label="Position">{me.position?.title ?? "—"}</DetailField>
              <DetailField label="Department">{me.department?.name ?? "—"}</DetailField>
              <DetailField label="Manager">
                {me.manager ? `${me.manager.firstName} ${me.manager.lastName}` : "—"}
              </DetailField>
              <DetailField label="Hire date">{me.hireDate ? fmtDate(me.hireDate) : "—"}</DetailField>
              <DetailField label="Employment type">
                {me.employmentType?.replace("_", " ") ?? "—"}
              </DetailField>
              <DetailField label="Address">{me.address || "—"}</DetailField>
              <DetailField label="Next of kin">
                {me.nextOfKinName
                  ? `${me.nextOfKinName}${me.nextOfKinPhone ? ` (${me.nextOfKinPhone})` : ""}${me.nextOfKinRelation ? ` · ${me.nextOfKinRelation}` : ""}`
                  : "—"}
              </DetailField>
            </DetailGrid>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="h-4 w-4" /> Bank Details
              </h2>
              <Button variant="outline" size="sm" onClick={() => setBankOpen(true)} disabled={!!pendingBank}>
                Request change
              </Button>
            </div>
            <DetailGrid>
              <DetailField label="Bank name">{me.bankName || "—"}</DetailField>
              <DetailField label="Account number">{me.bankAccountNumber || "—"}</DetailField>
              <DetailField label="Account name">{me.bankAccountName || "—"}</DetailField>
            </DetailGrid>
            {bankRequests.length > 0 && (
              <div className="mt-4 space-y-2">
                {bankRequests.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{r.bankName}</span> · {r.bankAccountName}
                      <span className="ml-2 text-xs text-muted-foreground">{fmtDate(r.requestedAt)}</span>
                      {r.reviewNotes ? <span className="ml-2 text-xs text-muted-foreground">— {r.reviewNotes}</span> : null}
                    </div>
                    <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Payroll Summary</h2>
            <DetailGrid>
              <DetailField label="Salary grade">{me.salaryGrade?.name ?? "—"}</DetailField>
              <DetailField label="Pay frequency">{me.payFrequency ?? "monthly"}</DetailField>
            </DetailGrid>
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Year-to-date deductions
            </h3>
            {ytdDeductions.length > 0 ? (
              <div className="divide-y rounded-md border">
                {ytdDeductions.map((d) => (
                  <div key={d.name} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="capitalize">{d.name}</span>
                    <span className="font-medium">{formatMoney(d.amount, currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payslips yet this year.</p>
            )}
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Overtime this year
            </h3>
            {overtimeByMonth.length > 0 ? (
              <div className="divide-y rounded-md border">
                {overtimeByMonth.map((o) => (
                  <div key={o.month} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{new Date(`${o.month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                    <span className="font-medium">{o.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No overtime recorded yet.</p>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Personal Info</DialogTitle>
            <DialogDescription>Changes are saved immediately and audited.</DialogDescription>
          </DialogHeader>
          <form onSubmit={savePersonal} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pe-phone">Phone</Label>
                <Input id="pe-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-gender">Gender</Label>
                <Input id="pe-gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="pe-address">Address</Label>
                <Input id="pe-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-marital">Marital status</Label>
                <Input id="pe-marital" value={form.maritalStatus} onChange={(e) => setForm((f) => ({ ...f, maritalStatus: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-nat">Nationality</Label>
                <Input id="pe-nat" value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-nok">Next of kin</Label>
                <Input id="pe-nok" value={form.nextOfKinName} onChange={(e) => setForm((f) => ({ ...f, nextOfKinName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-nokp">NOK phone</Label>
                <Input id="pe-nokp" value={form.nextOfKinPhone} onChange={(e) => setForm((f) => ({ ...f, nextOfKinPhone: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="pe-nokr">NOK relation</Label>
                <Input id="pe-nokr" value={form.nextOfKinRelation} onChange={(e) => setForm((f) => ({ ...f, nextOfKinRelation: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bankOpen} onOpenChange={setBankOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Bank Detail Change</DialogTitle>
            <DialogDescription>Your request is reviewed by payroll before it takes effect.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBankRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="br-bank">Bank name</Label>
                <Input id="br-bank" value={bankForm.bankName} onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="br-acct">Account number</Label>
                <Input id="br-acct" value={bankForm.bankAccountNumber} onChange={(e) => setBankForm((f) => ({ ...f, bankAccountNumber: e.target.value }))} required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="br-name">Account name</Label>
                <Input id="br-name" value={bankForm.bankAccountName} onChange={(e) => setBankForm((f) => ({ ...f, bankAccountName: e.target.value }))} required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="br-notes">Notes (optional)</Label>
                <Input id="br-notes" value={bankForm.notes} onChange={(e) => setBankForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBankOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Submit request"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}