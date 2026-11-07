import Papa from "papaparse";

import type { ParsedStatement, StatementRow, TransactionDirection } from "./types";

const MAX_ROWS = 300;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function firstValue(
  row: Record<string, string>,
  candidates: string[],
): string | undefined {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return undefined;
}

export function parseSignedAmount(raw: string): number | null {
  let value = raw.trim();
  if (!value) return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }

  value = value
    .replace(/[,$£€¥\s]/g, "")
    .replace(/^(?:USD|EUR|GBP|JPY|CNY|USDC|USDT)/i, "")
    .replace(/(?:USD|EUR|GBP|JPY|CNY|USDC|USDT)$/i, "");

  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return negative ? -amount : amount;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function normalizeDate(raw: string): string | null {
  const value = raw.trim().split("T")[0];
  if (!value) return null;

  let match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (match) {
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${match[1]}-${pad(month)}-${pad(day)}`;
    }
  }

  match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(value);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;

    const first = Number(match[1]);
    const second = Number(match[2]);

    // Prefer DD/MM when the first component cannot be a month.
    if (first > 12 && second <= 12) {
      return `${year}-${pad(second)}-${pad(first)}`;
    }

    // Otherwise treat it as US-style MM/DD.
    if (first <= 12 && second <= 31) {
      return `${year}-${pad(first)}-${pad(second)}`;
    }

    if (first <= 31 && second <= 12) {
      return `${year}-${pad(second)}-${pad(first)}`;
    }
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate(),
    )}`;
  }

  return null;
}

function normalizeTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(raw.trim());
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}

function directionFromSignedAmount(amount: number): TransactionDirection {
  return amount < 0 ? "debit" : "credit";
}

export function parseStatementCsv(
  text: string,
  fallbackCurrency = "USD",
): ParsedStatement {
  const warnings: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  if (parsed.errors.length > 0) {
    warnings.push(
      `CSV parser reported ${parsed.errors.length} malformed line(s); valid rows were kept.`,
    );
  }

  const rows: StatementRow[] = [];
  const currencies = new Set<string>();

  for (const raw of parsed.data) {
    if (rows.length >= MAX_ROWS) {
      warnings.push(`Only the first ${MAX_ROWS} statement rows were processed.`);
      break;
    }

    const date = normalizeDate(
      firstValue(raw, ["date", "transaction_date", "posted_date", "posting_date"]) ??
        "",
    );
    const merchant =
      firstValue(raw, ["merchant", "payee", "counterparty", "name"]) ??
      firstValue(raw, ["description", "memo", "details"]) ??
      "";
    const description = firstValue(raw, [
      "description",
      "memo",
      "details",
      "transaction_description",
    ]);

    let signedAmount: number | null = null;
    const amountRaw = firstValue(raw, ["amount", "transaction_amount", "value"]);
    if (amountRaw) {
      signedAmount = parseSignedAmount(amountRaw);
    }

    if (signedAmount === null) {
      const debit = firstValue(raw, [
        "debit",
        "withdrawal",
        "withdrawals",
        "money_out",
      ]);
      const credit = firstValue(raw, [
        "credit",
        "deposit",
        "deposits",
        "money_in",
      ]);
      const debitAmount = debit ? parseSignedAmount(debit) : null;
      const creditAmount = credit ? parseSignedAmount(credit) : null;
      if (debitAmount !== null && debitAmount !== 0) {
        signedAmount = -Math.abs(debitAmount);
      } else if (creditAmount !== null && creditAmount !== 0) {
        signedAmount = Math.abs(creditAmount);
      }
    }

    if (!date || !merchant || signedAmount === null) {
      warnings.push(
        `Skipped a row without a parseable date, merchant, or amount (row ${rows.length + 2}).`,
      );
      continue;
    }

    const currency =
      firstValue(raw, ["currency", "ccy", "currency_code"])?.toUpperCase() ??
      fallbackCurrency;
    currencies.add(currency);

    rows.push({
      index: rows.length,
      date,
      time: normalizeTime(firstValue(raw, ["time", "transaction_time"])),
      merchant,
      description,
      signedAmount,
      currency,
      direction: directionFromSignedAmount(signedAmount),
      categoryHint: firstValue(raw, [
        "category",
        "category_hint",
        "type",
        "transaction_type",
      ]),
    });
  }

  if (rows.length === 0) {
    throw new Error(
      "No usable transactions were found. Expected columns such as date, merchant/description, and amount.",
    );
  }

  const currency =
    currencies.size === 1 ? [...currencies][0] : fallbackCurrency;

  return { rows, currency, warnings };
}
