import { db } from "@/lib/prisma";

export type EarningsInput = {
  basic: number;
  allowances: Record<string, number>;
};

export type DeductionInput = {
  name: string;
  amount: number;
};

export type PayrollInput = {
  grossPay: number;
  basicPay: number;
  // taxable pay after reliefs (e.g. consolidated relief)
  deductions: DeductionInput[];
  contributions: DeductionInput[];
};

export type PayrollResult = {
  grossPay: number;
  totalDeductions: number;
  totalContributions: number;
  netPay: number;
  overtimePay: number;
  unpaidDeduction: number;
  taxBreakdown: Record<string, number>;
  deductionBreakdown: Record<string, number>;
  contributionBreakdown: Record<string, number>;
};

interface EffectiveRule {
  bracketOrder: number;
  lowerBound: number;
  upperBound: number | null;
  rate: number;
  baseAmount: number | null;
}

interface ConfigList {
  taxRules: EffectiveRule[];
  deductionRules: Array<{ name: string; calculationType: string; value: number; cap: number | null }>;
  contributionRules: Array<{ name: string; contributor: string; calculationType: string; value: number; cap: number | null }>;
  overtimeFactor: number;
  workingDaysPerMonth: number;
}

function toNum(value: unknown): number {
  return Number(value ?? 0);
}

/**
 * Load the active payroll configuration for an org + country as of a date.
 */
export async function getActivePayrollConfiguration(
  organizationId: string,
  countryCode: string,
  asOf = new Date()
): Promise<ConfigList | null> {
  const config = await db.payrollConfiguration.findFirst({
    where: {
      organizationId,
      countryCode,
      isActive: true,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    select: {
      overtimeFactor: true,
      workingDaysPerMonth: true,
      taxRules: { orderBy: { bracketOrder: "asc" } },
      deductionRules: true,
      contributionRules: true,
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!config) return null;

  return {
    taxRules: config.taxRules.map((r) => ({
      bracketOrder: r.bracketOrder,
      lowerBound: toNum(r.lowerBound),
      upperBound: r.upperBound === null ? null : toNum(r.upperBound),
      rate: toNum(r.rate),
      baseAmount: r.baseAmount === null ? null : toNum(r.baseAmount),
    })),
    deductionRules: config.deductionRules.map((r) => ({
      name: r.name,
      calculationType: r.calculationType,
      value: toNum(r.value),
      cap: r.cap === null ? null : toNum(r.cap),
    })),
    contributionRules: config.contributionRules.map((r) => ({
      name: r.name,
      contributor: r.contributor,
      calculationType: r.calculationType,
      value: toNum(r.value),
      cap: r.cap === null ? null : toNum(r.cap),
    })),
    overtimeFactor: toNum(config.overtimeFactor) || 1,
    workingDaysPerMonth: toNum(config.workingDaysPerMonth) || 22,
  };
}

/**
 * Progressive tax calculator. The config stores annual brackets with
 * baseAmount = cumulative tax from lower brackets. `annualize` lets us
 * work on an annual figure and then scale back to a period figure.
 */
export function calculateProgressiveTax(
  annualTaxablePay: number,
  taxRules: EffectiveRule[],
  annualize: 1 | 12 = 1
): number {
  if (annualTaxablePay <= 0 || taxRules.length === 0) return 0;

  const annual = annualTaxablePay * annualize;
  let tax = 0;

  const sorted = [...taxRules].sort((a, b) => a.lowerBound - b.lowerBound);

  for (let i = 0; i < sorted.length; i++) {
    const rule = sorted[i];
    // amount of income within this bracket
    const bracketWidth =
      rule.upperBound === null ? Math.max(0, annual - rule.lowerBound) : Math.max(0, Math.min(annual, rule.upperBound!) - rule.lowerBound);
    tax += bracketWidth * (rule.rate / 100);
  }

  // For monthly: scale down tax to the month portion
  const finalTax = annualize === 12 ? tax / 12 : tax;
  return Math.max(0, Math.round(finalTax * 100) / 100);
}

export function applyDeductionRule(
  base: number,
  rule: { calculationType: string; value: number },
  fallbackBase?: number
): number {
  const value = rule.value;
  switch (rule.calculationType) {
    case "fixed":
      return Math.round(value * 100) / 100;
    case "percent_basic":
      return Math.round(((fallbackBase ?? base) * value) / 100 * 100) / 100;
    case "percent_of_tax":
      return Math.round((fallbackBase ?? base) * value * 100) / 100;
    case "percent_gross":
    default:
      return Math.round((base * value) / 100 * 100) / 100;
  }
}

function titleCase(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim() || name;
}

/**
 * Full payroll calculation for one employee line.
 *
 * Extra inputs:
 * - overtimePay: floated into gross.
 * - unpaidDeduction: deducted below the line (unpaid leave / absence days).
 * - extraDeductions / extraContributions: benefit shares (e.g. HMO) applied monthly.
 * - deductionOverrides: map of lowercased rule name -> amount that replaces the
 *   configured rule value (e.g. per-employee pension % or NHIA %).
 */
export function calculatePayrollEmployee(input: {
  basicPay: number;
  allowances: Record<string, number>;
  taxRules?: EffectiveRule[];
  deductionRules?: Array<{ name: string; calculationType: string; value: number; cap: number | null }>;
  contributionRules?: Array<{ name: string; contributor: string; calculationType: string; value: number; cap: number | null }>;
  annualize?: 1 | 12;
  overtimePay?: number;
  unpaidDeduction?: number;
  extraDeductions?: Array<{ name: string; amount: number }>;
  extraContributions?: Array<{ name: string; amount: number }>;
  deductionOverrides?: Record<string, number>;
}): PayrollResult {
  const annualize = input.annualize ?? 12;
  const allowancesTotal = Object.values(input.allowances ?? {}).reduce((a, b) => a + b, 0);
  const overtimePay = Math.round((input.overtimePay ?? 0) * 100) / 100;
  const unpaidDeduction = Math.round((input.unpaidDeduction ?? 0) * 100) / 100;
  const grossBase = input.basicPay + allowancesTotal;
  const grossPay = Math.round((grossBase + overtimePay) * 100) / 100;

  const overrides: Record<string, number> = {};
  for (const [k, v] of Object.entries(input.deductionOverrides ?? {})) {
    overrides[k.toLowerCase()] = v;
  }

  function overrideFor(ruleName: string): number | undefined {
    const n = ruleName.toLowerCase();
    return Object.entries(overrides).find(([k]) => n.includes(k))?.[1];
  }

  const totalDeductionsRaw: Record<string, number> = {};
  let taxAmount = 0;

  const gr = input.deductionRules ?? [];
  for (const rule of gr) {
    const overrideAmount = overrideFor(rule.name);
    let amount = overrideAmount !== undefined
      ? overrideAmount
      : applyDeductionRule(grossPay, rule, input.basicPay);
    if (overrideAmount === undefined && rule.cap && amount > rule.cap) amount = rule.cap;
    totalDeductionsRaw[rule.name] = Math.round(amount * 100) / 100;
  }

  // Employee-side contributions (e.g. pension) counted as deductions.
  for (const rule of input.contributionRules ?? []) {
    if (rule.contributor === "employer") continue;
    const overrideAmount = overrideFor(rule.name);
    const amount = overrideAmount !== undefined
      ? overrideAmount
      : applyDeductionRule(grossPay, rule, input.basicPay);
    totalDeductionsRaw[rule.name] = Math.round(amount * 100) / 100;
  }

  // Per-employee overrides unmatched by configured rules (pension/NHIA % etc.)
  for (const [name, amount] of Object.entries(input.deductionOverrides ?? {})) {
    const matched = [...(gr ?? []), ...(input.contributionRules ?? [])].some(
      (r) => r.name.toLowerCase().includes(name.toLowerCase())
    );
    if (!matched && amount) {
      totalDeductionsRaw[titleCase(name)] = Math.round(amount * 100) / 100;
    }
  }

  // Progressive income tax on gross (config handles brackets)
  if (input.taxRules && input.taxRules.length > 0) {
    taxAmount = calculateProgressiveTax(grossPay, input.taxRules, annualize);
    if (taxAmount > 0) {
      totalDeductionsRaw["Income Tax"] = Math.round(taxAmount * 100) / 100;
    }
  }

  // Unpaid leave / absence is deducted below the line.
  if (unpaidDeduction > 0) {
    totalDeductionsRaw["Unpaid Leave"] = unpaidDeduction;
  }

  // Benefit shares (HMO etc.) deducted from pay.
  for (const extra of input.extraDeductions ?? []) {
    if (extra.amount) {
      totalDeductionsRaw[extra.name] = Math.round(extra.amount * 100) / 100;
    }
  }

  // Employer contributions (not deducted from pay).
  const contributionBreakdown: Record<string, number> = {};
  for (const rule of input.contributionRules ?? []) {
    if (rule.contributor !== "employer") continue;
    let amount = applyDeductionRule(grossPay, rule, input.basicPay);
    if (rule.cap && amount > rule.cap) amount = rule.cap;
    contributionBreakdown[rule.name] = Math.round(amount * 100) / 100;
  }
  for (const extra of input.extraContributions ?? []) {
    if (extra.amount) {
      contributionBreakdown[extra.name] = Math.round(extra.amount * 100) / 100;
    }
  }

  const finalDeductions = Object.entries(totalDeductionsRaw).reduce<Record<string, number>>(function (acc, [k, v]) {
    if (v) acc[k] = v;
    return acc;
  }, {});
  const finalTotalDeductions =
    Math.round(Object.values(finalDeductions).reduce((a, b) => a + b, 0) * 100) / 100;

  const netPay = Math.round((grossPay - finalTotalDeductions) * 100) / 100;
  const totalContributions =
    Math.round(Object.values(contributionBreakdown).reduce((a, b) => a + b, 0) * 100) / 100;

  const taxBreakdown: Record<string, number> = taxAmount
    ? { IncomeTax: Math.round(taxAmount * 100) / 100 }
    : {};

  return {
    grossPay,
    totalDeductions: finalTotalDeductions,
    totalContributions,
    netPay,
    overtimePay,
    unpaidDeduction,
    taxBreakdown,
    deductionBreakdown: finalDeductions,
    contributionBreakdown,
  };
}