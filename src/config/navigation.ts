import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  CalendarDays,
  Clock,
  Banknote,
  Wallet,
  BookOpen,
  Settings,
  FileText,
  Receipt,
  UsersRound,
  ScanLine,
  FolderKanban,
} from "lucide-react";

export type NavItem = {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  children?: NavItem[];
};

export const navigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "HR",
    icon: Users,
    children: [
      { title: "Employees", href: "/hr/employees", icon: UserPlus, permission: "employees.view" },
      { title: "Departments", href: "/hr/departments", icon: Building2, permission: "departments.view" },
      { title: "Leave", href: "/hr/leave", icon: CalendarDays, permission: "leave.view" },
      { title: "Attendance", href: "/hr/attendance", icon: Clock, permission: "attendance.view" },
    ],
  },
  {
    title: "Payroll",
    icon: Banknote,
    children: [
      { title: "Payroll Runs", href: "/payroll", icon: Wallet, permission: "payroll.view" },
      { title: "Salary Structures", href: "/payroll/salaries", icon: Banknote, permission: "payroll.view" },
      { title: "Configuration", href: "/payroll/configuration", icon: Settings, permission: "payroll.configure" },
    ],
  },
  {
    title: "Accounting",
    icon: BookOpen,
    children: [
      { title: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: FolderKanban, permission: "accounting.chartOfAccounts" },
      { title: "Journal Entries", href: "/accounting/journal", icon: BookOpen, permission: "accounting.journal" },
      { title: "Customers", href: "/accounting/customers", icon: UsersRound, permission: "accounting.invoices" },
      { title: "Invoices", href: "/accounting/invoices", icon: FileText, permission: "accounting.invoices" },
      { title: "Vendors", href: "/accounting/vendors", icon: UsersRound, permission: "accounting.bills" },
      { title: "Bills", href: "/accounting/bills", icon: Receipt, permission: "accounting.bills" },
      { title: "Expenses", href: "/accounting/expenses", icon: ScanLine, permission: "accounting.expenses" },
      { title: "Reports", href: "/accounting/reports", icon: FileText, permission: "accounting.reports" },
    ],
  },
  {
    title: "Administration",
    href: "/administration",
    icon: Settings,
    permission: "settings.view",
    children: [
      { title: "Company Settings", href: "/administration/settings", icon: Settings, permission: "settings.company" },
      { title: "Users", href: "/administration/users", icon: Users, permission: "settings.users" },
      { title: "Roles & Permissions", href: "/administration/roles", icon: FolderKanban, permission: "settings.roles" },
      { title: "Audit Logs", href: "/administration/audit-logs", icon: ScanLine, permission: "settings.audit_logs" },
    ],
  },
];