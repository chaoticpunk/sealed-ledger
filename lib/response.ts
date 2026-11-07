import type { AuditAnalysis } from "@/lib/audit/types";
import type { VerificationReport } from "@/lib/verification/types";

export interface AuditResponse {
  analysis: AuditAnalysis;
  verification: VerificationReport;
  warnings: string[];
}
