import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  amount: number | string | null | undefined,
  currency = "NGN",
  locale = "en-NG"
): string {
  if (amount === null || amount === undefined) amount = 0;
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatDate(
  date: Date | string | null | undefined,
  locale = "en-GB"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export function formatNumber(value: number | string | null | undefined, digits = 2): string {
  if (value === null || value === undefined) value = 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function titleCase(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
