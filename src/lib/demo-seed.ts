import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";
import {
  seedPermissions,
  seedDefaultRoles,
  seedChartOfAccounts,
  seedDefaultCountryConfigsIfMissing,
} from "@/lib/onboarding";
import { computePayrollRun, finalizePayrollRun } from "@/services/payroll/service";
import { postJournalEntry, postPayrollToAccounting } from "@/services/accounting/journal";

export const DEMO_PASSWORD = "DemoPass123!";

const DEMO_ORGANIZATION = {
  name: "Demo Corp",
  slug: "demo-corp",
  currency: "NGN",
};

const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: string;
  isOwner: boolean;
}> = [
  { email: "admin@example.com", name: "Alex Admin", role: "Admin", isOwner: true },
  { email: "manager@example.com", name: "Mia Manager", role: "Manager", isOwner: false },
  { email: "accountant@example.com", name: "Chris Accountant", role: "Accountant", isOwner: false },
  { email: "employee@example.com", name: "Erin Employee", role: "Employee", isOwner: false },
];

const DEPARTMENTS = [
  { name: "Engineering", code: "ENG" },
  { name: "Sales & Marketing", code: "SALES" },
  { name: "Finance & Admin", code: "FIN" },
  { name: "Operations", code: "OPS" },
  { name: "Human Resources", code: "HR" },
];

const POSITIONS = [
  "Senior Software Engineer",
  "Software Engineer",
  "Product Manager",
  "Sales Lead",
  "Sales Representative",
  "Accountant",
  "Operations Manager",
  "HR Officer",
];

const EMPLOYEES: Array<{
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  gender: string;
  department: string;
  position: string;
  manager?: string;
  hireDate: string;
  employmentType: string;
  basicSalary: number;
  allowances: Record<string, number>;
  bankAccountNumber: string;
  bankAccountName: string;
}> = [
  {
    code: "EMP-001",
    firstName: "Ada",
    lastName: "Obi",
    email: "ada.obi@demo.local",
    gender: "Female",
    department: "Engineering",
    position: "Senior Software Engineer",
    hireDate: "2021-03-15",
    employmentType: "permanent",
    basicSalary: 900000,
    allowances: { "Housing Allowance": 300000, "Transport Allowance": 50000 },
    bankAccountNumber: "0101234567",
    bankAccountName: "Ada Obi",
  },
  {
    code: "EMP-002",
    firstName: "Tunde",
    lastName: "Bakare",
    email: "tunde.bakare@demo.local",
    gender: "Male",
    department: "Engineering",
    position: "Software Engineer",
    manager: "EMP-001",
    hireDate: "2022-08-01",
    employmentType: "permanent",
    basicSalary: 600000,
    allowances: { "Transport Allowance": 50000 },
    bankAccountNumber: "0102345678",
    bankAccountName: "Tunde Bakare",
  },
  {
    code: "EMP-003",
    firstName: "Chiamaka",
    lastName: "Okafor",
    email: "chiamaka.okafor@demo.local",
    gender: "Female",
    department: "Engineering",
    position: "Product Manager",
    manager: "EMP-001",
    hireDate: "2023-01-09",
    employmentType: "permanent",
    basicSalary: 500000,
    allowances: { "Transport Allowance": 40000 },
    bankAccountNumber: "0103456789",
    bankAccountName: "Chiamaka Okafor",
  },
  {
    code: "EMP-004",
    firstName: "Ibrahim",
    lastName: "Musa",
    email: "ibrahim.musa@demo.local",
    gender: "Male",
    department: "Sales & Marketing",
    position: "Sales Lead",
    hireDate: "2020-06-01",
    employmentType: "permanent",
    basicSalary: 350000,
    allowances: { "Car Allowance": 80000, "Communication Allowance": 30000 },
    bankAccountNumber: "0104567890",
    bankAccountName: "Ibrahim Musa",
  },
  {
    code: "EMP-005",
    firstName: "Ngozi",
    lastName: "Eze",
    email: "ngozi.eze@demo.local",
    gender: "Female",
    department: "Sales & Marketing",
    position: "Sales Representative",
    manager: "EMP-004",
    hireDate: "2024-02-12",
    employmentType: "permanent",
    basicSalary: 250000,
    allowances: { "Communication Allowance": 20000 },
    bankAccountNumber: "0105678901",
    bankAccountName: "Ngozi Eze",
  },
  {
    code: "EMP-006",
    firstName: "Fatima",
    lastName: "Sule",
    email: "fatima.sule@demo.local",
    gender: "Female",
    department: "Finance & Admin",
    position: "Accountant",
    hireDate: "2022-11-07",
    employmentType: "permanent",
    basicSalary: 280000,
    allowances: { "Transport Allowance": 30000 },
    bankAccountNumber: "0106789012",
    bankAccountName: "Fatima Sule",
  },
  {
    code: "EMP-007",
    firstName: "Emeka",
    lastName: "Nwosu",
    email: "emeka.nwosu@demo.local",
    gender: "Male",
    department: "Operations",
    position: "Operations Manager",
    hireDate: "2019-09-02",
    employmentType: "permanent",
    basicSalary: 400000,
    allowances: { "Transport Allowance": 50000, "Communication Allowance": 20000 },
    bankAccountNumber: "0107890123",
    bankAccountName: "Emeka Nwosu",
  },
  {
    code: "EMP-008",
    firstName: "Amaka",
    lastName: "Oyelaran",
    email: "amaka.oyelaran@demo.local",
    gender: "Female",
    department: "Human Resources",
    position: "HR Officer",
    hireDate: "2023-05-22",
    employmentType: "permanent",
    basicSalary: 260000,
    allowances: { "Transport Allowance": 30000 },
    bankAccountNumber: "0108901234",
    bankAccountName: "Amaka Oyelaran",
  },
];

const LEAVE_TYPES = [
  { name: "Annual Leave", daysAllowed: 20, isPaid: true },
  { name: "Sick Leave", daysAllowed: 12, isPaid: true },
  { name: "Casual Leave", daysAllowed: 5, isPaid: true },
  { name: "Unpaid Leave", daysAllowed: 0, isPaid: false },
];

const CUSTOMERS = [
  { name: "Acme Services Ltd", email: "billing@acmeservices.com", phone: "+2348011112222", address: "14 Adeola Odeku St, Victoria Island, Lagos" },
  { name: "Zenith Foods Ltd", email: "accounts@zenithfoods.com", phone: "+2348022223333", address: "22 Aba Rd, Port Harcourt" },
  { name: "GreenFields Agro", email: "finance@greenfields.ng", phone: "+2348033334444", address: "5 Ahmadu Bello Way, Kaduna" },
  { name: "BrightTech Solutions", email: "ap@brighttech.io", phone: "+2348044445555", address: "1 Admiralty Way, Lekki, Lagos" },
  { name: "Lagos Boutique", email: "hello@lagosboutique.com", phone: "+2348055556666", address: "3 Adewale St, Ikeja, Lagos" },
];

const VENDORS = [
  { name: "Lagos Rentals Ltd", email: "billing@lagosrentals.com", phone: "+2348010001111", address: "10 Bourdillon Rd, Ikoyi, Lagos" },
  { name: "OfficeMart Supplies", email: "orders@officemart.ng", phone: "+2348020001111", address: "18 Marina, Lagos Island" },
  { name: "MTN Nigeria", email: "corporate.billing@mtn.ng", phone: "+2348030001111", address: "47 Awolowo Rd, Ikoyi, Lagos" },
];

const INVOICES: Array<{
  customer: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  amountPaid: number;
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  payment?: { amount: number; date: string; reference: string };
}> = [
  {
    customer: "Acme Services Ltd",
    invoiceNumber: "INV-2026-0001",
    issueDate: "2026-08-03",
    dueDate: "2026-10-15",
    status: "sent",
    total: 4750000,
    amountPaid: 0,
    lines: [{ description: "Software development - Q3 milestone", quantity: 1, unitPrice: 4750000 }],
  },
  {
    customer: "Zenith Foods Ltd",
    invoiceNumber: "INV-2026-0002",
    issueDate: "2026-07-10",
    dueDate: "2026-08-10",
    status: "paid",
    total: 2400000,
    amountPaid: 2400000,
    lines: [{ description: "Annual maintenance contract", quantity: 1, unitPrice: 2400000 }],
    payment: { amount: 2400000, date: "2026-08-01", reference: "TRF-2026-0041" },
  },
  {
    customer: "GreenFields Agro",
    invoiceNumber: "INV-2026-0003",
    issueDate: "2026-08-14",
    dueDate: "2026-09-14",
    status: "partial",
    total: 3200000,
    amountPaid: 1400000,
    lines: [
      { description: "ERP training (batch 1)", quantity: 5, unitPrice: 240000 },
      { description: "Implementation services", quantity: 1, unitPrice: 2000000 },
    ],
    payment: { amount: 1400000, date: "2026-08-28", reference: "TRF-2026-0055" },
  },
  {
    customer: "BrightTech Solutions",
    invoiceNumber: "INV-2026-0004",
    issueDate: "2026-06-20",
    dueDate: "2026-08-20",
    status: "overdue",
    total: 1850000,
    amountPaid: 0,
    lines: [{ description: "Consulting retainers (May-Jun)", quantity: 1, unitPrice: 1850000 }],
  },
  {
    customer: "Lagos Boutique",
    invoiceNumber: "INV-2026-0005",
    issueDate: "2026-09-01",
    dueDate: "2026-11-01",
    status: "draft",
    total: 620000,
    amountPaid: 0,
    lines: [{ description: "POS integration - setup fee", quantity: 1, unitPrice: 620000 }],
  },
];

const BILLS: Array<{
  vendor: string;
  billNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  total: number;
  amountPaid: number;
  accountCode: string;
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  payment?: { amount: number; date: string; reference: string };
}> = [
  {
    vendor: "Lagos Rentals Ltd",
    billNumber: "BILL-2026-0001",
    issueDate: "2026-09-01",
    dueDate: "2026-09-30",
    status: "unpaid",
    total: 6000000,
    amountPaid: 0,
    accountCode: "5200",
    lines: [{ description: "Office rent - 3rd quarter", quantity: 1, unitPrice: 6000000 }],
  },
  {
    vendor: "OfficeMart Supplies",
    billNumber: "BILL-2026-0002",
    issueDate: "2026-08-05",
    dueDate: "2026-09-05",
    status: "partial",
    total: 850000,
    amountPaid: 300000,
    accountCode: "5400",
    lines: [{ description: "Office supplies restock", quantity: 1, unitPrice: 850000 }],
    payment: { amount: 300000, date: "2026-08-25", reference: "TRF-2026-0050" },
  },
  {
    vendor: "MTN Nigeria",
    billNumber: "BILL-2026-0003",
    issueDate: "2026-07-15",
    dueDate: "2026-08-15",
    status: "paid",
    total: 185000,
    amountPaid: 185000,
    accountCode: "5300",
    lines: [{ description: "Corporate connectivity - July", quantity: 1, unitPrice: 185000 }],
    payment: { amount: 185000, date: "2026-08-02", reference: "TRF-2026-0042" },
  },
];

const EXPENSE_CATEGORIES: Array<{ name: string; accountCode: string }> = [
  { name: "Travel", accountCode: "5500" },
  { name: "Meals & Entertainment", accountCode: "5500" },
  { name: "Office Supplies", accountCode: "5400" },
  { name: "Utilities", accountCode: "5300" },
  { name: "Software & Subscriptions", accountCode: "5600" },
  { name: "Marketing", accountCode: "5900" },
];

const EXPENSES: Array<{
  category: string;
  amount: number;
  date: string;
  description: string;
  status: string;
  accountCode: string;
}> = [
  { category: "Software & Subscriptions", amount: 95000, date: "2026-09-02", description: "AWS hosting - September", status: "approved", accountCode: "5600" },
  { category: "Travel", amount: 250000, date: "2026-08-15", description: "Client meeting - Lagos (flights + hotels)", status: "approved", accountCode: "5500" },
  { category: "Utilities", amount: 120000, date: "2026-09-04", description: "Electricity bill", status: "pending", accountCode: "5300" },
  { category: "Marketing", amount: 350000, date: "2026-09-06", description: "Brand campaign - Q3", status: "pending", accountCode: "5900" },
  { category: "Office Supplies", amount: 65000, date: "2026-08-20", description: "Ergonomic chairs", status: "rejected", accountCode: "5400" },
];

function dateFrom(y: number, m: number, day: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, day, h, min, 0, 0);
}

function dayToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekdaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function seedDemoData(): Promise<void> {
  if (process.env.SEED_DEMO_DATA === "false") {
    console.log("Skipped demo data (SEED_DEMO_DATA=false).");
    return;
  }

  await seedPermissions();

  const org = await db.organization.upsert({
    where: { slug: DEMO_ORGANIZATION.slug },
    update: {},
    create: DEMO_ORGANIZATION,
  });
  const orgId = org.id;

  await seedDefaultRoles(orgId);

  const roleNamesToIds = new Map(
    (
      await db.organizationRole.findMany({ where: { organizationId: orgId } })
    ).map((role) => [role.name, role.id])
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userByEmail = new Map<string, { id: string }>();

  for (const demo of DEMO_USERS) {
    const user = await db.user.upsert({
      where: { email: demo.email },
      update: { isActive: true },
      create: { email: demo.email, name: demo.name, passwordHash, isActive: true },
    });
    userByEmail.set(demo.email, user);

    await db.userOrganization.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      update: { isOwner: demo.isOwner, roleId: roleNamesToIds.get(demo.role) ?? null, status: "active" },
      create: {
        userId: user.id,
        organizationId: orgId,
        roleId: roleNamesToIds.get(demo.role) ?? null,
        status: "active",
        isOwner: demo.isOwner,
      },
    });
  }

  const adminUser = userByEmail.get("admin@example.com")!;

  await db.organization.update({
    where: { id: orgId },
    data: { createdById: adminUser.id },
  });

  const hasAccounts = (await db.account.count({ where: { organizationId: orgId } })) > 0;
  if (!hasAccounts) await seedChartOfAccounts(orgId);
  await seedDefaultCountryConfigsIfMissing(orgId);

  const accountsByCode = new Map(
    (await db.account.findMany({ where: { organizationId: orgId } })).map((acc) => [acc.code, acc])
  );

  const employeesExist = (await db.employee.count({ where: { organizationId: orgId } })) > 0;
  if (!employeesExist) {
    const deptIds = new Map<string, string>();
    const posIds = new Map<string, string>();

    for (const dept of DEPARTMENTS) {
      const created = await db.department.create({ data: { organizationId: orgId, ...dept } });
      deptIds.set(dept.name, created.id);
    }

    for (const title of POSITIONS) {
      const created = await db.position.create({ data: { organizationId: orgId, title } });
      posIds.set(title, created.id);
    }

    const employeeIds = new Map<string, string>();
    for (const emp of EMPLOYEES) {
      const created = await db.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: emp.code,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email ?? null,
          gender: emp.gender,
          departmentId: deptIds.get(emp.department),
          positionId: posIds.get(emp.position),
          hireDate: new Date(`${emp.hireDate}T00:00:00`),
          employmentType: emp.employmentType,
          status: "active",
          isActive: true,
          bankName: "GTBank",
          bankAccountNumber: emp.bankAccountNumber,
          bankAccountName: emp.bankAccountName,
        },
      });
      employeeIds.set(emp.code, created.id);
    }

    for (const emp of EMPLOYEES) {
      if (emp.manager) {
        await db.employee.update({
          where: { id: employeeIds.get(emp.code) },
          data: { managerId: employeeIds.get(emp.manager) },
        });
      }
    }

    const deptManager: Record<string, string> = {
      Engineering: "EMP-001",
      "Sales & Marketing": "EMP-004",
      Operations: "EMP-007",
      "Human Resources": "EMP-008",
      "Finance & Admin": "EMP-006",
    };
    for (const [deptName, empCode] of Object.entries(deptManager)) {
      await db.department.update({
        where: { id: deptIds.get(deptName) },
        data: { managerId: employeeIds.get(empCode) },
      });
    }

    const leaveTypeIds = new Map<string, string>();
    for (const lt of LEAVE_TYPES) {
      const created = await db.leaveType.create({ data: { organizationId: orgId, ...lt } });
      leaveTypeIds.set(lt.name, created.id);
    }

    const leaves = [
      { emp: "EMP-005", type: "Annual Leave", start: "2026-07-20", end: "2026-07-24", days: 5, status: "approved", reason: "Family vacation" },
      { emp: "EMP-002", type: "Sick Leave", start: "2026-08-24", end: "2026-08-26", days: 3, status: "approved", reason: "Malaria recovery" },
      { emp: "EMP-008", type: "Annual Leave", start: "2026-09-14", end: "2026-09-18", days: 5, status: "pending", reason: "End of year break" },
      { emp: "EMP-003", type: "Annual Leave", start: "2026-10-05", end: "2026-10-09", days: 5, status: "pending", reason: "Family event" },
      { emp: "EMP-004", type: "Casual Leave", start: "2026-09-01", end: "2026-09-01", days: 1, status: "approved", reason: "Personal errand" },
      { emp: "EMP-007", type: "Annual Leave", start: "2026-09-22", end: "2026-09-26", days: 5, status: "pending", reason: "Vacation" },
    ];

    await db.leave.createMany({
      data: leaves.map((l) => ({
        employeeId: employeeIds.get(l.emp)!,
        leaveTypeId: leaveTypeIds.get(l.type)!,
        startDate: new Date(`${l.start}T00:00:00`),
        endDate: new Date(`${l.end}T00:00:00`),
        days: l.days,
        reason: l.reason,
        status: l.status,
        approvedById: l.status === "approved" ? adminUser.id : null,
        approvedAt: l.status === "approved" ? new Date(`${l.start}T09:00:00`) : null,
      })),
    });

    const attendanceDays = [
      ...weekdaysBetween(dateFrom(2026, 8, 17), dateFrom(2026, 9, 4)),
      ...weekdaysBetween(dateFrom(2026, 9, 7), dateFrom(2026, 9, 8)),
    ];

    const absentDays = [
      { emp: "EMP-008", day: "2026-08-25" },
      { emp: "EMP-005", day: "2026-09-02" },
      { emp: "EMP-002", day: "2026-08-18" },
    ];
    const lateDays = [
      { emp: "EMP-003", day: "2026-09-07" },
      { emp: "EMP-006", day: "2026-08-21" },
    ];

    const attendanceRows: Array<{
      employeeId: string;
      date: Date;
      checkIn?: Date;
      checkOut?: Date;
      hoursWorked?: number;
      status: string;
      notes?: string;
    }> = [];

    let i = 0;
    for (let idx = 0; idx < EMPLOYEES.length; idx++) {
      const emp = EMPLOYEES[idx];
      const empId = employeeIds.get(emp.code)!;
      for (const day of attendanceDays) {
        i++;
        const iso = dayToISO(day);
        const isAbsent = absentDays.some((a) => a.emp === emp.code && a.day === iso);
        const isLate = lateDays.some((a) => a.emp === emp.code && a.day === iso);

        if (isAbsent) {
          attendanceRows.push({ employeeId: empId, date: day, status: "absent", notes: "Sick - no show" });
          continue;
        }

        const checkInMin = 8 * 60 + 30 + (i % 3) * 5;
        const checkOutMin = 17 * 60 + 15 + (i % 2) * 15;
        const actualInMin = isLate ? checkInMin + 75 : checkInMin;
        const hoursWorked = Math.round(((checkOutMin - actualInMin) / 60) * 100) / 100;

        attendanceRows.push({
          employeeId: empId,
          date: day,
          checkIn: new Date(y(day), m(day) - 1, d(day), Math.floor(actualInMin / 60), actualInMin % 60, 0, 0),
          checkOut: new Date(y(day), m(day) - 1, d(day), Math.floor(checkOutMin / 60), checkOutMin % 60, 0, 0),
          hoursWorked,
          status: isLate ? "late" : "present",
          notes: isLate ? "Arrived late" : undefined,
        });
      }
    }

    await db.attendance.createMany({ data: attendanceRows });
  }

  const periodsExist = (await db.payrollPeriod.count({ where: { organizationId: orgId } })) > 0;
  if (!periodsExist) {
    const payrollConfig = await db.payrollConfiguration.findFirst({
      where: { organizationId: orgId, isActive: true },
    });

    await db.salaryStructure.createMany({
      data: (
        await db.employee.findMany({
          where: { organizationId: orgId },
          select: { id: true, employeeCode: true },
        })
      )
        .filter((emp) => EMPLOYEES.some((e) => e.code === emp.employeeCode))
        .map((emp) => {
          const e = EMPLOYEES.find((x) => x.code === emp.employeeCode)!;
          return {
            employeeId: emp.id,
            basicSalary: e.basicSalary,
            allowances: e.allowances as never,
            effectiveFrom: dateFrom(2026, 7, 1),
            isActive: true,
            payrollConfigurationId: payrollConfig?.id ?? null,
          };
        }),
    });

    const julyPeriod = await db.payrollPeriod.create({
      data: {
        organizationId: orgId,
        name: "July 2026",
        startDate: dateFrom(2026, 7, 1),
        endDate: dateFrom(2026, 7, 31, 23, 59),
        payDate: dateFrom(2026, 7, 31),
        status: "open",
      },
    });

    const julyRun = await db.payrollRun.create({
      data: {
        periodId: julyPeriod.id,
        organizationId: orgId,
        status: "draft",
        runDate: dateFrom(2026, 7, 28),
      },
    });

    await computePayrollRun(julyRun.id, orgId);

    await db.payrollRun.update({
      where: { id: julyRun.id },
      data: { status: "submitted", submittedAt: dateFrom(2026, 7, 29, 10, 0), submittedById: adminUser.id },
    });
    await db.payrollRun.update({
      where: { id: julyRun.id },
      data: { status: "approved", approvedAt: dateFrom(2026, 7, 30, 9, 0), approvedById: adminUser.id },
    });
    await finalizePayrollRun(julyRun.id, orgId, adminUser.id);
    await postPayrollToAccounting({ organizationId: orgId, runId: julyRun.id, userId: adminUser.id });

    const augustPeriod = await db.payrollPeriod.create({
      data: {
        organizationId: orgId,
        name: "August 2026",
        startDate: dateFrom(2026, 8, 1),
        endDate: dateFrom(2026, 8, 31, 23, 59),
        payDate: dateFrom(2026, 8, 31),
        status: "open",
      },
    });

    const augustRun = await db.payrollRun.create({
      data: {
        periodId: augustPeriod.id,
        organizationId: orgId,
        status: "draft",
        runDate: dateFrom(2026, 8, 28),
      },
    });

    await computePayrollRun(augustRun.id, orgId);
    await db.payrollRun.update({
      where: { id: augustRun.id },
      data: { status: "submitted", submittedAt: dateFrom(2026, 8, 29, 10, 0), submittedById: adminUser.id },
    });
  }

  const accountingDataExists =
    (await db.customer.count({ where: { organizationId: orgId } })) > 0;
  if (!accountingDataExists) {
    for (let month = 1; month <= 9; month++) {
      await db.accountingPeriod.create({
        data: {
          organizationId: orgId,
          name: `${new Date(2026, month - 1, 1).toLocaleString("en", { month: "long" })} 2026`,
          startDate: dateFrom(2026, month, 1),
          endDate: dateFrom(2026, month, new Date(2026, month, 0).getDate(), 23, 59),
          isClosed: month <= 3,
        },
      });
    }

    await postJournalEntry({
      organizationId: orgId,
      date: dateFrom(2026, 4, 1),
      reference: "Opening balances",
      description: "Opening equity and cash position",
      source: "opening",
      createdById: adminUser.id,
      lines: [
        { accountCode: "1100", description: "Opening cash balance", debit: 70000000 },
        { accountCode: "3000", description: "Owner's equity", credit: 70000000 },
      ],
    });

    const customerByName = new Map<string, string>();
    for (const cust of CUSTOMERS) {
      const created = await db.customer.create({ data: { organizationId: orgId, ...cust } });
      customerByName.set(cust.name, created.id);
    }

    const revenueAccountId = accountsByCode.get("4000")!.id;
    for (const inv of INVOICES) {
      if (inv.status === "draft") continue;

      await postJournalEntry({
        organizationId: orgId,
        date: new Date(`${inv.issueDate}T00:00:00`),
        reference: inv.invoiceNumber,
        description: `Sales revenue - ${inv.customer}`,
        source: "invoice",
        createdById: adminUser.id,
        lines: [
          { accountCode: "1200", description: "Accounts receivable", debit: inv.total },
          { accountCode: "4000", description: "Sales revenue", credit: inv.total },
        ],
      });
    }

    const vendorByName = new Map<string, string>();
    for (const vendor of VENDORS) {
      const created = await db.vendor.create({ data: { organizationId: orgId, ...vendor } });
      vendorByName.set(vendor.name, created.id);
    }

    for (const inv of INVOICES) {
      const customerId = customerByName.get(inv.customer)!;

      const createdInvoice = await db.invoice.create({
        data: {
          organizationId: orgId,
          customerId,
          invoiceNumber: inv.invoiceNumber,
          issueDate: new Date(`${inv.issueDate}T00:00:00`),
          dueDate: new Date(`${inv.dueDate}T00:00:00`),
          status: inv.status,
          subtotal: inv.total,
          taxAmount: 0,
          discount: 0,
          total: inv.total,
          amountPaid: inv.amountPaid,
          lines: {
            create: inv.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: l.quantity * l.unitPrice,
              accountId: revenueAccountId,
            })),
          },
        },
      });

      if (inv.payment) {
        await db.payment.create({
          data: {
            organizationId: orgId,
            invoiceId: createdInvoice.id,
            customerId,
            amount: inv.payment.amount,
            method: "bank",
            reference: inv.payment.reference,
            date: new Date(`${inv.payment.date}T00:00:00`),
          },
        });

        await postJournalEntry({
          organizationId: orgId,
          date: new Date(`${inv.payment.date}T00:00:00`),
          reference: inv.payment.reference,
          description: "Customer payment received",
          source: "invoice_payment",
          createdById: adminUser.id,
          lines: [
            { accountCode: "1100", description: "Bank - payment received", debit: inv.payment.amount },
            { accountCode: "1200", description: "Accounts receivable", credit: inv.payment.amount },
          ],
        });
      }
    }

    for (const bill of BILLS) {
      const vendorId = vendorByName.get(bill.vendor)!;
      const accountId = accountsByCode.get(bill.accountCode)!.id;

      const createdBill = await db.bill.create({
        data: {
          organizationId: orgId,
          vendorId,
          billNumber: bill.billNumber,
          issueDate: new Date(`${bill.issueDate}T00:00:00`),
          dueDate: new Date(`${bill.dueDate}T00:00:00`),
          status: bill.status,
          subtotal: bill.total,
          taxAmount: 0,
          total: bill.total,
          amountPaid: bill.amountPaid,
          lines: {
            create: bill.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: l.quantity * l.unitPrice,
              accountId,
            })),
          },
        },
      });

      await postJournalEntry({
        organizationId: orgId,
        date: new Date(`${bill.issueDate}T00:00:00`),
        reference: bill.billNumber,
        description: `Purchase - ${bill.vendor}`,
        source: "bill",
        createdById: adminUser.id,
        lines: [
          { accountCode: bill.accountCode, description: bill.lines[0].description, debit: bill.total },
          { accountCode: "2000", description: "Accounts payable", credit: bill.total },
        ],
      });

      if (bill.payment) {
        await db.payment.create({
          data: {
            organizationId: orgId,
            billId: createdBill.id,
            vendorId,
            amount: bill.payment.amount,
            method: "bank",
            reference: bill.payment.reference,
            date: new Date(`${bill.payment.date}T00:00:00`),
          },
        });

        await postJournalEntry({
          organizationId: orgId,
          date: new Date(`${bill.payment.date}T00:00:00`),
          reference: bill.payment.reference,
          description: "Vendor bill payment",
          source: "bill_payment",
          createdById: adminUser.id,
          lines: [
            { accountCode: "2000", description: "Accounts payable", debit: bill.payment.amount },
            { accountCode: "1100", description: "Bank - payment made", credit: bill.payment.amount },
          ],
        });
      }
    }

    const expenseCategoryIds = new Map<string, string>();
    for (const cat of EXPENSE_CATEGORIES) {
      const created = await db.expenseCategory.create({
        data: {
          organizationId: orgId,
          name: cat.name,
          accountId: accountsByCode.get(cat.accountCode)?.id ?? null,
        },
      });
      expenseCategoryIds.set(cat.name, created.id);
    }

    for (const expense of EXPENSES) {
      await db.expense.create({
        data: {
          organizationId: orgId,
          categoryId: expenseCategoryIds.get(expense.category),
          accountId: accountsByCode.get(expense.accountCode)?.id ?? null,
          amount: expense.amount,
          date: new Date(`${expense.date}T00:00:00`),
          description: expense.description,
          status: expense.status,
          approvedById: expense.status === "approved" ? adminUser.id : null,
          approvedAt: expense.status === "approved" ? new Date(`${expense.date}T10:00:00`) : null,
          createdById: adminUser.id,
        },
      });

      if (expense.status === "approved") {
        await postJournalEntry({
          organizationId: orgId,
          date: new Date(`${expense.date}T00:00:00`),
          reference: `Expense ${expense.description}`,
          description: expense.description,
          source: "expense",
          createdById: adminUser.id,
          lines: [
            { accountCode: expense.accountCode, description: expense.description, debit: expense.amount },
            { accountCode: "2000", description: "Expense payable", credit: expense.amount },
          ],
        });
      }
    }

    await postJournalEntry({
      organizationId: orgId,
      date: dateFrom(2026, 8, 20),
      reference: "CAPEX-2026-0001",
      description: "Purchase of office equipment",
      source: "manual",
      createdById: adminUser.id,
      lines: [
        { accountCode: "1500", description: "Fixed assets - office equipment", debit: 2500000 },
        { accountCode: "1100", description: "Bank", credit: 2500000 },
      ],
    });
  }

  const auditExists = (await db.auditLog.count({ where: { organizationId: orgId } })) > 0;
  if (!auditExists) {
    await db.auditLog.createMany({
      data: [
        { organizationId: orgId, userId: adminUser.id, action: "create", entity: "organization", entityId: orgId },
        { organizationId: orgId, userId: adminUser.id, action: "create", entity: "employee", entityId: "demo" },
        { organizationId: orgId, userId: adminUser.id, action: "approve", entity: "leave", entityId: "demo" },
        { organizationId: orgId, userId: adminUser.id, action: "expense_approved", entity: "expense", entityId: "demo" },
        { organizationId: orgId, userId: adminUser.id, action: "payroll_posted", entity: "payroll_run", entityId: "demo" },
      ],
    });
  }

  const notificationExists =
    (await db.notification.count({ where: { organizationId: orgId } })) > 0;
  if (!notificationExists) {
    await db.notification.createMany({
      data: [
        {
          organizationId: orgId,
          userId: userByEmail.get("manager@example.com")!.id,
          title: "Pending leave requests",
          message: "5 leave requests are waiting for approval.",
          type: "info",
          link: "/hr/leave",
        },
        {
          organizationId: orgId,
          userId: adminUser.id,
          title: "Payroll ready for approval",
          message: "August 2026 payroll run has been calculated and submitted.",
          type: "warning",
          link: "/payroll",
        },
      ],
    });
  }

  console.log(
    `Seeded demo org "${DEMO_ORGANIZATION.name}" with ${DEMO_USERS.length} users (password: ${DEMO_PASSWORD}), 8 employees, payroll runs, AR/AP and GL transactions.`
  );
}

function y(d: Date): number {
  return d.getFullYear();
}
function m(d: Date): number {
  return d.getMonth() + 1;
}
function d(dt: Date): number {
  return dt.getDate();
}