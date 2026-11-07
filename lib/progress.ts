export type PipelineStep =
  | "ingest"
  | "model"
  | "attestation"
  | "analysis"
  | "signature"
  | "hardware";

export interface ProgressEvent {
  step: PipelineStep;
  status: "active" | "done" | "error";
  detail?: string;
}

export const PIPELINE_STEPS: Array<{
  id: PipelineStep;
  label: string;
  description: string;
}> = [
  {
    id: "ingest",
    label: "Read files",
    description: "Parse the statement and receipts in server memory",
  },
  {
    id: "model",
    label: "Select TEE model",
    description: "Confirm the model is NEAR AI-hosted and attestable",
  },
  {
    id: "attestation",
    label: "Attest hardware",
    description: "Fetch a fresh nonce-bound report for model and gateway TEEs",
  },
  {
    id: "analysis",
    label: "Analyze privately",
    description: "Categorize and flag anomalies inside the enclave",
  },
  {
    id: "signature",
    label: "Verify signature",
    description: "Match request/response hashes to the TEE signer",
  },
  {
    id: "hardware",
    label: "Check TDX + GPU",
    description: "Validate Intel TDX quotes and NVIDIA NRAS evidence",
  },
];
