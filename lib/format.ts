import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatMoney(
  amount: number,
  currency: string,
  options: { cents?: boolean; signed?: boolean } = {},
): string {
  const { cents = true, signed = false } = options;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(cents ? 2 : 0)}`;
  }
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateShort(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function shortHash(value: string, length = 12): string {
  if (value.length <= length * 2 + 1) return value;
  return `${value.slice(0, length)}…${value.slice(-6)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function severityTone(
  severity: "high" | "medium" | "low",
): "danger" | "warning" | "neutral" {
  if (severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "neutral";
}
