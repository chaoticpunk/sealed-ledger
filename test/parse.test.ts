import { describe, expect, it } from "vitest";

import {
  normalizeDate,
  parseSignedAmount,
  parseStatementCsv,
} from "@/lib/audit/parse";

describe("parseSignedAmount", () => {
  it("parses plain, comma, currency, and parenthesized amounts", () => {
    expect(parseSignedAmount("63.42")).toBe(63.42);
    expect(parseSignedAmount("-1,899.00")).toBe(-1899);
    expect(parseSignedAmount("$78.21")).toBe(78.21);
    expect(parseSignedAmount("(500.00)")).toBe(-500);
    expect(parseSignedAmount("USD 42.00")).toBe(42);
    expect(parseSignedAmount("not a number")).toBeNull();
  });
});

describe("normalizeDate", () => {
  it("normalizes ISO and US-style dates", () => {
    expect(normalizeDate("2026-09-12")).toBe("2026-09-12");
    expect(normalizeDate("09/12/2026")).toBe("2026-09-12");
    expect(normalizeDate("12/09/2026")).toBe("2026-12-09");
    expect(normalizeDate("13/09/2026")).toBe("2026-09-13");
  });
});

describe("parseStatementCsv", () => {
  it("parses signed rows and infers debit/credit", () => {
    const csv = [
      "date,time,description,merchant,amount,currency,category_hint",
      "2026-09-01,,Salary,Northwind Studio,4200.00,USD,Income",
      "2026-09-02,09:14,Groceries,Harbor & Pine Grocery,-63.42,USD,Groceries",
      "2026-09-03,,Rent,Maple Court Apartments,-1850.00,USD,Housing",
    ].join("\n");

    const parsed = parseStatementCsv(csv);

    expect(parsed.rows).toHaveLength(3);
    expect(parsed.currency).toBe("USD");
    expect(parsed.rows[0]).toMatchObject({
      index: 0,
      merchant: "Northwind Studio",
      signedAmount: 4200,
      direction: "credit",
      categoryHint: "Income",
    });
    expect(parsed.rows[1]).toMatchObject({
      index: 1,
      signedAmount: -63.42,
      direction: "debit",
      time: "09:14",
    });
  });

  it("supports separate debit and credit columns", () => {
    const csv = [
      "date,description,debit,credit",
      "2026-09-01,Coffee,8.75,",
      "2026-09-02,Salary,,4200.00",
    ].join("\n");

    const parsed = parseStatementCsv(csv);
    expect(parsed.rows[0].signedAmount).toBe(-8.75);
    expect(parsed.rows[0].direction).toBe("debit");
    expect(parsed.rows[1].signedAmount).toBe(4200);
    expect(parsed.rows[1].direction).toBe("credit");
  });

  it("throws when no rows are usable", () => {
    expect(() => parseStatementCsv("foo,bar\n1,2")).toThrow(
      /No usable transactions/,
    );
  });
});
