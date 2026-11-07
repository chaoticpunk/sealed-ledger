export interface ModelInfo {
  id: string;
  name?: string;
  owned_by?: string;
  description?: string;
  context_length?: number;
  architecture?: {
    inputModalities?: string[];
    outputModalities?: string[];
  };
  input_modalities?: string[];
  output_modalities?: string[];
  supported_features?: string[];
}

export interface AttestationInfo {
  signing_address: string;
  signing_algo: string;
  intel_quote: string;
  request_nonce?: string;
  nvidia_payload?: string | Record<string, unknown>;
  tls_cert_fingerprint?: string;
  info?: {
    tcb_info?: string | { app_compose?: string; [key: string]: unknown };
    [key: string]: unknown;
  };
  compose_manager_attestation?: unknown;
  [key: string]: unknown;
}

export interface AttestationReport {
  model_name?: string;
  model_attestations?: AttestationInfo[];
  gateway_attestation?: AttestationInfo;
  [key: string]: unknown;
}

export interface ChatSignature {
  text: string;
  signature: string;
  signing_address: string;
  signing_algo: string;
  signature_kind?: "provider_tee" | "gateway";
}

export interface GpuSummary {
  key: string;
  hwmodel: string | null;
  driverVersion: string | null;
  vbiosVersion: string | null;
  secureBoot: boolean | null;
  debugStatus: string | null;
  measurementResult: string | null;
  nonceMatch: boolean | null;
  verifiedFlagsOk: boolean;
  warning: string | null;
  expired: boolean;
}

export interface TdxVerification {
  verified: boolean;
  status?: string;
  message?: string;
  reportDataHex: string;
  mrConfig: string;
}

export interface ReportDataVerification {
  bindsAddress: boolean;
  embedsNonce: boolean;
  expectedAddressHex: string;
  actualFirst32: string;
  expectedNonceHex: string;
  actualSecond32: string;
  signingAlgo: string;
}

export interface GpuVerification {
  overallResult: boolean;
  overallNonce: string | null;
  overallNonceMatches: boolean;
  payloadNonceMatches: boolean;
  gpus: GpuSummary[];
  allPassed: boolean;
  rawOverall: Record<string, unknown>;
}

export interface ComposeVerification {
  available: boolean;
  matches: boolean | null;
  composeHash?: string;
  mrConfig?: string;
  manifest?: string;
}
