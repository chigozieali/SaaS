import { db } from "@/lib/prisma";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
} from "@/lib/permissions";

// Standard simple chart of accounts seeded for every new organization
export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: string;
  subtype?: string;
}> = [
  // Assets
  { code: "1000", name: "Cash", type: "asset", subtype: "current_asset" },
  { code: "1100", name: "Bank Accounts", type: "asset", subtype: "current_asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset", subtype: "current_asset" },
  { code: "1300", name: "Inventory", type: "asset", subtype: "current_asset" },
  { code: "1400", name: "Prepaid Expenses", type: "asset", subtype: "current_asset" },
  { code: "1500", name: "Fixed Assets", type: "asset", subtype: "fixed_asset" },
  { code: "1600", name: "Accumulated Depreciation", type: "asset", subtype: "fixed_asset", },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability", subtype: "current_liability" },
  { code: "2100", name: "Accrued Salaries", type: "liability", subtype: "current_liability" },
  { code: "2200", name: "PAYE Tax Payable", type: "liability", subtype: "current_liability" },
  { code: "2300", name: "Pension Payable", type: "liability", subtype: "current_liability" },
  { code: "2400", name: "Employee Deductions Payable", type: "liability", subtype: "current_liability" },
  { code: "2500", name: "Sales Tax Payable", type: "liability", subtype: "current_liability" },
  { code: "2600", name: "Long-term Liabilities", type: "liability", subtype: "long_term_liability" },
  // Equity
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3100", name: "Retained Earnings", type: "equity" },
  // Revenue
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "4100", name: "Service Revenue", type: "revenue" },
  { code: "4200", name: "Other Income", type: "revenue" },
  // Expenses
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Salaries & Wages", type: "expense" },
  { code: "5200", name: "Rent", type: "expense" },
  { code: "5300", name: "Utilities", type: "expense" },
  { code: "5400", name: "Office Supplies", type: "expense" },
  { code: "5500", name: "Travel & Entertainment", type: "expense" },
  { code: "5600", name: "Professional Fees", type: "expense" },
  { code: "5700", name: "Depreciation Expense", type: "expense" },
  { code: "5800", name: "Tax Expense", type: "expense" },
  { code: "5900", name: "Miscellaneous", type: "expense" },
];

export async function seedPermissions(): Promise<void> {
  for (const [category, keys] of Object.entries(PERMISSION_CATEGORIES)) {
    for (const key of keys) {
      await db.permission.upsert({
        where: { key },
        update: { category },
        create: { key, category, description: key },
      });
    }
  }
}

export async function seedDefaultRoles(organizationId: string): Promise<void> {
  await seedPermissions();

  for (const [roleName, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const existing = await db.organizationRole.findUnique({
      where: { organizationId_name: { organizationId, name: roleName } },
    });
    if (existing) continue;

    const role = await db.organizationRole.create({
      data: {
        organizationId,
        name: roleName,
        isSystem: true,
      },
    });

    for (const key of keys) {
      await db.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey: key } },
        update: {},
        create: { roleId: role.id, permissionKey: key },
      });
    }
  }
}

export async function seedChartOfAccounts(organizationId: string): Promise<void> {
  await db.$transaction(
    DEFAULT_CHART_OF_ACCOUNTS.map((acc) =>
      db.account.create({
        data: {
          organizationId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype ?? null,
          isSystem: true,
        },
      })
    )
  );
}

export async function seedCountries(): Promise<void> {
  const countries = [
    { code: "NG", name: "Nigeria", currency: "NGN" },
    { code: "GH", name: "Ghana", currency: "GHS" },
    { code: "KE", name: "Kenya", currency: "KES" },
    { code: "ZA", name: "South Africa", currency: "ZAR" },
    { code: "US", name: "United States", currency: "USD" },
    { code: "GB", name: "United Kingdom", currency: "GBP" },
    { code: "AU", name: "Australia", currency: "AUD" },
    { code: "CA", name: "Canada", currency: "CAD" },
  ];
  for (const country of countries) {
    await db.country.upsert({
      where: { code: country.code },
      update: {},
      create: country,
    });
  }
}

export async function seedDefaultCountryConfigsIfMissing(organizationId: string): Promise<void> {
  await seedCountries();

  const count = await db.payrollConfiguration.count({
    where: { organizationId },
  });
  if (count > 0) return;

  // Nigeria default PAYE rules (annual) as an example config
  await db.payrollConfiguration.create({
    data: {
      organizationId,
      countryCode: "NG",
      name: "Nigeria PAYE (2026)",
      currency: "NGN",
      taxYear: "2026",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
      taxRules: {
        create: [
          { bracketOrder: 1, lowerBound: 0, upperBound: 300000, rate: 7, baseAmount: 0 },
          { bracketOrder: 2, lowerBound: 300000, upperBound: 600000, rate: 11, baseAmount: 21000 },
          { bracketOrder: 3, lowerBound: 600000, upperBound: 1100000, rate: 15, baseAmount: 54000 },
          { bracketOrder: 4, lowerBound: 1100000, upperBound: 1600000, rate: 19, baseAmount: 129000 },
          { bracketOrder: 5, lowerBound: 1600000, upperBound: 3200000, rate: 21, baseAmount: 224000 },
          { bracketOrder: 6, lowerBound: 3200000, upperBound: null, rate: 24, baseAmount: 560000 },
        ],
      },
      deductionRules: {
        create: [
          {
            name: "Pension (Employee)",
            calculationType: "percent_gross",
            value: 0.08,
            effectiveFrom: new Date("2024-01-01"),
          },
        ],
      },
      contributionRules: {
        create: [
          {
            name: "Pension (Employer)",
            contributor: "employer",
            calculationType: "percent_gross",
            value: 0.1,
            effectiveFrom: new Date("2024-01-01"),
          },
        ],
      },
    },
  });
}