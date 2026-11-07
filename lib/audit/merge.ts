import { normalizeMerchant, detectRuleFindings, type RuleFinding } from "./rules";
import { cleanText } from "./sanitize";
import { normalizeDate } from "./parse";
import { CATEGORIES } from "./prompt";
import type {
  AnomalySeverity,
  AuditAnalysis,
  AuditAnomaly,
  CategoryTotal,
  ModelAuditResult,
  ParsedStatement,
  Transaction,
  TransactionAnomaly,
} from "./types";

const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const CATEGORY_ALIASES: Record<string, string> = {
  "food and drink": "Dining",
  food: "Dining",
  restaurant: "Dining",
  restaurants: "Dining",
  coffee: "Dining",
  supermarket: "Groceries",
  grocery: "Groceries",
  gas: "Transport",
  fuel: "Transport",
  transit: "Transport",
  rideshare: "Transport",
  rent: "Housing",
  mortgage: "Housing",
  electricity: "Utilities",
  internet: "Utilities",
  phone: "Utilities",
  medical: "Health",
  pharmacy: "Health",
  fitness: "Health",
  retail: "Shopping",
  clothing: "Shopping",
  electronics: "Shopping",
  subscription: "Subscriptions",
  subscriptions: "Subscriptions",
  software: "Subscriptions",
  streaming: "Subscriptions",
  travel: "Travel",
  hotel: "Travel",
  airline: "Travel",
  entertainment: "Entertainment",
  education: "Education",
  tuition: "Education",
  transfer: "Transfers",
  savings: "Transfers",
  income: "Income",
  salary: "Income",
  payroll: "Income",
  fee: "Fees",
  fees: "Fees",
  other: "Other",
  uncategorized: "Other",
};

export function canonicalCategory(value: string | undefined, hint?: string): string {
  const candidates = [value, hint].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    const exact = CATEGORIES.find(
      (category) => category.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) return exact;

    const alias = CATEGORY_ALIASES[trimmed.toLowerCase()];
    if (alias) return alias;
  }

  return "Other";
}

function isTransferLike(transaction: Transaction): boolean {
  return (
    transaction.category === "Transfers" ||
    /transfer|savings|investment|brokerage/i.test(transaction.merchant) ||
    /transfer|savings|investment/i.test(transaction.description ?? "")
  );
}

function merchantSimilar(a: string, b: string): boolean {
  const first = normalizeMerchant(a);
  const second = normalizeMerchant(b);
  if (!first || !second) return false;
  if (first === second || first.includes(second) || second.includes(first)) {
    return true;
  }

  const firstTokens = new Set(first.split(" ").filter(Boolean));
  const secondTokens = new Set(second.split(" ").filter(Boolean));
  if (firstTokens.size === 0 || secondTokens.size === 0) return false;

  let overlap = 0;
  for (const token of firstTokens) {
    if (secondTokens.has(token)) overlap += 1;
  }

  return overlap / Math.min(firstTokens.size, secondTokens.size) >= 0.6;
}

function dateDistance(a: string | null, b: string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(second)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(first - second) / 86_400_000;
}

function addAnomaly(
  transaction: Transaction,
  reason: string,
  severity: AnomalySeverity,
  source: "model" | "rules",
): void {
  if (!transaction.anomaly) {
    transaction.anomaly = {
      severity,
      reasons: [cleanText(reason, 400)],
      source,
    };
    return;
  }

  if (!transaction.anomaly.reasons.includes(cleanText(reason, 400))) {
    transaction.anomaly.reasons.push(cleanText(reason, 400));
  }

  if (SEVERITY_RANK[severity] > SEVERITY_RANK[transaction.anomaly.severity]) {
    transaction.anomaly.severity = severity;
  }

  if (transaction.anomaly.source !== source) {
    transaction.anomaly.source = "both";
  }
}

function applyModelCategorizations(
  transactions: Transaction[],
  model: ModelAuditResult,
): void {
  for (const categorization of model.categorizations ?? []) {
    const transaction = transactions.find(
      (candidate) => candidate.id === `stmt-${categorization.index}`,
    );
    if (!transaction) continue;

    transaction.category = canonicalCategory(
      categorization.category,
      transaction.category,
    );
    transaction.confidence = categorization.confidence;

    if (categorization.anomaly) {
      addAnomaly(
        transaction,
        categorization.anomalyReason || "Flagged by the private auditor model.",
        "medium",
        "model",
      );
    }
  }
}

function buildStatementTransactions(
  statement: ParsedStatement,
  model: ModelAuditResult,
): Transaction[] {
  const transactions: Transaction[] = statement.rows.map((row) => ({
    id: `stmt-${row.index}`,
    date: row.date,
    time: row.time,
    merchant: cleanText(row.merchant, 160),
    description: row.description ? cleanText(row.description, 200) : undefined,
    amount: Math.abs(row.signedAmount),
    currency: row.currency,
    direction: row.direction,
    category: canonicalCategory(row.categoryHint, row.categoryHint),
    source: "statement",
  }));

  applyModelCategorizations(transactions, model);
  return transactions;
}

function attachModelAnomalies(
  transactions: Transaction[],
  model: ModelAuditResult,
): void {
  for (const anomaly of model.anomalies ?? []) {
    const index = anomaly.index;
    const transaction =
      index !== undefined
        ? transactions.find((candidate) => candidate.id === `stmt-${index}`)
        : anomaly.source === "receipt"
          ? transactions.find(
              (candidate) =>
                candidate.source !== "statement" &&
                candidate.receiptFile === anomaly.file,
            )
          : undefined;

    if (!transaction) continue;
    addAnomaly(
      transaction,
      anomaly.reason,
      anomaly.severity ?? "medium",
      "model",
    );
  }
}

function matchReceipt(
  transactions: Transaction[],
  receipt: {
    merchant: string;
    date: string | null;
    amount: number;
  },
): Transaction | undefined {
  return transactions.find(
    (transaction) =>
      transaction.direction === "debit" &&
      transaction.source === "statement" &&
      Math.abs(transaction.amount - receipt.amount) <= 0.02 &&
      dateDistance(transaction.date, receipt.date) <= 2 &&
      merchantSimilar(transaction.merchant, receipt.merchant),
  );
}

function buildReceiptTransactions(
  transactions: Transaction[],
  images: Array<{ name: string }>,
  model: ModelAuditResult,
  defaultCurrency: string,
  baseCurrency: string,
): { added: number; matched: number } {
  let added = 0;
  let matched = 0;

  (model.receipts ?? []).forEach((receipt, index) => {
    const date = normalizeDate(receipt.date);
    if (!date) return;

    const amount = Math.abs(receipt.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const file =
      receipt.file && images.some((image) => image.name === receipt.file)
        ? receipt.file
        : images[index]?.name;

    const match = matchReceipt(transactions, {
      merchant: receipt.merchant,
      date,
      amount,
    });

    if (match) {
      match.source = "both";
      match.receiptFile = file;
      match.matchedStatementIndex = Number(match.id.replace("stmt-", ""));
      matched += 1;

      if (receipt.anomaly) {
        addAnomaly(
          match,
          receipt.anomalyReason || "Flagged on the matching receipt.",
          "medium",
          "model",
        );
      }
      return;
    }

    const transaction: Transaction = {
      id: `rcpt-${index}`,
      date,
      merchant: cleanText(receipt.merchant, 160),
      amount,
      currency: (receipt.currency || defaultCurrency).toUpperCase(),
      direction: "debit",
      category: canonicalCategory(receipt.category),
      source: "receipt",
      receiptFile: file,
      confidence: receipt.confidence,
    };

    if (receipt.anomaly) {
      addAnomaly(
        transaction,
        receipt.anomalyReason || "Flagged on the receipt.",
        "medium",
        "model",
      );
    }

    transactions.push(transaction);
    added += 1;
  });

  // Receipt currency mismatch against the bank statement is worth surfacing.
  for (const transaction of transactions) {
    if (
      transaction.source !== "statement" &&
      transaction.currency &&
      transaction.currency !== baseCurrency
    ) {
      addAnomaly(
        transaction,
        `Receipt is in ${transaction.currency}, but the statement is in ${baseCurrency}; check the conversion.`,
        "low",
        "rules",
      );
    }
  }

  return { added, matched };
}

function attachRuleFindings(
  transactions: Transaction[],
  findings: RuleFinding[],
): void {
  for (const finding of findings) {
    const transaction = transactions.find(
      (candidate) => candidate.id === finding.transactionId,
    );
    if (!transaction) continue;
    addAnomaly(transaction, finding.reason, finding.severity, "rules");
  }
}

function collectAnomalies(transactions: Transaction[]): AuditAnomaly[] {
  return transactions
    .filter(
      (transaction): transaction is Transaction & {
        anomaly: TransactionAnomaly;
      } => Boolean(transaction.anomaly),
    )
    .map((transaction) => ({
      transactionId: transaction.id,
      date: transaction.date,
      merchant: transaction.merchant,
      amount: transaction.amount,
      currency: transaction.currency,
      category: transaction.category,
      severity: transaction.anomaly.severity,
      reasons: [...new Set(transaction.anomaly.reasons)],
      source: transaction.anomaly.source,
    }))
    .sort((a, b) => {
      const severity =
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      return severity !== 0 ? severity : b.date.localeCompare(a.date);
    });
}

function buildCategories(
  transactions: Transaction[],
  currency: string,
): { categories: CategoryTotal[]; spend: number } {
  const totals = new Map<string, { amount: number; count: number }>();
  let spend = 0;

  for (const transaction of transactions) {
    if (
      transaction.direction !== "debit" ||
      isTransferLike(transaction) ||
      transaction.currency !== currency
    ) {
      continue;
    }

    spend += transaction.amount;
    const current = totals.get(transaction.category) ?? {
      amount: 0,
      count: 0,
    };
    current.amount += transaction.amount;
    current.count += 1;
    totals.set(transaction.category, current);
  }

  const categories = [...totals.entries()]
    .map(([name, value]) => ({
      name,
      amount: value.amount,
      count: value.count,
      share: spend > 0 ? value.amount / spend : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { categories, spend };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

function buildSummary(
  model: ModelAuditResult,
  totals: AuditAnalysis["totals"],
  categories: CategoryTotal[],
  anomalies: AuditAnomaly[],
  currency: string,
): string {
  if (model.summary?.trim()) {
    return cleanText(model.summary, 1_000);
  }

  const top = categories[0];
  const topAnomaly = anomalies[0];

  const parts = [
    `${totals.transactions} transactions were audited, with ${formatMoney(
      totals.spend,
      currency,
    )} of discretionary spending.`,
  ];

  if (top) {
    parts.push(
      `The largest category was ${top.name} at ${formatMoney(top.amount, currency)}.`,
    );
  }

  if (anomalies.length > 0 && topAnomaly) {
    parts.push(
      `${anomalies.length} item${anomalies.length === 1 ? "" : "s"} need review, starting with ${topAnomaly.merchant}.`,
    );
  } else {
    parts.push("No material anomalies were detected.");
  }

  return parts.join(" ");
}

export function mergeAnalysis(options: {
  statement?: ParsedStatement;
  images: Array<{ name: string }>;
  model: ModelAuditResult;
}): AuditAnalysis {
  const { statement, images, model } = options;

  const baseCurrency =
    statement?.currency || model.currency?.toUpperCase() || "USD";

  const transactions = statement
    ? buildStatementTransactions(statement, model)
    : [];

  const receiptStats = buildReceiptTransactions(
    transactions,
    images,
    model,
    baseCurrency,
    baseCurrency,
  );

  attachModelAnomalies(transactions, model);

  const findings = detectRuleFindings(transactions, baseCurrency);
  attachRuleFindings(transactions, findings);

  const anomalies = collectAnomalies(transactions);
  const { categories, spend } = buildCategories(transactions, baseCurrency);

  const income = transactions
    .filter(
      (transaction) =>
        transaction.direction === "credit" &&
        transaction.currency === baseCurrency &&
        !isTransferLike(transaction),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const dates = transactions.map((transaction) => transaction.date).sort();
  const period = {
    start: dates[0] ?? null,
    end: dates[dates.length - 1] ?? null,
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const totals = {
    spend,
    income,
    net: income - spend,
    transactions: transactions.length,
    anomalies: anomalies.length,
  };

  return {
    currency: baseCurrency,
    period,
    totals,
    categories,
    transactions: sortedTransactions,
    anomalies,
    summary: buildSummary(
      model,
      totals,
      categories,
      anomalies,
      baseCurrency,
    ),
    sources: {
      statementRows: statement?.rows.length ?? 0,
      receipts: images.length,
      matchedReceipts: receiptStats.matched,
    },
  };
}
