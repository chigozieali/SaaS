"use client";

import useSWR from "swr";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type DocRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  fileUrl: string;
  notes: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

type AckRow = {
  id: string;
  policyName: string;
  notes: string | null;
  acknowledgedAt: string;
};

type MyRecordsData = {
  me: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null;
  documents: DocRow[];
  acknowledgements: AckRow[];
};

const categoryBadge: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  contract: "success",
  handbook: "info",
  policy: "warning",
  payroll: "info",
  certificate: "success",
};

export function MyDocumentsClient() {
  const { data, mutate } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const [working, setWorking] = useState<string | null>(null);

  if (!data) return null;

  if (!data.me) {
    return (
      <div>
        <PageHeader title="My Documents" description="Your employment documents and policies." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  const documents = data.documents ?? [];
  const acknowledgements = data.acknowledgements ?? [];
  const pendingPolicies = documents.filter(
    (d) => !d.acknowledgedAt && (d.category === "policy" || d.type === "policy")
  );

  async function acknowledge(doc: DocRow) {
    setWorking(doc.id);
    const res = await fetch("/api/hr/me/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id }),
    });
    setWorking(null);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success("Policy acknowledged");
      mutate();
    } else {
      toast.error(d?.message ?? "Failed to acknowledge");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Documents" description="Employment documents and company policies." />

      {pendingPolicies.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Policies to acknowledge</h2>
          <div className="space-y-2">
            {pendingPolicies.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Please review the policy and confirm you have read and understood it.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.fileUrl ? (
                    <Button size="sm" variant="outline" className="h-7" asChild>
                      <a href={d.fileUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" /> Open
                      </a>
                    </Button>
                  ) : null}
                  <Button size="sm" className="h-7" disabled={working === d.id} onClick={() => acknowledge(d)}>
                    <FileCheck2 className="mr-1 h-3 w-3" /> Acknowledge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card className="overflow-hidden p-2">
          <div className="divide-y">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {d.name}
                      {d.acknowledgedAt ? (
                        <Badge variant="success" className="ml-2">
                          Acknowledged
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.category ? <Badge variant={categoryBadge[d.category] ?? "secondary"} className="mr-1">{d.category}</Badge> : null}
                      {d.type} · added {fmtDate(d.createdAt)}
                      {d.acknowledgedAt ? ` · acknowledged ${fmtDate(d.acknowledgedAt)}` : ""}
                    </p>
                    {d.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{d.notes}</p> : null}
                  </div>
                </div>
                {d.fileUrl ? (
                  <Button size="sm" variant="ghost" className="h-7 shrink-0" asChild>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3 w-3" /> View
                    </a>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState title="No documents" description="Your employment documents will appear here." />
      )}

      {acknowledgements.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Acknowledgements</h2>
          <div className="divide-y rounded-md border">
            {acknowledgements.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium">{a.policyName}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(a.acknowledgedAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}