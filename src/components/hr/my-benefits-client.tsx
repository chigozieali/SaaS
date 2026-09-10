"use client";

import useSWR from "swr";
import { HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type BenefitRow = {
  id: string;
  coverageTier: string | null;
  employeeContribution: number | string | null;
  effectiveFrom: string;
  plan: {
    name: string;
    type: string;
    description: string | null;
    employerSharePct: number | string | null;
    employeeSharePct: number | string | null;
    premium: number | string | null;
  };
};

type MyRecordsData = {
  me: { firstName: string } | null;
  benefits: BenefitRow[];
  payslips: {
    breakdown: {
      deductions?: Record<string, number>;
      tax?: Record<string, number>;
      contributions?: Record<string, number>;
    };
  }[];
  salary: { basicSalary: number; payFrequency?: string } | null;
  currency: string;
};

function entryList(obj: Record<string, number> | undefined): Array<[string, number]> {
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => [k, Number(v ?? 0)]);
}

export function MyBenefitsClient() {
  const { data } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);

  if (!data) return null;

  if (!data.me) {
    return (
      <div>
        <PageHeader title="My Benefits" description="Your benefits and pay deductions." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  const benefits = data.benefits ?? [];
  const currency = data.currency ?? "NGN";
  const latest = data.payslips?.[0]?.breakdown;
  const dedList = entryList(latest?.deductions);
  const taxList = entryList(latest?.tax);

  return (
    <div className="space-y-6">
      <PageHeader title="My Benefits" description="Your enrolled benefits and contributions." />

      {benefits.length === 0 ? (
        <EmptyState
          title="No benefits enrolled"
          description="Benefits you're enrolled in will appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-muted p-2">
                    <HeartPulse className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{b.plan.name}</p>
                    <p className="text-xs text-muted-foreground">{b.plan.type}</p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              {b.plan.description ? (
                <p className="mb-3 text-sm text-muted-foreground">{b.plan.description}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Coverage tier</p>
                  <p className="font-medium">{b.coverageTier ?? "Standard"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Effective since</p>
                  <p className="font-medium">{fmtDate(b.effectiveFrom)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employee share</p>
                  <p className="font-medium">
                    {b.plan.employeeSharePct != null ? `${Number(b.plan.employeeSharePct)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Employer share</p>
                  <p className="font-medium">
                    {b.plan.employerSharePct != null ? `${Number(b.plan.employerSharePct)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly premium</p>
                  <p className="font-medium">
                    {b.plan.premium != null ? formatMoney(Number(b.plan.premium), currency) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Your contribution</p>
                  <p className="font-medium">
                    {b.employeeContribution != null
                      ? formatMoney(Number(b.employeeContribution), currency)
                      : "—"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Deductions on your last pay</h2>
          {dedList.length === 0 && taxList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payslip deduction data yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {taxList.map(([k, v]) => (
                <div key={`tax-${k}`} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="font-medium">{formatMoney(v, currency)}</span>
                </div>
              ))}
              {dedList.map(([k, v]) => (
                <div key={`ded-${k}`} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="font-medium">{formatMoney(v, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Employer contributions</h2>
          {entryList(latest?.contributions).length === 0 ? (
            <p className="text-sm text-muted-foreground">No contribution data yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {entryList(latest?.contributions).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="font-medium">{formatMoney(v, currency)}</span>
                </div>
              ))}
            </div>
          )}
          {data.salary ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Basic salary {formatMoney(data.salary.basicSalary, currency)} ({data.salary.payFrequency ?? "monthly"})
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}