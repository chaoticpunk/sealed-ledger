import { z } from "zod";

const severity = z.enum(["high", "medium", "low"]);

// Models occasionally return numbers as strings ("1,899.00"). Coerce before
// validation so one formatting quirk does not discard an otherwise valid audit.
function coerceNumber(value: unknown): unknown {
  if (typeof value === "string") {
    const cleaned = value.replace(/[,$£€¥\s]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

const nonnegativeNumber = z.preprocess(coerceNumber, z.number().nonnegative());
const indexNumber = z.preprocess(
  coerceNumber,
  z.number().int().nonnegative(),
);
const confidenceNumber = z.preprocess(
  coerceNumber,
  z.number().min(0).max(1),
);

const categorization = z.object({
  index: indexNumber,
  category: z.string().min(1).max(60),
  anomaly: z.boolean().optional(),
  anomaly_reason: z.string().max(400).optional(),
  confidence: confidenceNumber.optional(),
});

const receipt = z.object({
  file: z.string().max(160).optional(),
  merchant: z.string().min(1).max(160),
  date: z.string().max(40),
  amount: nonnegativeNumber,
  currency: z.string().max(12).optional(),
  category: z.string().min(1).max(60),
  anomaly: z.boolean().optional(),
  anomaly_reason: z.string().max(400).optional(),
  confidence: confidenceNumber.optional(),
});

const modelAnomaly = z.object({
  source: z.enum(["statement", "receipt"]).optional(),
  index: indexNumber.optional(),
  file: z.string().max(160).optional(),
  severity: severity.optional(),
  reason: z.string().min(1).max(500),
});

export const modelAuditSchema = z.object({
  summary: z.string().max(1_200).optional(),
  currency: z.string().max(12).optional(),
  categorizations: z.array(categorization).max(400).optional(),
  receipts: z.array(receipt).max(30).optional(),
  anomalies: z.array(modelAnomaly).max(150).optional(),
});

export type RawModelAudit = z.infer<typeof modelAuditSchema>;

/** Remove markdown fences or stray prose around the model's JSON object. */
export function extractJsonObject(content: string): string {
  let text = content.trim();

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence?.[1]) {
    text = fence[1].trim();
  }

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("The model did not return a JSON object");
  }

  return text.slice(first, last + 1);
}

export function parseModelAudit(content: string): RawModelAudit {
  const json = extractJsonObject(content);
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("The model returned malformed JSON");
  }

  const parsed = modelAuditSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `The model response did not match the audit schema${
        issue ? ` (${issue.path.join(".")}: ${issue.message})` : ""
      }`,
    );
  }

  return parsed.data;
}
