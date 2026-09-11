import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserRound,
  Building2,
  CalendarDays,
  CalendarCheck2,
  Plane,
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
  Layers,
  HeartPulse,
  ShieldCheck,
  Landmark,
  BellRing,
  HandCoins,
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
      { title: "My Records", href: "/hr/my-records", icon: UserRound, permission: "employees.self" },
      { title: "My Attendance", href: "/hr/my-attendance", icon: CalendarCheck2, permission: "employees.self" },
      { title: "My Leave", href: "/hr/my-leave", icon: Plane, permission: "employees.self" },
      { title: "My Payslips", href: "/hr/my-payslips", icon: Wallet, permission: "employees.self" },
      { title: "My Team", href: "/hr/my-team", icon: UsersRound, permission: "employees.self" },
      { title: "My Documents", href: "/hr/my-documents", icon: FileText, permission: "employees.self" },
      { title: "My Benefits", href: "/hr/my-benefits", icon: HeartPulse, permission: "employees.self" },
      { title: "Notifications", href: "/hr/notifications", icon: BellRing, permission: "employees.self" },
      { title: "My Account", href: "/hr/my-account", icon: Settings, permission: "employees.self" },
      { title: "Bank Requests", href: "/hr/bank-requests", icon: Landmark, permission: "employees.edit" },
      { title: "Employees", href: "/hr/employees", icon: UserPlus, permission: "employees.view" },
      { title: "Departments", href: "/hr/departments", icon: Building2, permission: "departments.view" },
      { title: "Leave", href: "/hr/leave", icon: CalendarDays, permission: "leave.view" },
      { title: "Leave Types", href: "/hr/leave-types", icon: CalendarDays, permission: "leave.view" },
      { title: "Attendance", href: "/hr/attendance", icon: Clock, permission: "attendance.view" },
      { title: "Compliance", href: "/hr/compliance", icon: ShieldCheck, permission: "employees.view" },
    ],
  },
  {
    title: "Payroll",
    icon: Banknote,
    children: [
      { title: "Payroll Runs", href: "/payroll", icon: Wallet, permission: "payroll.view" },
      { title: "Salary Structures", href: "/payroll/salaries", icon: Banknote, permission: "payroll.view" },
      { title: "Salary Grades", href: "/payroll/salary-grades", icon: Layers, permission: "employees.payroll" },
      { title: "Benefit Plans", href: "/payroll/benefit-plans", icon: HeartPulse, permission: "employees.payroll" },
      { title: "Configuration", href: "/payroll/configuration", icon: Settings, permission: "payroll.configure" },
      { title: "Loans & Advances", href: "/payroll/loans", icon: HandCoins, permission: "payroll.view" },
      { title: "Compliance", href: "/payroll/compliance", icon: ShieldCheck, permission: "payroll.view" },
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
      { title: "Statutory Remittances", href: "/accounting/remittances", icon: Landmark, permission: "accounting.journal" },
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