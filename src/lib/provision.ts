import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { seedPermissions } from "@/lib/onboarding";

// Default password assigned to auto-provisioned employee accounts.
// Employees are expected to change it on first login.
export const DEFAULT_EMPLOYEE_PASSWORD = "Welcome@123";

export type ProvisionResult = {
  status: "created" | "linked" | "skipped";
  email: string;
  password?: string;
  reason?: string;
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

async function getOrCreateEmployeeRole(tx: Prisma.TransactionClient, organizationId: string) {
  const role = await tx.organizationRole.findUnique({
    where: { organizationId_name: { organizationId, name: "Employee" } },
  });
  if (role) return role;

  const created = await tx.organizationRole.create({
    data: { organizationId, name: "Employee", isSystem: true },
  });
  for (const key of DEFAULT_ROLE_PERMISSIONS.Employee) {
    await tx.rolePermission.create({ data: { roleId: created.id, permissionKey: key } });
  }
  return created;
}

async function findUserByEmail(tx: Prisma.TransactionClient, email: string) {
  return tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
}

/**
 * Creates a login account (User + Employee-role membership) for an employee.
 * Idempotent:
 *  - If the employee's email has no user account yet, one is created with the
 *    default password and an Employee-role membership.
 *  - If a user already exists with that email and is a member of the org, the
 *    account is linked (never demotes organization owners).
 *  - If the employee has no email, one is generated from their name.
 */
export async function provisionEmployeeAccount(
  tx: Prisma.TransactionClient,
  opts: {
    organizationId: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  }
): Promise<ProvisionResult> {
  await seedPermissions();
  const role = await getOrCreateEmployeeRole(tx, opts.organizationId);

  let email = opts.email?.trim().toLowerCase();
  if (!email) {
    const base = `${slug(opts.firstName)}.${slug(opts.lastName)}`;
    email = `${base}@demo.local`;
    let i = 2;
    while (await findUserByEmail(tx, email!)) {
      email = `${base}${i}@demo.local`;
      i += 1;
    }
  }

  let user = await findUserByEmail(tx, email);
  if (user) {
    const membership = await tx.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: opts.organizationId } },
    });
    if (membership) {
      if (membership.isOwner) {
        return { status: "skipped", email, reason: "organization owner" };
      }
      await tx.employee.update({ where: { id: opts.employeeId }, data: { email } });
      return { status: "linked", email };
    }
    await tx.userOrganization.create({
      data: { userId: user.id, organizationId: opts.organizationId, roleId: role.id, status: "active" },
    });
    await tx.employee.update({ where: { id: opts.employeeId }, data: { email } });
    return { status: "linked", email };
  }

  const passwordHash = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 10);
  user = await tx.user.create({
    data: {
      email,
      name: `${opts.firstName} ${opts.lastName}`.trim(),
      passwordHash,
      isActive: true,
    },
  });
  await tx.userOrganization.create({
    data: { userId: user.id, organizationId: opts.organizationId, roleId: role.id, status: "active" },
  });
  await tx.employee.update({ where: { id: opts.employeeId }, data: { email } });

  return { status: "created", email, password: DEFAULT_EMPLOYEE_PASSWORD };
}