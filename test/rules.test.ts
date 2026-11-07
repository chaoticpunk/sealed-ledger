import { describe, expect, it } from "vitest";

import { detectRuleFindings } from "@/lib/audit/rules";
import type { Transaction } from "@/lib/audit/types";

function transaction(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    date: "2026-09-01",
    merchant: "Test Merchant",
    amount: 10,
    currency: "USD",
    direction: "debit",
    category: "Other",
    source: "statement",
    ...overrides,
  };
}

describe("detectRuleFindings", () => {
  it("flags a repeated merchant + amount within three days", () => {
    const findings = detectRuleFindings(
      [
        transaction({
          id: "a",
          date: "2026-09-04",
          merchant: "Nimbus Coffee",
          amount: 8.75,
          category: "Dining",
        }),
        transaction({
          id: "b",
          date: "2026-09-05",
          merchant: "Nimbus Coffee",
          amount: 8.75,
          category: "Dining",
        }),
      ],
      "USD",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: "b",
          type: "duplicate",
          severity: "high",
        }),
      ]),
    );
  });

  it("flags large discretionary purchases", () => {
    const findings = detectRuleFindings(
      [
        transaction({
          id: "large",
          merchant: "Aurora Electronics",
          amount: 1_899,
          category: "Shopping",
        }),
      ],
      "USD",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: "large",
          type: "large_purchase",
          severity: "high",
        }),
      ]),
    );
  });

  it("does not flag fixed costs or transfers as large purchases", () => {
    const findings = detectRuleFindings(
      [
        transaction({
          id: "rent",
          merchant: "Maple Court Apartments",
          amount: 1_850,
          category: "Housing",
        }),
        transaction({
          id: "transfer",
          merchant: "Savings Transfer",
          amount: 500,
          category: "Transfers",
        }),
      ],
      "USD",
    );

    expect(findings.filter((finding) => finding.type === "large_purchase")).toHaveLength(
      0,
    );
  });

  it("flags a subscription price increase", () => {
    const findings = detectRuleFindings(
      [
        transaction({
          id: "old",
          date: "2026-09-10",
          merchant: "StreamWave",
          amount: 15.99,
          category: "Subscriptions",
        }),
        transaction({
          id: "new",
          date: "2026-09-20",
          merchant: "StreamWave",
          amount: 24.99,
          category: "Subscriptions",
        }),
      ],
      "USD",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: "new",
          type: "subscription_increase",
          severity: "medium",
        }),
      ]),
    );
  });

  it("flags late-night spending", () => {
    const findings = detectRuleFindings(
      [
        transaction({
          id: "late",
          time: "02:13",
          merchant: "Midnight Diner",
          amount: 68.4,
          category: "Dining",
        }),
      ],
      "USD",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: "late",
          type: "late_night",
          severity: "low",
        }),
      ]),
    );
  });

  it("flags category outliers when there is enough history", () => {
    const findings = detectRuleFindings(
      [
        transaction({ id: "g1", category: "Groceries", amount: 10 }),
        transaction({ id: "g2", category: "Groceries", amount: 11 }),
        transaction({ id: "g3", category: "Groceries", amount: 12 }),
        transaction({ id: "g4", category: "Groceries", amount: 13 }),
        transaction({ id: "g5", category: "Groceries", amount: 300 }),
      ],
      "USD",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: "g5",
          type: "category_outlier",
          severity: "medium",
        }),
      ]),
    );
  });
});
