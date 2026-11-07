import type { ParsedStatement } from "./types";

export interface UploadedReceiptImage {
  name: string;
  mimeType: string;
  base64: string;
}

export interface AuditPromptInput {
  statement?: ParsedStatement;
  images: UploadedReceiptImage[];
  repairNote?: string;
}

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Shopping",
  "Subscriptions",
  "Travel",
  "Entertainment",
  "Education",
  "Transfers",
  "Income",
  "Fees",
  "Other",
] as const;

export function buildSystemPrompt(): string {
  return `You are Sealed Ledger, a meticulous personal expense auditor running inside a confidential hardware enclave.

You receive two kinds of input:
1. A parsed bank statement: indexed rows with date, time, merchant, signed amount (negative = money out), currency, and an optional category hint.
2. Zero or more receipt images.

Return exactly ONE JSON object, with no markdown, commentary, or code fences:

{
  "summary": "at most 3 sentences, no personal data",
  "currency": "USD",
  "categorizations": [
    { "index": 0, "category": "Groceries", "anomaly": false, "anomaly_reason": "", "confidence": 0.95 }
  ],
  "receipts": [
    {
      "file": "receipt-1.png",
      "merchant": "Harbor & Pine Grocery",
      "date": "2026-09-12",
      "amount": 63.42,
      "currency": "USD",
      "category": "Groceries",
      "anomaly": false,
      "anomaly_reason": "",
      "items": ["Produce 18.20", "Pantry 31.22", "Tax 4.00"],
      "confidence": 0.97
    }
  ],
  "anomalies": [
    { "source": "statement", "index": 16, "severity": "high", "reason": "One sentence explaining why this is unusual." }
  ]
}

Hard rules:
- For EVERY statement row, return exactly one categorization using its index. Do not skip, merge, or invent rows.
- For EACH receipt image, return exactly one receipt entry. If it matches a statement row, still return it; the application reconciles duplicates.
- All amounts are positive in your output; direction is already encoded in the statement input.
- Dates must be ISO YYYY-MM-DD.
- Categories must be exactly one of: ${CATEGORIES.join(", ")}.
- Flag anomalies conservatively: duplicate charges, an amount far above the norm for its category, a sudden subscription price increase, late-night purchases (00:00–05:00), foreign-currency transactions, or an otherwise suspicious merchant. Explain each in one sentence.
- The summary may mention the largest category and the most important anomaly, but must not include account numbers, card numbers, emails, phone numbers, or full names.
- If a receipt image is unreadable, skip it instead of guessing.
- Never invent a transaction. Output JSON only.`;
}

export function buildUserContent(input: AuditPromptInput): Array<
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
> {
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  const statement = input.statement;
  if (statement) {
    const rows = statement.rows.map((row) => ({
      index: row.index,
      date: row.date,
      time: row.time ?? null,
      merchant: row.merchant,
      amount: row.signedAmount,
      currency: row.currency,
      category_hint: row.categoryHint ?? null,
    }));

    parts.push({
      type: "text",
      text: `BANK STATEMENT
Currency: ${statement.currency}
Rows: ${rows.length}
Columns: index, date, time, merchant, amount (signed), currency, category_hint

${JSON.stringify(rows)}`,
    });
  } else {
    parts.push({
      type: "text",
      text: "No parsed bank statement was provided. Work from the receipt images only.",
    });
  }

  if (input.images.length > 0) {
    parts.push({
      type: "text",
      text: `RECEIPT IMAGES (${input.images.length}). Use the exact file label in the "file" field.`,
    });

    input.images.forEach((image, index) => {
      parts.push({
        type: "text",
        text: `Receipt ${index + 1} — file: ${image.name}`,
      });
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.base64}`,
        },
      });
    });
  }

  if (input.repairNote) {
    parts.push({
      type: "text",
      text: `CORRECTION REQUIRED: ${input.repairNote} Return only the JSON object described in the system prompt.`,
    });
  }

  return parts;
}

export function buildAuditRequestBody(options: {
  model: string;
  input: AuditPromptInput;
  maxTokens?: number;
  jsonMode?: boolean;
  disableThinking?: boolean;
}): { requestBody: string; messages: unknown[] } {
  const {
    model,
    input,
    maxTokens = 8_000,
    jsonMode = true,
    disableThinking = true,
  } = options;

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserContent(input) },
  ];

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: 0.1,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  // Qwen chat templates accept this flag; it keeps the JSON answer fast and
  // avoids spending the output budget on hidden reasoning tokens.
  if (disableThinking && /qwen/i.test(model)) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  const requestBody = JSON.stringify(body);

  return { requestBody, messages };
}
