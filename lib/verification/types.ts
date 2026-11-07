export type CheckStatus = "pass" | "fail" | "skip";

export type CheckCategory =
  | "model"
  | "attestation"
  | "tdx"
  | "gpu"
  | "signature"
  | "data";

export interface VerificationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
  category: CheckCategory;
}

export interface VerificationReport {
  verified: boolean;
  checks: VerificationCheck[];
  model: {
    id: string;
    name?: string;
    owner?: string;
  };
  nonce: string;
  attestedAt: string;
  signingAddress: string | null;
  signatureKind: "provider_tee" | "gateway";
  hashes: {
    request: string;
    response: string;
  };
  signature: {
    recovered: string | null;
    expected: string | null;
    signedText: string;
  };
  attestation: {
    modelNodes: number;
    gatewayAddress: string | null;
    tdxStatus: string | null;
    gpuCount: number;
    gpuModels: string[];
    composeVerified: boolean | null;
  };
  timing: {
    totalMs: number;
    verifiedAt: string;
  };
  retention: "none";
}
