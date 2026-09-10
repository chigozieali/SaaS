import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { notifyUsersByEmail } from "@/lib/notify";

const categories = ["contract", "handbook", "policy", "hr", "payroll", "certificate", "other"] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!employee) return apiError("Employee not found", 404);

  const documents = await db.employeeDocument.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
  });
  return apiOk({ documents });
}

const postSchema = z.object({
  name: z.string().min(1),
  type: z.string().default("document"),
  category: z.enum(categories).optional(),
  fileUrl: z.string().url().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!employee) return apiError("Employee not found", 404);

  const doc = await db.employeeDocument.create({
    data: {
      employeeId: id,
      name: parsed.data.name,
      type: parsed.data.type,
      category: parsed.data.category || null,
      fileUrl: parsed.data.fileUrl,
      notes: parsed.data.notes || null,
    },
  });

  if (parsed.data.category === "policy") {
    await notifyUsersByEmail(ctx.organizationId, [employee.email ?? ""], {
      title: "New policy to acknowledge",
      message: `${employee.firstName}, please review and acknowledge "${parsed.data.name}".`,
      type: "info",
      link: "/hr/my-documents",
    });
  }

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "employee_document",
    entityId: doc.id,
  });
  return apiOk({ document: doc }, 201);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const url = new URL(req.url);
  const docId = url.searchParams.get("documentId");
  if (!docId) return apiError("documentId is required");

  const doc = await db.employeeDocument.findFirst({
    where: { id: docId, employeeId: id, employee: { organizationId: ctx.organizationId } },
  });
  if (!doc) return apiError("Document not found", 404);

  await db.employeeDocument.delete({ where: { id: docId } });
  return apiOk({ ok: true });
}

const ackSchema = z.object({
  documentId: z.string().min(1),
  documentUrl: z.string().url().min(1),
  policyName: z.string().min(1),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!employee) return apiError("Employee not found", 404);

  await db.$transaction(async (tx) => {
    const doc = await tx.employeeDocument.findFirst({
      where: { id: parsed.data.documentId, employeeId: id },
    });
    if (!doc) {
      await tx.employeeDocument.create({
        data: {
          employeeId: id,
          name: parsed.data.policyName,
          type: "policy",
          category: "policy",
          fileUrl: parsed.data.documentUrl,
          notes: parsed.data.notes || null,
          acknowledgedAt: new Date(),
        },
      });
    } else {
      await tx.employeeDocument.update({
        where: { id: doc.id },
        data: { acknowledgedAt: new Date() },
      });
    }
    await tx.policyAcknowledgement.create({
      data: {
        employeeId: id,
        policyName: parsed.data.policyName,
        documentId: parsed.data.documentId,
        notes: parsed.data.notes || null,
      },
    });
  }, { timeout: 30_000 });

  return apiOk({ ok: true });
}