export type TransactionDirection = "debit" | "credit";
export type TransactionSource = "statement" | "receipt" | "both";
export type AnomalySeverity = "high" | "medium" | "low";

export interface StatementRow {
  index: number;
  date: string;
  time?: string;
  merchant: string;
  description?: string;
  signedAmount: number;
  currency: string;
  direction: TransactionDirection;
  categoryHint?: string;
}

export interface ParsedStatement {
  rows: StatementRow[];
  currency: string;
  warnings: string[];
}

export interface ReceiptTransaction {
  file?: string;
  merchant: string;
  date: string;
  amount: number;
  currency?: string;
  category: string;
  anomaly?: boolean;
  anomalyReason?: string;
  confidence?: number;
}

export interface ModelAnomaly {
  source?: "statement" | "receipt";
  index?: number;
  file?: string;
  severity?: AnomalySeverity;
  reason: string;
}

export interface ModelAuditResult {
  summary?: string;
  currency?: string;
  categorizations?: Array<{
    index: number;
    category: string;
    anomaly?: boolean;
    anomalyReason?: string;
    confidence?: number;
  }>;
  receipts?: ReceiptTransaction[];
  anomalies?: ModelAnomaly[];
}

export interface TransactionAnomaly {
  severity: AnomalySeverity;
  reasons: string[];
  source: "model" | "rules" | "both";
}

export interface Transaction {
  id: string;
  date: string;
  time?: string;
  merchant: string;
  description?: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  category: string;
  source: TransactionSource;
  receiptFile?: string;
  matchedStatementIndex?: number;
  confidence?: number;
  anomaly?: TransactionAnomaly;
}

export interface CategoryTotal {
  name: string;
  amount: number;
  count: number;
  share: number;
}

export interface AuditAnomaly {
  transactionId: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  severity: AnomalySeverity;
  reasons: string[];
  source: "model" | "rules" | "both";
}

export interface AuditAnalysis {
  currency: string;
  period: { start: string | null; end: string | null };
  totals: {
    spend: number;
    income: number;
    net: number;
    transactions: number;
    anomalies: number;
  };
  categories: CategoryTotal[];
  transactions: Transaction[];
  anomalies: AuditAnomaly[];
  summary: string;
  sources: {
    statementRows: number;
    receipts: number;
    matchedReceipts: number;
  };
}
