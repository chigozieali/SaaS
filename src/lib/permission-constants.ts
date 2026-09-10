export const PERMISSIONS = {
  dashboard: {
    view: "dashboard.view",
  },
  employees: {
    self: "employees.self",
    view: "employees.view",
    create: "employees.create",
    edit: "employees.edit",
    delete: "employees.delete",
    payroll: "employees.payroll",
  },
  departments: {
    view: "departments.view",
    create: "departments.create",
    edit: "departments.edit",
    delete: "departments.delete",
  },
  leave: {
    view: "leave.view",
    create: "leave.create",
    approve: "leave.approve",
  },
  attendance: {
    view: "attendance.view",
    create: "attendance.create",
    edit: "attendance.edit",
  },
  payroll: {
    view: "payroll.view",
    configure: "payroll.configure",
    run: "payroll.run",
    approve: "payroll.approve",
    finalize: "payroll.finalize",
  },
  accounting: {
    view: "accounting.view",
    chartOfAccounts: "accounting.chartOfAccounts",
    journal: "accounting.journal",
    invoices: "accounting.invoices",
    bills: "accounting.bills",
    expenses: "accounting.expenses",
    reports: "accounting.reports",
  },
  settings: {
    view: "settings.view",
    company: "settings.company",
    users: "settings.users",
    roles: "settings.roles",
    audit_logs: "settings.audit_logs",
    super: "settings.super",
  },
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];

export const ALL_PERMISSIONS: string[] = [
  ...Object.values(PERMISSIONS.dashboard),
  ...Object.values(PERMISSIONS.employees),
  ...Object.values(PERMISSIONS.departments),
  ...Object.values(PERMISSIONS.leave),
  ...Object.values(PERMISSIONS.attendance),
  ...Object.values(PERMISSIONS.payroll),
  ...Object.values(PERMISSIONS.accounting),
  ...Object.values(PERMISSIONS.settings),
];

export const PERMISSION_CATEGORIES: Record<string, string[]> = {
  Dashboard: Object.values(PERMISSIONS.dashboard),
  Employees: Object.values(PERMISSIONS.employees),
  Departments: Object.values(PERMISSIONS.departments),
  Leave: Object.values(PERMISSIONS.leave),
  Attendance: Object.values(PERMISSIONS.attendance),
  Payroll: Object.values(PERMISSIONS.payroll),
  Accounting: Object.values(PERMISSIONS.accounting),
  Settings: Object.values(PERMISSIONS.settings),
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ALL_PERMISSIONS,
  "Super Admin": [...ALL_PERMISSIONS, PERMISSIONS.settings.super],
  Manager: [
    PERMISSIONS.dashboard.view,
    PERMISSIONS.employees.self,
    PERMISSIONS.departments.view,
    PERMISSIONS.leave.view,
    PERMISSIONS.leave.approve,
    PERMISSIONS.attendance.view,
    PERMISSIONS.payroll.view,
    PERMISSIONS.accounting.view,
  ],
  Employee: [
    PERMISSIONS.dashboard.view,
    PERMISSIONS.employees.self,
    PERMISSIONS.leave.create,
  ],
  Accountant: [
    PERMISSIONS.dashboard.view,
    PERMISSIONS.employees.view,
    PERMISSIONS.employees.payroll,
    PERMISSIONS.accounting.view,
    PERMISSIONS.accounting.chartOfAccounts,
    PERMISSIONS.accounting.journal,
    PERMISSIONS.accounting.invoices,
    PERMISSIONS.accounting.bills,
    PERMISSIONS.accounting.expenses,
    PERMISSIONS.accounting.reports,
    PERMISSIONS.payroll.view,
  ],
};

// Simple helper: does the set contain the key (also supports wildcard "users.*")
export function hasPermission(perms: Set<string>, key: string): boolean {
  if (perms.has("*")) return true;
  if (perms.has(key)) return true;
  const [category] = key.split(".");
  return perms.has(`${category}.*`);
}