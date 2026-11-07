import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { mergeAnalysis } from "@/lib/audit/merge";
import { parseStatementCsv } from "@/lib/audit/parse";
import type { ModelAuditResult } from "@/lib/audit/types";

const csv = readFileSync(
  path.join(process.cwd(), "public", "samples", "bank-statement-2026-09.csv"),
  "utf8",
);

const statement = parseStatementCsv(csv);

const model: ModelAuditResult = {
  currency: "USD",
  summary: "A normal month with a few outliers.",
  categorizations: statement.rows.map((row) => ({
    index: row.index,
    category: row.categoryHint ?? "Other",
  })),
  receipts: [
    {
      file: "receipt-01-harbor-pine.png",
      merchant: "Harbor & Pine Grocery",
      date: "2026-09-12",
      amount: 63.42,
      currency: "USD",
      category: "Groceries",
    },
    {
      file: "receipt-02-nimbus-coffee.png",
      merchant: "Nimbus Coffee Roasters",
      date: "2026-09-04",
      amount: 8.75,
      currency: "USD",
      category: "Dining",
    },
    {
      file: "receipt-03-aurora-electronics.png",
      merchant: "Aurora Electronics",
      date: "2026-09-18",
      amount: 1_899,
      currency: "USD",
      category: "Shopping",
    },
    {
      file: "receipt-04-streamwave.png",
      merchant: "StreamWave",
      date: "2026-09-20",
      amount: 24.99,
      currency: "USD",
      category: "Subscriptions",
    },
    {
      file: "receipt-05-corner-hardware.png",
      merchant: "Corner Hardware",
      date: "2026-09-24",
      amount: 27.3,
      currency: "USD",
      category: "Shopping",
    },
  ],
};

describe("mergeAnalysis", () => {
  const analysis = mergeAnalysis({
    statement,
    images: [
      { name: "receipt-01-harbor-pine.png" },
      { name: "receipt-02-nimbus-coffee.png" },
      { name: "receipt-03-aurora-electronics.png" },
      { name: "receipt-04-streamwave.png" },
      { name: "receipt-05-corner-hardware.png" },
    ],
    model,
  });

  it("reconciles four receipts and adds the unmatched fifth", () => {
    expect(analysis.sources.statementRows).toBe(24);
    expect(analysis.sources.receipts).toBe(5);
    expect(analysis.sources.matchedReceipts).toBe(4);
    expect(
      analysis.transactions.find((transaction) =>
        transaction.merchant.includes("Corner Hardware"),
      )?.source,
    ).toBe("receipt");
    expect(
      analysis.transactions.find(
        (transaction) =>
          transaction.merchant.includes("Harbor & Pine") &&
          transaction.date === "2026-09-12",
      )?.source,
    ).toBe("both");
  });

  it("excludes transfers from spend and keeps income separate", () => {
    expect(analysis.totals.spend).toBeCloseTo(4_904.63, 2);
    expect(analysis.totals.income).toBe(4_200);
    expect(analysis.totals.net).toBeCloseTo(-704.63, 2);
    expect(
      analysis.categories.some((category) => category.name === "Transfers"),
    ).toBe(false);
  });

  it("flags duplicates, the large purchase, the price increase, and late-night spending", () => {
    const reasons = analysis.anomalies.flatMap((anomaly) => anomaly.reasons);

    expect(reasons.some((reason) => /duplicate/i.test(reason))).toBe(true);
    expect(reasons.some((reason) => /one-off purchase/i.test(reason))).toBe(true);
    expect(reasons.some((reason) => /Subscription increased/i.test(reason))).toBe(
      true,
    );
    expect(reasons.some((reason) => /02:13/.test(reason))).toBe(true);
    expect(analysis.totals.anomalies).toBeGreaterThanOrEqual(4);
  });

  it("computes categories from the merged ledger", () => {
    const groceries = analysis.categories.find(
      (category) => category.name === "Groceries",
    );
    expect(groceries?.count).toBe(5);
    expect(groceries?.amount).toBeCloseTo(323.95, 2);
  });
});
