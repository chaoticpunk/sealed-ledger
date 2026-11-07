import type { AnomalySeverity, Transaction } from "./types";

export interface RuleFinding {
  transactionId: string;
  type: string;
  severity: AnomalySeverity;
  reason: string;
}

export function normalizeMerchant(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayDifference(a: string, b: string): number {
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(second)) return Number.POSITIVE_INFINITY;
  return Math.abs(first - second) / 86_400_000;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const NON_DISCRETIONARY = new Set([
  "housing",
  "rent",
  "utilities",
  "transfers",
  "income",
  "fees",
]);

/**
 * Deterministic checks run after the model has categorized transactions.
 * They make the demo's findings reproducible and complement the model's
 * qualitative anomaly judgment.
 */
export function detectRuleFindings(
  transactions: Transaction[],
  baseCurrency: string,
): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const debits = transactions.filter(
    (transaction) => transaction.direction === "debit",
  );

  // 1. Duplicate charges: same merchant + same amount within 3 days.
  const groups = new Map<string, Transaction[]>();
  for (const transaction of debits) {
    const key = `${normalizeMerchant(transaction.merchant)}|${transaction.amount.toFixed(2)}`;
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));

    for (let index = 1; index < sorted.length; index++) {
      const current = sorted[index];
      const previous = sorted[index - 1];
      if (dayDifference(current.date, previous.date) <= 3) {
        findings.push({
          transactionId: current.id,
          type: "duplicate",
          severity: "high",
          reason: `Possible duplicate charge: the same merchant and amount appear on ${previous.date}.`,
        });
      }
    }
  }

  // 2. Large one-off purchases outside fixed costs.
  for (const transaction of debits) {
    if (
      transaction.amount >= 500 &&
      !NON_DISCRETIONARY.has(transaction.category.toLowerCase())
    ) {
      findings.push({
        transactionId: transaction.id,
        type: "large_purchase",
        severity: transaction.amount >= 1_000 ? "high" : "medium",
        reason: `A one-off purchase of ${money(transaction.amount, transaction.currency)} is far above typical day-to-day spending.`,
      });
    }
  }

  // 3. Category outliers (needs enough history to be meaningful).
  const byCategory = new Map<string, Transaction[]>();
  for (const transaction of debits) {
    if (NON_DISCRETIONARY.has(transaction.category.toLowerCase())) continue;
    const group = byCategory.get(transaction.category) ?? [];
    group.push(transaction);
    byCategory.set(transaction.category, group);
  }

  for (const [category, group] of byCategory) {
    if (group.length < 4) continue;
    const typical = median(group.map((transaction) => transaction.amount));
    for (const transaction of group) {
      if (
        transaction.amount > typical * 3 &&
        transaction.amount - typical >= 100
      ) {
        findings.push({
          transactionId: transaction.id,
          type: "category_outlier",
          severity: "medium",
          reason: `This ${money(transaction.amount, transaction.currency)} ${category.toLowerCase()} charge is more than triple the usual ${money(typical, transaction.currency)} for this category.`,
        });
      }
    }
  }

  // 4. Subscription price increases.
  const subscriptions = new Map<string, Transaction[]>();
  for (const transaction of debits) {
    if (!/subscription|software|streaming|membership/i.test(transaction.category)) {
      continue;
    }
    const key = normalizeMerchant(transaction.merchant);
    const group = subscriptions.get(key) ?? [];
    group.push(transaction);
    subscriptions.set(key, group);
  }

  for (const group of subscriptions.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const previous = sorted[sorted.length - 2];
    const latest = sorted[sorted.length - 1];

    if (
      latest.amount >= 5 &&
      latest.amount > previous.amount * 1.15 &&
      latest.amount - previous.amount >= 1
    ) {
      findings.push({
        transactionId: latest.id,
        type: "subscription_increase",
        severity: "medium",
        reason: `Subscription increased from ${money(previous.amount, previous.currency)} to ${money(latest.amount, latest.currency)} without a matching new charge.`,
      });
    }
  }

  // 5. Late-night spending.
  for (const transaction of debits) {
    if (!transaction.time) continue;
    const hour = Number(transaction.time.slice(0, 2));
    if (Number.isFinite(hour) && hour >= 0 && hour < 5) {
      findings.push({
        transactionId: transaction.id,
        type: "late_night",
        severity: "low",
        reason: `Charged at ${transaction.time}, outside this account's usual spending hours.`,
      });
    }
  }

  // 6. Currency mismatch against the statement currency.
  for (const transaction of debits) {
    if (
      transaction.currency &&
      transaction.currency.toUpperCase() !== baseCurrency.toUpperCase()
    ) {
      findings.push({
        transactionId: transaction.id,
        type: "foreign_currency",
        severity: "low",
        reason: `Charged in ${transaction.currency} rather than ${baseCurrency}; check the conversion and any foreign transaction fee.`,
      });
    }
  }

  return findings;
}
