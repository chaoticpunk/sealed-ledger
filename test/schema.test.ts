import { describe, expect, it } from "vitest";

import { extractJsonObject, parseModelAudit } from "@/lib/audit/schema";

describe("extractJsonObject", () => {
  it("strips markdown fences and surrounding prose", () => {
    const content = 'Here is the audit:\n```json\n{"summary":"ok"}\n```\nDone.';
    expect(extractJsonObject(content)).toBe('{"summary":"ok"}');
  });

  it("throws when there is no object", () => {
    expect(() => extractJsonObject("no json here")).toThrow(/JSON object/);
  });
});

describe("parseModelAudit", () => {
  it("accepts the expected audit shape", () => {
    const parsed = parseModelAudit(
      JSON.stringify({
        summary: "A normal month.",
        currency: "USD",
        categorizations: [
          { index: 0, category: "Groceries", anomaly: false },
        ],
        receipts: [
          {
            file: "receipt-1.png",
            merchant: "Harbor & Pine",
            date: "2026-09-12",
            amount: 63.42,
            currency: "USD",
            category: "Groceries",
          },
        ],
        anomalies: [
          { source: "statement", index: 4, severity: "high", reason: "Duplicate" },
        ],
      }),
    );

    expect(parsed.categorizations?.[0].category).toBe("Groceries");
    expect(parsed.receipts?.[0].amount).toBe(63.42);
  });

  it("rejects invalid JSON and invalid shapes", () => {
    expect(() => parseModelAudit('{"summary":}')).toThrow(/malformed JSON/);
    expect(() =>
      parseModelAudit(JSON.stringify({ receipts: [{ merchant: "x" }] })),
    ).toThrow(/audit schema/);
  });
});
