import { randomBytes } from "crypto";

import {
  assertTeeHostedModel,
  fetchAttestationReport,
  fetchChatSignature,
  NearAiError,
  selectedModel,
  sendChatCompletion,
} from "@/lib/nearai/client";
import { verifyChatSignature } from "@/lib/nearai/chat-verify";
import {
  pickAttestationForSigner,
  verifyGatewayAttestation,
  verifyModelAttestation,
  type GatewayVerificationBundle,
  type ModelVerificationBundle,
} from "@/lib/nearai/verify";
import type {
  AttestationInfo,
  AttestationReport,
  ChatSignature,
  ModelInfo,
} from "@/lib/nearai/types";
import { mergeAnalysis } from "@/lib/audit/merge";
import { parseStatementCsv } from "@/lib/audit/parse";
import { buildAuditRequestBody, type UploadedReceiptImage } from "@/lib/audit/prompt";
import { parseModelAudit, type RawModelAudit } from "@/lib/audit/schema";
import type { ParsedStatement } from "@/lib/audit/types";
import type {
  VerificationCheck,
  VerificationReport,
} from "@/lib/verification/types";
import type { AuditResponse } from "@/lib/response";
import type { ProgressEvent } from "@/lib/progress";

const MAX_IMAGES = 6;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export interface UploadedFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export type PipelineResult = AuditResponse;

function emit(
  onProgress: ((event: ProgressEvent) => void) | undefined,
  event: ProgressEvent,
): void {
  onProgress?.(event);
}

function isCsv(file: UploadedFile): boolean {
  return (
    file.mimeType === "text/csv" ||
    file.mimeType === "application/csv" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

function isImage(file: UploadedFile): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.mimeType.toLowerCase());
}

function decodeCsv(file: UploadedFile): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
  } catch {
    throw new Error(`The file "${file.name}" is not valid UTF-8 CSV.`);
  }
}

function extractCompletionContent(responseText: string): string {
  let body: {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error("The TEE model returned a response that was not valid JSON.");
  }

  const content = body.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text ?? ""))
      .join("");
  }

  throw new Error("The TEE model returned an empty answer.");
}

function safeMessage(error: unknown): string {
  if (error instanceof NearAiError) {
    if (error.code === "missing_api_key") {
      return "NEAR AI Cloud is not configured. Add NEARAI_CLOUD_API_KEY to .env.local and restart the server.";
    }
    if (error.status === 401 || error.status === 403) {
      return "NEAR AI Cloud rejected the API key. Check NEARAI_CLOUD_API_KEY and your credits.";
    }
    if (error.status === 402) {
      return "NEAR AI Cloud reports insufficient credits for this request.";
    }
    if (error.code === "model_not_tee" || error.code === "model_not_found") {
      return error.message;
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The private audit could not be completed.";
}

interface PreparedInput {
  statement?: ParsedStatement;
  images: UploadedReceiptImage[];
  warnings: string[];
}

function prepareInput(files: UploadedFile[]): PreparedInput {
  if (files.length === 0) {
    throw new Error("Upload at least one receipt image or a bank statement CSV.");
  }

  const totalBytes = files.reduce((sum, file) => sum + file.buffer.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error("Upload is larger than 12 MB. Please use fewer or smaller files.");
  }

  for (const file of files) {
    if (file.buffer.length > MAX_FILE_BYTES) {
      throw new Error(`"${file.name}" is larger than 5 MB.`);
    }
    if (!isCsv(file) && !isImage(file)) {
      throw new Error(
        `"${file.name}" is not supported. Use PNG, JPG, WebP, or CSV.`,
      );
    }
  }

  const imageFiles = files.filter(isImage);
  if (imageFiles.length > MAX_IMAGES) {
    throw new Error(`Upload at most ${MAX_IMAGES} receipt images.`);
  }

  const warnings: string[] = [];
  let statement: ParsedStatement | undefined;

  const csvFiles = files.filter(isCsv);
  for (const file of csvFiles) {
    const parsed = parseStatementCsv(decodeCsv(file));

    if (!statement) {
      statement = parsed;
      warnings.push(...parsed.warnings);
    } else {
      const offset = statement.rows.length;
      statement.rows.push(
        ...parsed.rows.map((row) => ({ ...row, index: row.index + offset })),
      );
      warnings.push(
        ...parsed.warnings,
        `Merged "${file.name}" into the statement (${parsed.rows.length} rows).`,
      );
    }
  }

  if (statement) {
    const baseCurrency = statement.currency;
    const mixedCurrency = statement.rows.filter(
      (row) => row.currency !== baseCurrency,
    ).length;
    if (mixedCurrency > 0) {
      warnings.push(
        `${mixedCurrency} statement row(s) use a currency other than ${baseCurrency}; totals only include ${baseCurrency}.`,
      );
    }
  }

  const images: UploadedReceiptImage[] = imageFiles.map((file) => ({
    name: file.name,
    mimeType: file.mimeType.toLowerCase(),
    base64: file.buffer.toString("base64"),
  }));

  return { statement, images, warnings };
}

function check(
  id: string,
  label: string,
  status: VerificationCheck["status"],
  category: VerificationCheck["category"],
  detail?: string,
): VerificationCheck {
  return { id, label, status, category, detail };
}

function nonceEcho(
  attestation: AttestationInfo | undefined,
  nonce: string,
): boolean {
  return (
    attestation?.request_nonce?.toLowerCase() === nonce.toLowerCase()
  );
}

function allModelNoncesEcho(
  attestations: AttestationInfo[],
  nonce: string,
): boolean {
  return (
    attestations.length > 0 &&
    attestations.every((attestation) => nonceEcho(attestation, nonce))
  );
}

function verifierFailure(
  checks: VerificationCheck[],
  prefix: string,
  label: string,
  category: VerificationCheck["category"],
  error: unknown,
): void {
  checks.push(
    check(
      `${prefix}.error`,
      label,
      "fail",
      category,
      safeMessage(error),
    ),
  );
}

function buildChecks(options: {
  modelInfo: ModelInfo;
  report: AttestationReport;
  nonce: string;
  modelBundle?: ModelVerificationBundle;
  gatewayBundle?: GatewayVerificationBundle;
  modelError?: unknown;
  gatewayError?: unknown;
  signature: ChatSignature;
  chat: ReturnType<typeof verifyChatSignature>;
}): VerificationCheck[] {
  const {
    modelInfo,
    report,
    nonce,
    modelBundle,
    gatewayBundle,
    modelError,
    gatewayError,
    signature,
    chat,
  } = options;

  const checks: VerificationCheck[] = [];
  const modelAttestations = report.model_attestations ?? [];
  const gateway = report.gateway_attestation;

  checks.push(
    check(
      "model.tee",
      "TEE-hosted model selected from /v1/models",
      "pass",
      "model",
      `${modelInfo.id} · owner ${modelInfo.owned_by ?? "unknown"} · listed by NEAR AI Cloud`,
    ),
  );

  checks.push(
    check(
      "attestation.report",
      "Fresh attestation report retrieved",
      modelAttestations.length > 0 && Boolean(gateway) ? "pass" : "fail",
      "attestation",
      `${modelAttestations.length} model TEE node(s) and ${
        gateway ? "1 gateway TEE" : "no gateway TEE"
      } returned for this request`,
    ),
  );

  const modelNonceOk =
    allModelNoncesEcho(modelAttestations, nonce) ||
    Boolean(modelBundle?.reportData.embedsNonce);
  const gatewayNonceOk =
    nonceEcho(gateway, nonce) ||
    Boolean(gatewayBundle?.reportData.embedsNonce);

  checks.push(
    check(
      "attestation.nonce.model",
      "Model attestation echoes the fresh nonce",
      modelNonceOk ? "pass" : "fail",
      "attestation",
      modelNonceOk
        ? "The nonce is bound into the model TEE's attestation report data"
        : "The model attestation did not echo the nonce",
    ),
  );

  checks.push(
    check(
      "attestation.nonce.gateway",
      "Gateway attestation echoes the fresh nonce",
      gatewayNonceOk ? "pass" : "fail",
      "attestation",
      gatewayNonceOk
        ? "The nonce is bound into the gateway TEE's attestation report data"
        : "The gateway attestation did not echo the nonce",
    ),
  );

  if (modelError) {
    verifierFailure(
      checks,
      "tdx.model",
      "Model Intel TDX quote verified",
      "tdx",
      modelError,
    );
  } else if (modelBundle) {
    checks.push(
      check(
        "tdx.model",
        "Model Intel TDX quote verified",
        modelBundle.tdx.verified ? "pass" : "fail",
        "tdx",
        `dcap-qvl status: ${modelBundle.tdx.status ?? (modelBundle.tdx.verified ? "verified" : "unverified")}${
          modelBundle.tdx.message ? ` · ${modelBundle.tdx.message}` : ""
        }`,
      ),
    );
    checks.push(
      check(
        "tdx.model.address",
        "TDX report data binds the model signing address",
        modelBundle.reportData.bindsAddress ? "pass" : "fail",
        "tdx",
        `expected ${modelBundle.reportData.expectedAddressHex.slice(0, 24)}… · found ${modelBundle.reportData.actualFirst32.slice(0, 24)}…`,
      ),
    );
    checks.push(
      check(
        "tdx.model.nonce",
        "TDX report data embeds the request nonce",
        modelBundle.reportData.embedsNonce ? "pass" : "fail",
        "tdx",
        `nonce ${nonce.slice(0, 16)}…`,
      ),
    );
    checks.push(
      check(
        "gpu.nras",
        "NVIDIA NRAS accepts the GPU evidence",
        modelBundle.gpu.overallResult && modelBundle.gpu.overallNonceMatches
          ? "pass"
          : "fail",
        "gpu",
        `overall verdict ${modelBundle.gpu.overallResult ? "true" : "false"} · NVIDIA eat_nonce ${
          modelBundle.gpu.overallNonceMatches ? "matches" : "does not match"
        }`,
      ),
    );
    checks.push(
      check(
        "gpu.payload",
        "GPU evidence payload carries the same nonce",
        modelBundle.gpu.payloadNonceMatches ? "pass" : "fail",
        "gpu",
        modelBundle.gpu.payloadNonceMatches
          ? "Payload nonce matches the attestation request nonce"
          : "Payload nonce differs from the request nonce",
      ),
    );

    const gpuPassed =
      modelBundle.gpu.gpus.length > 0 &&
      modelBundle.gpu.gpus.every(
        (gpu) =>
          gpu.verifiedFlagsOk &&
          gpu.secureBoot === true &&
          gpu.debugStatus === "disabled" &&
          gpu.measurementResult === "success" &&
          gpu.nonceMatch !== false &&
          !gpu.expired &&
          gpu.warning === null,
      );

    checks.push(
      check(
        "gpu.perGpu",
        "Per-GPU secure boot, debug state, and measurements",
        gpuPassed ? "pass" : "fail",
        "gpu",
        modelBundle.gpu.gpus.length > 0
          ? modelBundle.gpu.gpus
              .map(
                (gpu) =>
                  `${gpu.key}: ${gpu.hwmodel ?? "GPU"} · secboot=${String(
                    gpu.secureBoot,
                  )} · debug=${gpu.debugStatus ?? "?"} · measres=${
                    gpu.measurementResult ?? "?"
                  }`,
              )
              .join(" | ")
          : "NRAS returned no per-GPU claims",
      ),
    );

    if (modelBundle.compose.available) {
      checks.push(
        check(
          "compose.model",
          "Attested compose manifest matches mr_config",
          modelBundle.compose.matches ? "pass" : "fail",
          "tdx",
          modelBundle.compose.matches
            ? `compose SHA-256 ${modelBundle.compose.composeHash?.slice(0, 16)}… matches the verified TDX quote`
            : "The compose manifest hash does not match mr_config",
        ),
      );
    } else {
      checks.push(
        check(
          "compose.model",
          "Attested compose manifest matches mr_config",
          "skip",
          "tdx",
          "This attestation did not include an app_compose manifest",
        ),
      );
    }
  }

  if (gatewayError) {
    verifierFailure(
      checks,
      "tdx.gateway",
      "Gateway Intel TDX quote verified",
      "tdx",
      gatewayError,
    );
  } else if (gatewayBundle) {
    checks.push(
      check(
        "tdx.gateway",
        "Gateway Intel TDX quote verified",
        gatewayBundle.tdx.verified ? "pass" : "fail",
        "tdx",
        `dcap-qvl status: ${gatewayBundle.tdx.status ?? (gatewayBundle.tdx.verified ? "verified" : "unverified")}`,
      ),
    );
    checks.push(
      check(
        "tdx.gateway.address",
        "Gateway TDX report data binds its signing address",
        gatewayBundle.reportData.bindsAddress ? "pass" : "fail",
        "tdx",
        `expected ${gatewayBundle.reportData.expectedAddressHex.slice(0, 24)}…`,
      ),
    );
    checks.push(
      check(
        "tdx.gateway.nonce",
        "Gateway TDX report data embeds the request nonce",
        gatewayBundle.reportData.embedsNonce ? "pass" : "fail",
        "tdx",
        `nonce ${nonce.slice(0, 16)}…`,
      ),
    );

    if (gatewayBundle.compose.available) {
      checks.push(
        check(
          "compose.gateway",
          "Gateway compose manifest matches mr_config",
          gatewayBundle.compose.matches ? "pass" : "fail",
          "tdx",
          gatewayBundle.compose.matches
            ? `compose SHA-256 ${gatewayBundle.compose.composeHash?.slice(0, 16)}… matches the verified TDX quote`
            : "The gateway compose manifest hash does not match mr_config",
        ),
      );
    }
  }

  checks.push(
    check(
      "signature.kind",
      "Signature claim matches its signed payload",
      chat.claimMatchesPayload ? "pass" : "fail",
      "signature",
      chat.kind === "provider_tee"
        ? "Signed inside the model TEE over model id + request hash + response hash"
        : "Signed inside the gateway TEE over request hash + response hash",
    ),
  );

  checks.push(
    check(
      "signature.hashes",
      "Request and response SHA-256 hashes match the signature",
      chat.hashValidation.valid ? "pass" : "fail",
      "signature",
      chat.hashValidation.valid
        ? `request ${chat.requestHash.slice(0, 16)}… · response ${chat.responseHash.slice(0, 16)}…`
        : chat.hashValidation.error ?? "The signed hashes do not match the bytes exchanged",
    ),
  );

  if (chat.kind === "provider_tee") {
    checks.push(
      check(
        "signature.model",
        "Signature commits to the requested model id",
        chat.hashValidation.modelIdMatch ? "pass" : "fail",
        "signature",
        `signed model: ${chat.hashValidation.signedModelId ?? "none"}`,
      ),
    );
  }

  checks.push(
    check(
      "signature.signer",
      "Response signer recovers to the attested TEE address",
      chat.signatureValidation.valid ? "pass" : "fail",
      "signature",
      chat.signatureValidation.valid
        ? `${chat.signatureValidation.recoveredAddress ?? "unknown"} matches the ${
            chat.kind === "provider_tee" ? "model" : "gateway"
          } TEE attestation`
        : chat.signatureValidation.error ??
            `Recovered ${chat.signatureValidation.recoveredAddress ?? "nothing"}; expected ${chat.signatureValidation.expectedAddresses.join(", ") || "an attested address"}`,
    ),
  );

  checks.push(
    check(
      "signature.api",
      "API-reported signer matches the recovered signer",
      signature.signing_address?.toLowerCase() ===
        chat.signatureValidation.recoveredAddress?.toLowerCase()
        ? "pass"
        : "fail",
      "signature",
      `API: ${signature.signing_address ?? "none"}`,
    ),
  );

  checks.push(
    check(
      "data.key",
      "API key stays on the server",
      "pass",
      "data",
      "The NEAR AI Cloud key is read from .env.local in the route handler and never sent to the browser",
    ),
  );

  checks.push(
    check(
      "data.retention",
      "Zero server-side retention",
      "pass",
      "data",
      "Uploads are held in memory for this request only. No database, no disk writes, no content logs, no cache.",
    ),
  );

  return checks;
}

export async function runAuditPipeline(options: {
  files: UploadedFile[];
  onProgress?: (event: ProgressEvent) => void;
}): Promise<PipelineResult> {
  const startedAt = Date.now();
  const { files, onProgress } = options;

  emit(onProgress, {
    step: "ingest",
    status: "active",
    detail: "Parsing files in memory",
  });

  const { statement, images, warnings } = prepareInput(files);

  emit(onProgress, {
    step: "ingest",
    status: "done",
    detail: `${statement?.rows.length ?? 0} statement row(s), ${images.length} receipt image(s)`,
  });

  const modelId = selectedModel();

  emit(onProgress, {
    step: "model",
    status: "active",
    detail: `Confirming ${modelId} is TEE-hosted`,
  });

  const modelInfo = await assertTeeHostedModel(modelId);

  emit(onProgress, {
    step: "model",
    status: "done",
    detail: `${modelInfo.id} · owner ${modelInfo.owned_by}`,
  });

  const nonce = randomBytes(32).toString("hex");

  emit(onProgress, {
    step: "attestation",
    status: "active",
    detail: "Requesting a fresh 256-bit nonce attestation",
  });

  const report = await fetchAttestationReport(modelId, nonce);
  const attestedAt = new Date().toISOString();

  const modelAttestations = report.model_attestations ?? [];
  if (modelAttestations.length === 0) {
    throw new Error(
      "The attestation response contained no model TEE. The selected model may not be TEE-hosted.",
    );
  }
  if (!report.gateway_attestation) {
    throw new Error("The attestation response contained no gateway TEE.");
  }

  emit(onProgress, {
    step: "attestation",
    status: "done",
    detail: `${modelAttestations.length} model TEE node(s) + gateway TEE`,
  });

  let parsed: RawModelAudit | undefined;
  let finalRequest: string | undefined;
  let finalSignature: ChatSignature | undefined;
  let chatVerification: ReturnType<typeof verifyChatSignature> | undefined;
  let repairNote: string | undefined;
  let jsonMode = true;
  let disableThinking = true;

  const modelAddresses = modelAttestations
    .map((attestation) => attestation.signing_address)
    .filter(Boolean);
  const gatewayAddresses = report.gateway_attestation.signing_address
    ? [report.gateway_attestation.signing_address]
    : [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    emit(onProgress, {
      step: "analysis",
      status: "active",
      detail:
        attempt === 1
          ? "Sending receipts and statement into the TEE"
          : "Retrying with a JSON correction note",
    });

    let requestBody = buildAuditRequestBody({
      model: modelId,
      input: { statement, images, repairNote },
      jsonMode,
      disableThinking,
    }).requestBody;

    let chat: Awaited<ReturnType<typeof sendChatCompletion>>;
    try {
      chat = await sendChatCompletion(requestBody);
    } catch (error) {
      // Some OpenAI-compatible gateways reject response_format or
      // chat_template_kwargs even though the model supports JSON. Retry once
      // without those fields; the prompt still demands a JSON object.
      if (
        error instanceof NearAiError &&
        (error.status === 400 || error.status === 422) &&
        (jsonMode || disableThinking)
      ) {
        jsonMode = false;
        disableThinking = false;
        requestBody = buildAuditRequestBody({
          model: modelId,
          input: { statement, images, repairNote },
          jsonMode,
          disableThinking,
        }).requestBody;
        chat = await sendChatCompletion(requestBody);
      } else {
        throw error;
      }
    }

    emit(onProgress, {
      step: "signature",
      status: "active",
      detail: "Fetching the TEE signature for this completion",
    });

    const signature = await fetchChatSignature(chat.chatId, modelId);
    const verification = verifyChatSignature({
      signature,
      requestBody,
      responseText: chat.responseText,
      modelId,
      modelAddresses,
      gatewayAddresses,
    });

    if (!verification.valid) {
      throw new Error(
        "The TEE response signature did not verify. The result was discarded.",
      );
    }

    emit(onProgress, {
      step: "signature",
      status: "done",
      detail: `${verification.kind === "provider_tee" ? "Model" : "Gateway"} TEE signature verified`,
    });

    try {
      parsed = parseModelAudit(extractCompletionContent(chat.responseText));
      finalRequest = requestBody;
      finalSignature = signature;
      chatVerification = verification;
      break;
    } catch (error) {
      if (attempt === 2) {
        throw new Error(
          `The TEE model did not return a valid audit after two attempts. ${safeMessage(error)}`,
        );
      }
      repairNote = safeMessage(error);
    }
  }

  if (!parsed || !finalRequest || !finalSignature || !chatVerification) {
    throw new Error("The private audit did not produce a verifiable result.");
  }

  emit(onProgress, {
    step: "analysis",
    status: "done",
    detail: "Model response parsed and signature verified",
  });

  emit(onProgress, {
    step: "hardware",
    status: "active",
    detail: "Verifying Intel TDX quotes and NVIDIA GPU evidence",
  });

  const signer = chatVerification.signatureValidation.recoveredAddress;
  const selectedAttestation = signer
    ? pickAttestationForSigner(report, signer, chatVerification.kind)
    : chatVerification.kind === "gateway"
      ? report.gateway_attestation
      : null;

  let modelBundle: ModelVerificationBundle | undefined;
  let gatewayBundle: GatewayVerificationBundle | undefined;
  let modelError: unknown;
  let gatewayError: unknown;

  const modelAttestationToVerify =
    chatVerification.kind === "provider_tee"
      ? selectedAttestation
      : modelAttestations[0];

  const [modelResult, gatewayResult] = await Promise.allSettled([
    modelAttestationToVerify
      ? verifyModelAttestation(modelAttestationToVerify, nonce)
      : Promise.reject(new Error("No model attestation matched the response signer")),
    report.gateway_attestation
      ? verifyGatewayAttestation(report.gateway_attestation, nonce)
      : Promise.reject(new Error("No gateway attestation was returned")),
  ]);

  if (modelResult.status === "fulfilled") {
    modelBundle = modelResult.value;
  } else {
    modelError = modelResult.reason;
  }

  if (gatewayResult.status === "fulfilled") {
    gatewayBundle = gatewayResult.value;
  } else {
    gatewayError = gatewayResult.reason;
  }

  emit(onProgress, {
    step: "hardware",
    status: modelBundle || gatewayBundle ? "done" : "error",
    detail:
      modelError && gatewayError
        ? "Hardware verification failed"
        : "Hardware evidence checked",
  });

  const checks = buildChecks({
    modelInfo,
    report,
    nonce,
    modelBundle,
    gatewayBundle,
    modelError,
    gatewayError,
    signature: finalSignature,
    chat: chatVerification,
  });

  const analysis = mergeAnalysis({
    statement,
    images,
    model: parsed,
  });

  const verified = checks.every((entry) => entry.status !== "fail");
  const totalMs = Date.now() - startedAt;

  const verification: VerificationReport = {
    verified,
    checks,
    model: {
      id: modelInfo.id,
      name: modelInfo.name,
      owner: modelInfo.owned_by,
    },
    nonce,
    attestedAt,
    signingAddress: signer,
    signatureKind: chatVerification.kind,
    hashes: {
      request: chatVerification.requestHash,
      response: chatVerification.responseHash,
    },
    signature: {
      recovered: chatVerification.signatureValidation.recoveredAddress,
      expected: chatVerification.expectedAddress,
      signedText: finalSignature.text,
    },
    attestation: {
      modelNodes: modelAttestations.length,
      gatewayAddress: report.gateway_attestation.signing_address ?? null,
      tdxStatus: modelBundle?.tdx.status ?? null,
      gpuCount: modelBundle?.gpu.gpus.length ?? 0,
      gpuModels: modelBundle?.gpu.gpus
        .map((gpu) => gpu.hwmodel)
        .filter((value): value is string => Boolean(value)) ?? [],
      composeVerified: modelBundle?.compose.matches ?? null,
    },
    timing: {
      totalMs,
      verifiedAt: new Date().toISOString(),
    },
    retention: "none",
  };

  return { analysis, verification, warnings };
}
