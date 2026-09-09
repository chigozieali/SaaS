"use client";

import Link from "next/link";
import useSWR from "swr";
import { CalendarCheck2, Plane, UsersRound, Wallet } from "lucide-react";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type Me = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  hireDate: string | null;
  employmentType: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
};

type MyRecordsData = {
  me: Me | null;
  leaves: { id: string; status: string; days: number }[];
  leaveBalance: { allowed: number; taken: number; remaining: number }[];
  payslips: { netPay: string; periodName: string }[];
  currency: string;
};

const links = [
  { title: "My Attendance", href: "/hr/my-attendance", icon: CalendarCheck2, desc: "Your attendance and relief coverage" },
  { title: "My Leave", href: "/hr/my-leave", icon: Plane, desc: "Leave balance, history and requests" },
  { title: "My Payslips", href: "/hr/my-payslips", icon: Wallet, desc: "Your payslips and salary" },
  { title: "My Team", href: "/hr/my-team", icon: UsersRound, desc: "Colleagues and their leave status" },
];

export function MyRecordsClient() {
  const { data } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const me = data?.me ?? null;
  const leaves = data?.leaves ?? [];
  const leaveBalance = data?.leaveBalance ?? [];
  const payslips = data?.payslips ?? [];

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

  const stats = [
    { title: `Leave used (${new Date().getFullYear()})`, value: `${totalTaken.toFixed(1)} / ${totalAllowed.toFixed(1)} days` },
    { title: "Leave remaining", value: `${totalRemaining.toFixed(1)} days` },
    { title: "Pending approvals", value: String(leaves.filter((l) => l.status === "pending").length) },
    {
      title: "Latest net pay",
      value: payslips.length ? formatMoney(Number(payslips[0].netPay), currency) : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${me.firstName}`}
        description="Your personal HR overview."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title} className="p-4">
            <p className="text-xs text-muted-foreground">{s.title}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
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

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold">Profile</h2>
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
        </DetailGrid>
      </Card>
    </div>
  );
}