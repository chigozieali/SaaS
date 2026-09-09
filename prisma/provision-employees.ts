import { db } from "../src/lib/prisma";
import { provisionEmployeeAccount, DEFAULT_EMPLOYEE_PASSWORD } from "../src/lib/provision";

// Creates login accounts for existing, active employees that don't have one.
// Only assigns the non-admin "Employee" role and never touches organization owners.
// Idempotent: safe to re-run.
async function main() {
  const orgs = await db.organization.findMany({
    where: { employees: { some: {} } },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const lines: string[] = [];
  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const org of orgs) {
    const employees = await db.employee.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { employeeCode: "asc" },
    });

    for (const emp of employees) {
      const result = await db.$transaction(
        (tx) =>
          provisionEmployeeAccount(tx, {
            organizationId: org.id,
            employeeId: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
          }),
        { timeout: 30_000 }
      );

      const name = `${emp.firstName} ${emp.lastName}`.trim();
      if (result.status === "created") {
        created += 1;
        lines.push(`${org.name} | ${emp.employeeCode} | ${name} | ${result.email} | ${result.password}`);
      } else if (result.status === "linked") {
        linked += 1;
        lines.push(`${org.name} | ${emp.employeeCode} | ${name} | ${result.email} | already has an account`);
      } else {
        skipped += 1;
        lines.push(`${org.name} | ${emp.employeeCode} | ${name} | ${result.email} | skipped (${result.reason})`);
      }
    }
  }

  console.log("=== Provisioned employee accounts ===");
  console.log(lines.length ? lines.join("\n") : "(no employees found)");
  console.log(
    `\nSummary: ${created} created, ${linked} linked to existing accounts, ${skipped} skipped.`
  );
  console.log(`New accounts use default password: ${DEFAULT_EMPLOYEE_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});