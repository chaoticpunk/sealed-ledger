import { Buffer } from "buffer";
import { createHash } from "crypto";
import { decodeJwt } from "jose";
import { js_get_collateral, js_verify } from "@phala/dcap-qvl-node";

import { verifyGpuWithNras } from "./client";
import type {
  AttestationInfo,
  AttestationReport,
  ComposeVerification,
  GpuSummary,
  GpuVerification,
  ReportDataVerification,
  TdxVerification,
} from "./types";

const TDX_PCCS_URL =
  "https://api.trustedservices.intel.com/tdx/certification/v4";

const TDX_STATUS_OK = new Set(["UpToDate", "OutOfDate"]);

function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, "");
}

interface DcapResult {
  status?: unknown;
  message?: unknown;
  quote?: {
    verified?: unknown;
    body?: { reportdata?: unknown; mrconfig?: unknown };
  };
  report?: {
    TD10?: { report_data?: unknown; mr_config_id?: unknown };
  };
}

/**
 * Verify the Intel TDX quote with Phala's dcap-qvl implementation.
 * This checks the Intel signature chain, quote structure, and TCB status.
 */
export async function verifyTdxQuote(
  attestation: AttestationInfo,
): Promise<TdxVerification> {
  const quoteHex = stripHexPrefix(attestation.intel_quote ?? "");
  if (!quoteHex || !/^[0-9a-f]+$/i.test(quoteHex) || quoteHex.length % 2 !== 0) {
    throw new Error("Attestation did not include a valid hex-encoded Intel TDX quote");
  }

  const rawQuote = Buffer.from(quoteHex, "hex");
  const collateral = await js_get_collateral(TDX_PCCS_URL, rawQuote);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const raw = js_verify(rawQuote, collateral, now) as DcapResult;

  const status = typeof raw?.status === "string" ? raw.status : undefined;
  const verified = status
    ? TDX_STATUS_OK.has(status)
    : Boolean(raw?.quote?.verified);

  const td10 = raw?.report?.TD10 ?? {};
  const reportDataHex = stripHexPrefix(
    String(td10.report_data ?? raw?.quote?.body?.reportdata ?? ""),
  );
  const mrConfig = stripHexPrefix(
    String(td10.mr_config_id ?? raw?.quote?.body?.mrconfig ?? ""),
  );

  return {
    verified,
    status,
    message: typeof raw?.message === "string" ? raw.message : undefined,
    reportDataHex,
    mrConfig,
  };
}

/**
 * Confirm that the TDX report data binds the TEE signing address and the
 * request nonce. Without this, valid GPU evidence could be paired with a key
 * that was generated outside the enclave.
 */
export function checkReportData(
  attestation: AttestationInfo,
  requestNonce: string,
  tdx: TdxVerification,
): ReportDataVerification {
  const reportData = Buffer.from(stripHexPrefix(tdx.reportDataHex), "hex");
  if (reportData.length < 64) {
    throw new Error(
      `TDX report data is ${reportData.length} bytes; expected at least 64`,
    );
  }

  const signingAlgo = (attestation.signing_algo || "ecdsa").toLowerCase();
  const addressHex = stripHexPrefix(attestation.signing_address);
  const addressBytes = Buffer.from(addressHex, "hex");

  if (addressBytes.length > 32) {
    throw new Error("TEE signing address is longer than 32 bytes");
  }

  const paddedAddress = Buffer.concat([
    addressBytes,
    Buffer.alloc(32 - addressBytes.length, 0),
  ]);

  let expectedFirst32: Buffer;
  const tlsFingerprint = attestation.tls_cert_fingerprint;

  if (tlsFingerprint) {
    const fingerprintBytes = Buffer.from(stripHexPrefix(tlsFingerprint), "hex");
    expectedFirst32 = createHash("sha256")
      .update(addressBytes)
      .update(fingerprintBytes)
      .digest();
  } else {
    expectedFirst32 = paddedAddress;
  }

  const actualFirst32 = reportData.subarray(0, 32);
  const actualSecond32 = reportData.subarray(32, 64);
  const nonceBytes = Buffer.from(stripHexPrefix(requestNonce), "hex");

  return {
    bindsAddress: actualFirst32.equals(expectedFirst32),
    embedsNonce:
      nonceBytes.length === 32 && actualSecond32.equals(nonceBytes),
    expectedAddressHex: expectedFirst32.toString("hex"),
    actualFirst32: actualFirst32.toString("hex"),
    expectedNonceHex: stripHexPrefix(requestNonce).toLowerCase(),
    actualSecond32: actualSecond32.toString("hex"),
    signingAlgo,
  };
}

interface ParsedNras {
  overall: Record<string, unknown>;
  gpus: GpuSummary[];
}

function decodeNrasToken(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  try {
    return decodeJwt(token) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseNrasResponse(nras: unknown): ParsedNras {
  if (!Array.isArray(nras) || nras.length === 0) {
    throw new Error("NVIDIA NRAS returned an unexpected response shape");
  }

  let overallToken: unknown;
  const gpuTokens: Record<string, unknown> = {};

  for (const part of nras) {
    if (Array.isArray(part) && part.length === 2) {
      overallToken = part[1];
    } else if (part && typeof part === "object") {
      Object.assign(gpuTokens, part);
    }
  }

  const overall = decodeNrasToken(overallToken);
  if (!overall) {
    throw new Error("NVIDIA NRAS overall attestation JWT could not be decoded");
  }

  const now = Math.floor(Date.now() / 1000);

  const gpus: GpuSummary[] = Object.entries(gpuTokens).map(([key, token]) => {
    const claims = decodeNrasToken(token) ?? {};
    const rawWarning = claims["x-nvidia-attestation-warning"];
    const warning =
      typeof rawWarning === "string" && rawWarning.trim().length > 0
        ? rawWarning
        : null;

    const verifiedFlags = Object.entries(claims).filter(
      ([name, value]) =>
        name.startsWith("x-nvidia-") &&
        name.endsWith("-verified") &&
        typeof value === "boolean",
    );

    const nonceField =
      claims["x-nvidia-gpu-attestation-report-nonce-match"] ?? null;
    const exp = typeof claims.exp === "number" ? claims.exp : null;

    return {
      key,
      hwmodel: typeof claims.hwmodel === "string" ? claims.hwmodel : null,
      driverVersion:
        typeof claims["x-nvidia-gpu-driver-version"] === "string"
          ? claims["x-nvidia-gpu-driver-version"]
          : null,
      vbiosVersion:
        typeof claims["x-nvidia-gpu-vbios-version"] === "string"
          ? claims["x-nvidia-gpu-vbios-version"]
          : null,
      secureBoot:
        typeof claims.secboot === "boolean" ? claims.secboot : null,
      debugStatus:
        typeof claims.dbgstat === "string" ? claims.dbgstat : null,
      measurementResult:
        typeof claims.measres === "string" ? claims.measres : null,
      nonceMatch: typeof nonceField === "boolean" ? nonceField : null,
      verifiedFlagsOk:
        verifiedFlags.length > 0 &&
        verifiedFlags.every(([, value]) => value === true),
      warning,
      expired: exp !== null && exp < now,
    };
  });

  return { overall, gpus };
}

/**
 * Verify NVIDIA GPU evidence via NRAS, including the nonce on both the
 * evidence payload and the signed NVIDIA claims.
 */
export async function verifyGpuAttestation(
  attestation: AttestationInfo,
  requestNonce: string,
): Promise<GpuVerification> {
  if (!attestation.nvidia_payload) {
    throw new Error(
      "The model attestation has no NVIDIA GPU payload; it is not a verifiable TEE model",
    );
  }

  let payload: Record<string, unknown>;
  if (typeof attestation.nvidia_payload === "string") {
    payload = JSON.parse(attestation.nvidia_payload) as Record<string, unknown>;
  } else {
    payload = attestation.nvidia_payload;
  }

  const payloadNonceMatches =
    typeof payload.nonce === "string" &&
    stripHexPrefix(payload.nonce).toLowerCase() ===
      stripHexPrefix(requestNonce).toLowerCase();

  const nras = await verifyGpuWithNras(payload);
  const { overall, gpus } = parseNrasResponse(nras);

  const overallNonce =
    typeof overall.eat_nonce === "string" ? overall.eat_nonce : null;
  const overallNonceMatches =
    overallNonce !== null &&
    stripHexPrefix(overallNonce).toLowerCase() ===
      stripHexPrefix(requestNonce).toLowerCase();
  const overallResult = overall["x-nvidia-overall-att-result"] === true;

  const gpusOk =
    gpus.length > 0 &&
    gpus.every(
      (gpu) =>
        gpu.verifiedFlagsOk &&
        gpu.secureBoot === true &&
        gpu.debugStatus === "disabled" &&
        gpu.measurementResult === "success" &&
        gpu.nonceMatch !== false &&
        !gpu.expired &&
        gpu.warning === null,
    );

  return {
    overallResult,
    overallNonce,
    overallNonceMatches,
    payloadNonceMatches,
    gpus,
    allPassed:
      overallResult && overallNonceMatches && payloadNonceMatches && gpusOk,
    rawOverall: overall,
  };
}

/**
 * Compare the attested Docker Compose manifest with mr_config from the
 * verified TDX quote. A match proves the exact container configuration.
 */
export function verifyCompose(
  attestation: AttestationInfo,
  tdx: TdxVerification,
): ComposeVerification {
  const rawTcb = attestation.info?.tcb_info;
  if (!rawTcb) {
    return { available: false, matches: null };
  }

  let tcbInfo: Record<string, unknown>;
  try {
    tcbInfo =
      typeof rawTcb === "string"
        ? (JSON.parse(rawTcb) as Record<string, unknown>)
        : rawTcb;
  } catch {
    return { available: false, matches: null };
  }

  const appCompose =
    typeof tcbInfo.app_compose === "string" ? tcbInfo.app_compose : null;
  if (!appCompose || !tdx.mrConfig) {
    return { available: false, matches: null };
  }

  const composeHash = createHash("sha256").update(appCompose).digest("hex");
  const matches = tdx.mrConfig
    .toLowerCase()
    .startsWith(`01${composeHash}`.toLowerCase());

  let manifest: string | undefined;
  try {
    const parsed = JSON.parse(appCompose) as { docker_compose_file?: string };
    manifest = parsed.docker_compose_file;
  } catch {
    manifest = appCompose.slice(0, 2_000);
  }

  return {
    available: true,
    matches,
    composeHash,
    mrConfig: tdx.mrConfig,
    manifest,
  };
}

export interface ModelVerificationBundle {
  tdx: TdxVerification;
  reportData: ReportDataVerification;
  gpu: GpuVerification;
  compose: ComposeVerification;
}

export async function verifyModelAttestation(
  attestation: AttestationInfo,
  nonce: string,
): Promise<ModelVerificationBundle> {
  const [tdx, gpu] = await Promise.all([
    verifyTdxQuote(attestation),
    verifyGpuAttestation(attestation, nonce),
  ]);

  return {
    tdx,
    reportData: checkReportData(attestation, nonce, tdx),
    gpu,
    compose: verifyCompose(attestation, tdx),
  };
}

export interface GatewayVerificationBundle {
  tdx: TdxVerification;
  reportData: ReportDataVerification;
  compose: ComposeVerification;
}

export async function verifyGatewayAttestation(
  attestation: AttestationInfo,
  nonce: string,
): Promise<GatewayVerificationBundle> {
  const tdx = await verifyTdxQuote(attestation);

  return {
    tdx,
    reportData: checkReportData(attestation, nonce, tdx),
    compose: verifyCompose(attestation, tdx),
  };
}

export function pickAttestationForSigner(
  report: AttestationReport,
  signingAddress: string,
  kind: "provider_tee" | "gateway",
): AttestationInfo | null {
  const target = signingAddress.toLowerCase();

  if (kind === "gateway") {
    const gateway = report.gateway_attestation;
    return gateway?.signing_address?.toLowerCase() === target ? gateway : null;
  }

  return (
    report.model_attestations?.find(
      (attestation) =>
        attestation.signing_address?.toLowerCase() === target,
    ) ?? null
  );
}
