import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { getSession } from "@/lib/session";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  gender: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal("").optional()),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinRelation: z.string().optional(),
});

function isEmptyOrUndefined(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

async function findMe(organizationId: string, email: string) {
  return db.employee.findFirst({
    where: { organizationId, email },
  });
}

function toProfile(me: {
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
  dateOfBirth: Date | null;
  nextOfKinName: string | null;
  nextOfKinPhone: string | null;
  nextOfKinRelation: string | null;
  photoUrl: string | null;
}) {
  return {
    id: me.id,
    firstName: me.firstName,
    lastName: me.lastName,
    employeeCode: me.employeeCode,
    email: me.email,
    phone: me.phone,
    address: me.address,
    maritalStatus: me.maritalStatus,
    nationality: me.nationality,
    gender: me.gender,
    dateOfBirth: me.dateOfBirth,
    nextOfKinName: me.nextOfKinName,
    nextOfKinPhone: me.nextOfKinPhone,
    nextOfKinRelation: me.nextOfKinRelation,
    photoUrl: me.photoUrl,
  };
}

// Self-service account overview: profile, sessions, login history, preferences,
// bank details and tax/pension identifiers for the signed-in employee.
export async function GET() {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const session = await getSession();
  const currentDeviceSessionId = session?.user.deviceSessionId ?? null;

  const me = await findMe(ctx.organizationId, ctx.user.email ?? "");
  if (!me) {
    return apiOk({
      me: null,
      user: { name: ctx.user.name, email: ctx.user.email },
      bank: { current: null, requests: [] },
      taxPension: { tin: null, taxOffice: null, pfaName: null, rsaPin: null, requests: [] },
      sessions: [],
      loginHistory: [],
      notificationPreferences: [],
      currentDeviceSessionId,
    });
  }

  const [bankRequests, sessions, loginEvents, preferences, taxRequests] = await Promise.all([
    db.bankDetailRequest.findMany({
      where: { employeeId: me.id },
      orderBy: { requestedAt: "desc" },
      take: 10,
    }),
    db.deviceSession.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.loginEvent.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notificationPreference.findMany({
      where: { userId: ctx.userId, organizationId: ctx.organizationId },
    }),
    db.taxPensionEditRequest.findMany({
      where: { employeeId: me.id },
      orderBy: { requestedAt: "desc" },
      take: 5,
    }),
  ]);

  return apiOk({
    me: toProfile(me),
    user: { name: ctx.user.name, email: ctx.user.email },
    bank: {
      current: {
        bankName: me.bankName,
        bankAccountNumber: me.bankAccountNumber,
        bankAccountName: me.bankAccountName,
      },
      requests: bankRequests,
    },
    taxPension: {
      tin: me.tin,
      taxOffice: me.taxOffice,
      pfaName: me.pfaName,
      rsaPin: me.rsaPin,
      requests: taxRequests,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      active: s.active,
      isCurrent: s.id === currentDeviceSessionId,
    })),
    loginHistory: loginEvents,
    notificationPreferences: preferences.map((p) => ({
      eventKey: p.eventKey,
      emailEnabled: p.emailEnabled,
      inAppEnabled: p.inAppEnabled,
    })),
    currentDeviceSessionId,
  });
}

// Self-service personal info update. Saved immediately (audit-logged).
export async function PUT(req: Request) {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const me = await findMe(ctx.organizationId, ctx.user.email ?? "");
  if (!me) {
    return apiError("No employee record linked to your account. Ask an administrator to match your employee email to your login email.", 403);
  }

  const data = parsed.data;
  const updated = await db.employee.update({
    where: { id: me.id },
    data: {
      phone: isEmptyOrUndefined(data.phone) ? me.phone : data.phone,
      address: isEmptyOrUndefined(data.address) ? null : data.address,
      maritalStatus: isEmptyOrUndefined(data.maritalStatus) ? me.maritalStatus : data.maritalStatus,
      nationality: isEmptyOrUndefined(data.nationality) ? me.nationality : data.nationality,
      gender: isEmptyOrUndefined(data.gender) ? me.gender : data.gender,
      photoUrl: isEmptyOrUndefined(data.photoUrl) ? null : data.photoUrl,
      nextOfKinName: isEmptyOrUndefined(data.nextOfKinName) ? me.nextOfKinName : data.nextOfKinName,
      nextOfKinPhone: isEmptyOrUndefined(data.nextOfKinPhone) ? me.nextOfKinPhone : data.nextOfKinPhone,
      nextOfKinRelation: isEmptyOrUndefined(data.nextOfKinRelation) ? me.nextOfKinRelation : data.nextOfKinRelation,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      email: true,
      phone: true,
      address: true,
      maritalStatus: true,
      nationality: true,
      gender: true,
      dateOfBirth: true,
      nextOfKinName: true,
      nextOfKinPhone: true,
      nextOfKinRelation: true,
      photoUrl: true,
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "employee",
    entityId: me.id,
    metadata: { source: "self-service", fields: Object.keys(data).length > 0 ? Object.keys(data) : undefined },
  });

  return apiOk({ me: toProfile(updated) });
}