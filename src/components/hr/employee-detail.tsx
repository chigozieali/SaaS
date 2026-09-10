"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ExternalLink } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department?: { id: string; name: string } | null;
  position?: { id: string; title: string } | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  hireDate?: string | null;
  employmentType?: string;
  status?: string;
  isActive: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  tin?: string | null;
  ssn?: string | null;
  salaryStructures?: Array<{
    id: string;
    basicSalary: string | number;
    allowances: Record<string, number> | null;
    effectiveFrom: string;
    isActive: boolean;
  }>;
};

type DetailData = EmployeeRow & {
  address?: string | null;
  location?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelation?: string | null;
  isConfirmed: boolean;
  terminationDate?: string | null;
  salaryGrade?: { id: string; name: string; description: string | null } | null;
  payFrequency?: string | null;
  taxOffice?: string | null;
  pfaName?: string | null;
  rsaPin?: string | null;
  pensionPct?: number | string | null;
  hmoPlan?: string | null;
  nhiaPct?: number | string | null;
  salaryStructures?: Array<{
    id: string;
    basicSalary: string | number;
    allowances: Record<string, number> | null;
    effectiveFrom: string;
    isActive: boolean;
  }>;
  salaryChanges?: Array<{
    id: string;
    previousBasic: string | number | null;
    newBasic: string | number | null;
    effectiveFrom: string;
    reason: string | null;
    changedAt: string;
  }>;
  benefitEnrollments?: Array<{
    id: string;
    coverageTier: string | null;
    employeeContribution: string | number | null;
    effectiveFrom: string;
    isActive: boolean;
    plan: { id: string; name: string; type: string; premium: string | number | null };
  }>;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    category: string | null;
    fileUrl: string;
    notes: string | null;
    acknowledgedAt: string | null;
    createdAt: string;
  }>;
  disciplinaryRecords?: Array<{
    id: string;
    incidentDate: string;
    type: string;
    description: string;
    actionTaken: string | null;
  }>;
  acknowledgements?: Array<{
    id: string;
    policyName: string;
    documentId: string | null;
    notes: string | null;
    acknowledgedAt: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRow | null;
  managers: EmployeeRow[];
  canEdit: boolean;
  canPayroll: boolean;
  onUpdated: (employee?: EmployeeRow) => void;
};

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  location: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  nationality: "",
  nextOfKinName: "",
  nextOfKinPhone: "",
  nextOfKinRelation: "",
  isConfirmed: false,
  departmentId: "",
  positionId: "",
  managerId: "",
  employmentType: "permanent",
  hireDate: "",
};

const emptyPayrollForm = {
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  tin: "",
  taxOffice: "",
  pfaName: "",
  rsaPin: "",
  pensionPct: "",
  hmoPlan: "",
  nhiaPct: "",
  payFrequency: "monthly",
  salaryGradeId: "",
};

const emptyDocForm = { name: "", category: "contract", fileUrl: "", notes: "" };
const emptyDiscForm = { incidentDate: "", type: "", description: "", actionTaken: "" };

const fmt = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

const catBadgeVariant = (cat: string | null) =>
  cat === "policy" || cat === "handbook"
    ? "secondary"
    : cat === "contract"
      ? "outline"
      : "default";

export function EmployeeDetail({
  open,
  onOpenChange,
  employee,
  managers,
  canEdit,
  canPayroll,
  onUpdated,
}: Props) {
  const { data: deptData } = useSWR("/api/hr/departments", fetcher);
  const { data: posData } = useSWR("/api/hr/positions", fetcher);
  const { data: gradesData } = useSWR("/api/hr/salary-grades", fetcher);
  const { data: detail, mutate: mutateDetail } = useSWR<{ employee: DetailData }>(
    employee ? `/api/hr/employees/${employee.id}` : null,
    fetcher
  );
  const record: DetailData = detail?.employee ?? (employee as DetailData) ?? null;

  const [tab, setTab] = useState("hri");
  const [mode, setMode] = useState<"view" | "edit-hr" | "edit-pay">("view");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [payForm, setPayForm] = useState(emptyPayrollForm);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const [discForm, setDiscForm] = useState(emptyDiscForm);
  const [showDocForm, setShowDocForm] = useState(false);
  const [showDiscForm, setShowDiscForm] = useState(false);
  const [ackUrl, setAckUrl] = useState("");

  const departments = deptData?.departments ?? [];
  const positions = posData?.positions ?? [];
  const grades = gradesData?.grades ?? [];
  const managerOptions = useMemo(
    () =>
      managers
        .filter((m) => m.id !== employee?.id)
        .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` })),
    [managers, employee]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode("view");
    setTab("hri");
    setShowDocForm(false);
    setShowDiscForm(false);
    setAckUrl("");
    if (employee) {
      setForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        address: (employee as DetailData).address ?? "",
        location: (employee as DetailData).location ?? "",
        dateOfBirth: (employee as DetailData).dateOfBirth
          ? String((employee as DetailData).dateOfBirth).slice(0, 10)
          : "",
        gender: (employee as DetailData).gender ?? "",
        maritalStatus: (employee as DetailData).maritalStatus ?? "",
        nationality: (employee as DetailData).nationality ?? "",
        nextOfKinName: (employee as DetailData).nextOfKinName ?? "",
        nextOfKinPhone: (employee as DetailData).nextOfKinPhone ?? "",
        nextOfKinRelation: (employee as DetailData).nextOfKinRelation ?? "",
        isConfirmed: Boolean((employee as DetailData).isConfirmed),
        departmentId: employee.department?.id ?? "",
        positionId: employee.position?.id ?? "",
        managerId: employee.manager?.id ?? "",
        employmentType: employee.employmentType ?? "permanent",
        hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : "",
      });
      setPayForm({
        bankName: (employee as DetailData).bankName ?? "",
        bankAccountNumber: (employee as DetailData).bankAccountNumber ?? "",
        bankAccountName: (employee as DetailData).bankAccountName ?? "",
        tin: (employee as DetailData).tin ?? "",
        taxOffice: (employee as DetailData).taxOffice ?? "",
        pfaName: (employee as DetailData).pfaName ?? "",
        rsaPin: (employee as DetailData).rsaPin ?? "",
        pensionPct: (employee as DetailData).pensionPct != null ? String((employee as DetailData).pensionPct) : "",
        hmoPlan: (employee as DetailData).hmoPlan ?? "",
        nhiaPct: (employee as DetailData).nhiaPct != null ? String((employee as DetailData).nhiaPct) : "",
        payFrequency: (employee as DetailData).payFrequency ?? "monthly",
        salaryGradeId: (employee as DetailData).salaryGrade?.id ?? "",
      });
    }
  }, [open, employee]);

  if (!record) return null;

  const activeSalary = record.salaryStructures?.[0];
  const allowances =
    activeSalary && typeof activeSalary.allowances === "object" && activeSalary.allowances
      ? (activeSalary.allowances as Record<string, number>)
      : null;

  const update =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const updatePay =
    (key: keyof typeof payForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setPayForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSaveHr(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        location: form.location || undefined,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || undefined,
        maritalStatus: form.maritalStatus || undefined,
        nationality: form.nationality || undefined,
        nextOfKinName: form.nextOfKinName || undefined,
        nextOfKinPhone: form.nextOfKinPhone || undefined,
        nextOfKinRelation: form.nextOfKinRelation || undefined,
        isConfirmed: form.isConfirmed,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        managerId: form.managerId || null,
        employmentType: form.employmentType,
        hireDate: form.hireDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("HR details updated");
      mutateDetail();
      onUpdated();
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update employee");
    }
  }

  async function handleSavePay(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName: payForm.bankName || undefined,
        bankAccountNumber: payForm.bankAccountNumber || undefined,
        bankAccountName: payForm.bankAccountName || undefined,
        tin: payForm.tin || undefined,
        taxOffice: payForm.taxOffice || undefined,
        pfaName: payForm.pfaName || undefined,
        rsaPin: payForm.rsaPin || undefined,
        pensionPct: payForm.pensionPct ? Number(payForm.pensionPct) : null,
        hmoPlan: payForm.hmoPlan || undefined,
        nhiaPct: payForm.nhiaPct ? Number(payForm.nhiaPct) : null,
        payFrequency: payForm.payFrequency,
        salaryGradeId: payForm.salaryGradeId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Payroll details updated");
      mutateDetail();
      onUpdated();
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update payroll details");
    }
  }

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${record.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: docForm.name,
        category: docForm.category || undefined,
        fileUrl: docForm.fileUrl,
        notes: docForm.notes || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Document added");
      setDocForm(emptyDocForm);
      setShowDocForm(false);
      mutateDetail();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to add document");
    }
  }

  async function handleDeleteDoc(docId: string) {
    const res = await fetch(`/api/hr/employees/${record.id}/documents?documentId=${docId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Document removed");
      mutateDetail();
    } else {
      toast.error("Failed to remove document");
    }
  }

  async function handleAddDisc(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${record.id}/disciplinary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentDate: discForm.incidentDate,
        type: discForm.type,
        description: discForm.description,
        actionTaken: discForm.actionTaken || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Record added");
      setDiscForm(emptyDiscForm);
      setShowDiscForm(false);
      mutateDetail();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to add record");
    }
  }

  async function handleAck() {
    if (!ackUrl.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${record.id}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "",
        documentUrl: ackUrl,
        policyName: "General company policy",
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Acknowledged");
      setAckUrl("");
      mutateDetail();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to acknowledge");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record.firstName} {record.lastName}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{record.employeeCode}</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="hri">HR Info</TabsTrigger>
            <TabsTrigger value="pay">Payroll Info</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
            <TabsTrigger value="comp">Compliance</TabsTrigger>
            <TabsTrigger value="ben">Benefits</TabsTrigger>
          </TabsList>

          {/* ------------------------------ HR INFO ------------------------------ */}
          <TabsContent value="hri">
            {mode === "edit-hr" ? (
              <form onSubmit={handleSaveHr} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hd-firstName">First name</Label>
                    <Input id="hd-firstName" value={form.firstName} onChange={update("firstName")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-lastName">Last name</Label>
                    <Input id="hd-lastName" value={form.lastName} onChange={update("lastName")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-email">Email</Label>
                    <Input id="hd-email" type="email" value={form.email} onChange={update("email")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-phone">Phone</Label>
                    <Input id="hd-phone" value={form.phone} onChange={update("phone")} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="hd-address">Address</Label>
                    <Input id="hd-address" value={form.address} onChange={update("address")} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="hd-location">Work location</Label>
                    <Input id="hd-location" value={form.location} onChange={update("location")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hd-dob">Date of birth</Label>
                    <Input id="hd-dob" type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-gender">Gender</Label>
                    <Input id="hd-gender" value={form.gender} onChange={update("gender")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-marital">Marital status</Label>
                    <Input id="hd-marital" value={form.maritalStatus} onChange={update("maritalStatus")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-nationality">Nationality</Label>
                    <Input id="hd-nationality" value={form.nationality} onChange={update("nationality")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-nok-name">Next of kin</Label>
                    <Input id="hd-nok-name" value={form.nextOfKinName} onChange={update("nextOfKinName")} placeholder="Name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-nok-phone">NOK phone</Label>
                    <Input id="hd-nok-phone" value={form.nextOfKinPhone} onChange={update("nextOfKinPhone")} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="hd-nok-rel">NOK relation</Label>
                    <Input id="hd-nok-rel" value={form.nextOfKinRelation} onChange={update("nextOfKinRelation")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select
                      value={form.departmentId || undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d: { id: string; name: string }) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={form.positionId || undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, positionId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((p: { id: string; title: string }) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Manager</Label>
                    <Select
                      value={form.managerId || undefined}
                      onValueChange={(v) => setForm((f) => ({ ...f, managerId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managerOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employment type</Label>
                    <Select
                      value={form.employmentType}
                      onValueChange={(v) => setForm((f) => ({ ...f, employmentType: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["permanent", "contract", "part-time", "intern", "probation"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hd-hireDate">Hire date</Label>
                    <Input id="hd-hireDate" type="date" value={form.hireDate} onChange={update("hireDate")} />
                  </div>
                </div>
                <div className="flex items-center gap-2 space-y-0">
                  <Switch
                    id="hd-confirmed"
                    checked={form.isConfirmed}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isConfirmed: v }))}
                  />
                  <Label htmlFor="hd-confirmed">Employment confirmed (probation passed)</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setMode("view")}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-6">
                <DetailGrid>
                  <DetailField label="Status">
                    <Badge variant={record.isActive ? "success" : "destructive"}>
                      {record.status === "terminated" ? "Terminated" : record.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </DetailField>
                  <DetailField label="Confirmation">
                    {record.isConfirmed ? (
                      <Badge variant="success">Confirmed</Badge>
                    ) : (
                      <Badge variant="secondary">Probation</Badge>
                    )}
                  </DetailField>
                  <DetailField label="Employment type">{record.employmentType ?? "—"}</DetailField>
                  <DetailField label="Department">{record.department?.name ?? "—"}</DetailField>
                  <DetailField label="Position">{record.position?.title ?? "—"}</DetailField>
                  <DetailField label="Manager">
                    {record.manager
                      ? `${record.manager.firstName} ${record.manager.lastName}`
                      : "—"}
                  </DetailField>
                  <DetailField label="Hire date">
                    {record.hireDate ? record.hireDate.slice(0, 10) : "—"}
                  </DetailField>
                  <DetailField label="Termination date">
                    {record.terminationDate ? record.terminationDate.slice(0, 10) : "—"}
                  </DetailField>
                  <DetailField label="Work location">{record.location || "—"}</DetailField>
                </DetailGrid>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Personal Details</h4>
                  <DetailGrid>
                    <DetailField label="Email">{record.email || "—"}</DetailField>
                    <DetailField label="Phone">{record.phone || "—"}</DetailField>
                    <DetailField label="Date of birth">
                      {record.dateOfBirth ? record.dateOfBirth.slice(0, 10) : "—"}
                    </DetailField>
                    <DetailField label="Gender">{record.gender || "—"}</DetailField>
                    <DetailField label="Marital status">{record.maritalStatus || "—"}</DetailField>
                    <DetailField label="Nationality">{record.nationality || "—"}</DetailField>
                    <DetailField label="Address" full>{record.address || "—"}</DetailField>
                  </DetailGrid>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Next of Kin</h4>
                  <DetailGrid>
                    <DetailField label="Name">{record.nextOfKinName || "—"}</DetailField>
                    <DetailField label="Phone">{record.nextOfKinPhone || "—"}</DetailField>
                    <DetailField label="Relation">{record.nextOfKinRelation || "—"}</DetailField>
                  </DetailGrid>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---------------------------- PAYROLL INFO --------------------------- */}
          <TabsContent value="pay">
            {mode === "edit-pay" ? (
              <form onSubmit={handleSavePay} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Salary grade</Label>
                    <Select
                      value={payForm.salaryGradeId || undefined}
                      onValueChange={(v) => setPayForm((f) => ({ ...f, salaryGradeId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g: { id: string; name: string }) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pay frequency</Label>
                    <Select
                      value={payForm.payFrequency}
                      onValueChange={(v) => setPayForm((f) => ({ ...f, payFrequency: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["monthly", "weekly", "bi-weekly", "daily"].map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pk-bank">Bank name</Label>
                    <Input id="pk-bank" value={payForm.bankName} onChange={updatePay("bankName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-acct">Account number</Label>
                    <Input id="pk-acct" value={payForm.bankAccountNumber} onChange={updatePay("bankAccountNumber")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-acct-name">Account name</Label>
                    <Input id="pk-acct-name" value={payForm.bankAccountName} onChange={updatePay("bankAccountName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-tin">TIN</Label>
                    <Input id="pk-tin" value={payForm.tin} onChange={updatePay("tin")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-taxoffice">Tax office</Label>
                    <Input id="pk-taxoffice" value={payForm.taxOffice} onChange={updatePay("taxOffice")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-pfa">PFA name</Label>
                    <Input id="pk-pfa" value={payForm.pfaName} onChange={updatePay("pfaName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-rsa">RSA PIN</Label>
                    <Input id="pk-rsa" value={payForm.rsaPin} onChange={updatePay("rsaPin")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-pension">Pension %</Label>
                    <Input
                      id="pk-pension"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={payForm.pensionPct}
                      onChange={updatePay("pensionPct")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-hmo">HMO plan</Label>
                    <Input id="pk-hmo" value={payForm.hmoPlan} onChange={updatePay("hmoPlan")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pk-nhia">NHIA %</Label>
                    <Input
                      id="pk-nhia"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={payForm.nhiaPct}
                      onChange={updatePay("nhiaPct")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setMode("view")}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Compensation</h4>
                  <DetailGrid>
                    <DetailField label="Salary grade">
                      {record.salaryGrade
                        ? `${record.salaryGrade.name}${record.salaryGrade.description ? ` — ${record.salaryGrade.description}` : ""}`
                        : "—"}
                    </DetailField>
                    <DetailField label="Pay frequency">{record.payFrequency ?? "monthly"}</DetailField>
                    <DetailField label="Basic salary">
                      {activeSalary ? fmt(activeSalary.basicSalary) : "—"}
                    </DetailField>
                    <DetailField label="Effective from">
                      {activeSalary ? activeSalary.effectiveFrom.slice(0, 10) : "—"}
                    </DetailField>
                    {allowances && Object.keys(allowances).length > 0 && (
                      <DetailField label="Allowances" full>
                        {Object.entries(allowances)
                          .map(([name, amount]) => `${name}: ${fmt(amount)}`)
                          .join(", ")}
                      </DetailField>
                    )}
                  </DetailGrid>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Bank & Tax</h4>
                  <DetailGrid>
                    <DetailField label="Bank name">{record.bankName || "—"}</DetailField>
                    <DetailField label="Account number">{record.bankAccountNumber || "—"}</DetailField>
                    <DetailField label="Account name">{record.bankAccountName || "—"}</DetailField>
                    <DetailField label="TIN">{record.tin || "—"}</DetailField>
                    <DetailField label="Tax office">{record.taxOffice || "—"}</DetailField>
                  </DetailGrid>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Pension & Social Health</h4>
                  <DetailGrid>
                    <DetailField label="PFA name">{record.pfaName || "—"}</DetailField>
                    <DetailField label="RSA PIN">{record.rsaPin || "—"}</DetailField>
                    <DetailField label="Pension %">
                      {record.pensionPct != null ? `${record.pensionPct}%` : "—"}
                    </DetailField>
                    <DetailField label="HMO plan">{record.hmoPlan || "—"}</DetailField>
                    <DetailField label="NHIA %">
                      {record.nhiaPct != null ? `${record.nhiaPct}%` : "—"}
                    </DetailField>
                  </DetailGrid>
                </div>

                {record.salaryChanges && record.salaryChanges.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Salary History</h4>
                    <div className="divide-y rounded-md border">
                      {record.salaryChanges.map((c) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span>
                            {c.effectiveFrom.slice(0, 10)}
                            {c.reason ? ` · ${c.reason}` : ""}
                          </span>
                          <span className="font-medium">
                            {c.previousBasic != null ? fmt(c.previousBasic) : "—"} →{" "}
                            {c.newBasic != null ? fmt(c.newBasic) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ------------------------------ DOCUMENTS ---------------------------- */}
          <TabsContent value="docs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Employee Documents</h4>
                {canEdit && !showDocForm && (
                  <Button size="sm" onClick={() => setShowDocForm(true)}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                )}
              </div>

              {showDocForm && (
                <form onSubmit={handleAddDoc} className="space-y-3 rounded-md border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="doc-name">Document name</Label>
                      <Input
                        id="doc-name"
                        value={docForm.name}
                        onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select
                        value={docForm.category}
                        onValueChange={(v) => setDocForm((f) => ({ ...f, category: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["contract", "handbook", "policy", "hr", "payroll", "certificate", "other"].map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="doc-url">File URL</Label>
                      <Input
                        id="doc-url"
                        type="url"
                        value={docForm.fileUrl}
                        onChange={(e) => setDocForm((f) => ({ ...f, fileUrl: e.target.value }))}
                        placeholder="https://…"
                        required
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="doc-notes">Notes</Label>
                      <Textarea
                        id="doc-notes"
                        value={docForm.notes}
                        onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowDocForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? "Adding…" : "Add document"}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {record.documents && record.documents.length > 0 ? (
                <div className="divide-y rounded-md border">
                  {record.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-sm font-medium underline-offset-2 hover:underline"
                          >
                            {doc.name}
                          </a>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {doc.category ? (
                            <Badge variant={catBadgeVariant(doc.category) as "default"}>{doc.category}</Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">{doc.createdAt.slice(0, 10)}</span>
                          {doc.acknowledgedAt ? (
                            <Badge variant="success">Acknowledged</Badge>
                          ) : (
                            <Badge variant="secondary">Not acknowledged</Badge>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteDoc(doc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents recorded.</p>
              )}
            </div>
          </TabsContent>

          {/* ------------------------------ COMPLIANCE --------------------------- */}
          <TabsContent value="comp">
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Disciplinary Records</h4>
                  {canEdit && !showDiscForm && (
                    <Button size="sm" onClick={() => setShowDiscForm(true)}>
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  )}
                </div>

                {showDiscForm && (
                  <form onSubmit={handleAddDisc} className="mb-3 space-y-3 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="disc-date">Incident date</Label>
                        <Input
                          id="disc-date"
                          type="date"
                          value={discForm.incidentDate}
                          onChange={(e) => setDiscForm((f) => ({ ...f, incidentDate: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="disc-type">Type</Label>
                        <Input
                          id="disc-type"
                          value={discForm.type}
                          onChange={(e) => setDiscForm((f) => ({ ...f, type: e.target.value }))}
                          placeholder="e.g. lateness, misconduct"
                          required
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor="disc-desc">Description</Label>
                        <Textarea
                          id="disc-desc"
                          value={discForm.description}
                          onChange={(e) => setDiscForm((f) => ({ ...f, description: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor="disc-action">Action taken</Label>
                        <Input
                          id="disc-action"
                          value={discForm.actionTaken}
                          onChange={(e) => setDiscForm((f) => ({ ...f, actionTaken: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowDiscForm(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={saving}>
                        {saving ? "Adding…" : "Add record"}
                      </Button>
                    </DialogFooter>
                  </form>
                )}

                {record.disciplinaryRecords && record.disciplinaryRecords.length > 0 ? (
                  <div className="divide-y rounded-md border">
                    {record.disciplinaryRecords.map((r) => (
                      <div key={r.id} className="px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{r.type}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.incidentDate.slice(0, 10)}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{r.description}</p>
                        {r.actionTaken && (
                          <p className="mt-1 text-xs">
                            <span className="font-medium">Action:</span> {r.actionTaken}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No disciplinary records.</p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Policy Acknowledgements</h4>
                {record.acknowledgements && record.acknowledgements.length > 0 ? (
                  <div className="divide-y rounded-md border">
                    {record.acknowledgements.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="font-medium">{a.policyName}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.acknowledgedAt.slice(0, 10)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No acknowledgements recorded.</p>
                )}
                {canEdit && (
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Policy URL to acknowledge (https://…)"
                      value={ackUrl}
                      onChange={(e) => setAckUrl(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleAck} disabled={saving || !ackUrl.trim()}>
                      Acknowledge
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------- BENEFITS ---------------------------- */}
          <TabsContent value="ben">
            <h4 className="mb-2 text-sm font-semibold">Enrolled Benefit Plans</h4>
            {record.benefitEnrollments && record.benefitEnrollments.length > 0 ? (
              <div className="divide-y rounded-md border">
                {record.benefitEnrollments.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">
                        {b.plan.name}
                        {b.coverageTier ? ` (${b.coverageTier})` : ""}
                      </div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {b.plan.type}
                        {b.plan.premium != null ? ` · premium ${fmt(b.plan.premium)}` : ""}
                        {b.employeeContribution != null
                          ? ` · employee share ${fmt(b.employeeContribution)}`
                          : ""}
                      </div>
                    </div>
                    <Badge variant={b.isActive ? "success" : "secondary"}>
                      {b.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No benefit plan enrollments.</p>
            )}
          </TabsContent>
        </Tabs>

        {mode === "view" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEdit && tab === "hri" && <Button onClick={() => setMode("edit-hr")}>Edit HR Info</Button>}
            {canPayroll && tab === "pay" && <Button onClick={() => setMode("edit-pay")}>Edit Payroll Info</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}