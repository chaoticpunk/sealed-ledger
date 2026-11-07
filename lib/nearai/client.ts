import type {
  AttestationReport,
  ChatSignature,
  ModelInfo,
} from "./types";

export const NEARAI_BASE_URL =
  process.env.NEARAI_CLOUD_BASE_URL?.replace(/\/+$/, "") ||
  "https://cloud-api.near.ai";

export const NVIDIA_NRAS_URL =
  "https://nras.attestation.nvidia.com/v3/attest/gpu";

export const DEFAULT_MODEL = "Qwen/Qwen3.8-27B";

export class NearAiError extends Error {
  status?: number;
  code: string;

  constructor(message: string, options: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "NearAiError";
    this.status = options.status;
    this.code = options.code ?? "nearai_error";
  }
}

function apiKey(): string {
  const key = process.env.NEARAI_CLOUD_API_KEY?.trim();
  if (!key) {
    throw new NearAiError(
      "NEARAI_CLOUD_API_KEY is not configured on the server",
      { code: "missing_api_key", status: 503 },
    );
  }
  return key;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEARAI_CLOUD_API_KEY?.trim());
}

export function selectedModel(): string {
  return process.env.NEARAI_MODEL?.trim() || DEFAULT_MODEL;
}

async function readError(response: Response, context: string): Promise<NearAiError> {
  let detail = "";
  try {
    const text = await response.text();
    detail = text.slice(0, 240);
  } catch {
    // The response body is optional.
  }
  return new NearAiError(
    `${context} (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
    { status: response.status, code: "upstream_error" },
  );
}

/** The models endpoint is public: it is safe to call before a key exists. */
export async function fetchModels(): Promise<ModelInfo[]> {
  const response = await fetch(`${NEARAI_BASE_URL}/v1/models`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await readError(response, "Could not list NEAR AI Cloud models");
  }

  const body = (await response.json()) as { data?: ModelInfo[] };
  return body.data ?? [];
}

/** TEE-hosted models are owned and served by `nearai` on NEAR AI Cloud. */
export function isTeeHosted(model: ModelInfo): boolean {
  return model.owned_by?.toLowerCase() === "nearai";
}

export async function assertTeeHostedModel(modelId: string): Promise<ModelInfo> {
  const models = await fetchModels();
  const model = models.find((candidate) => candidate.id === modelId);

  if (!model) {
    throw new NearAiError(
      `Model ${modelId} is not listed by NEAR AI Cloud. Pick one from /v1/models.`,
      { code: "model_not_found", status: 400 },
    );
  }

  if (!isTeeHosted(model)) {
    throw new NearAiError(
      `Model ${modelId} is listed with owner "${model.owned_by ?? "unknown"}"; it is not a NEAR AI-hosted TEE model.`,
      { code: "model_not_tee", status: 400 },
    );
  }

  return model;
}

export async function fetchAttestationReport(
  modelId: string,
  nonce: string,
): Promise<AttestationReport> {
  const params = new URLSearchParams({
    model: modelId,
    signing_algo: "ecdsa",
    nonce,
  });

  const response = await fetch(
    `${NEARAI_BASE_URL}/v1/attestation/report?${params.toString()}`,
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey()}`,
      },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await readError(response, "Could not fetch the TEE attestation report");
  }

  return (await response.json()) as AttestationReport;
}

function extractChatId(responseText: string): string | null {
  try {
    const trimmed = responseText.trimStart();
    if (trimmed.startsWith("{")) {
      const body = JSON.parse(trimmed) as { id?: string };
      return body.id ?? null;
    }

    const firstDataLine = responseText
      .split("\n")
      .find((line) => line.startsWith("data: {"));
    if (firstDataLine) {
      const body = JSON.parse(firstDataLine.slice(6)) as { id?: string };
      return body.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Send the exact request-body string that will be hashed by the TEE.
 * Returns the exact response-body string that must be hashed too.
 */
export async function sendChatCompletion(requestBody: string): Promise<{
  responseText: string;
  chatId: string;
  response: Response;
}> {
  const response = await fetch(`${NEARAI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey()}`,
    },
    body: requestBody,
    signal: AbortSignal.timeout(180_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await readError(response, "The TEE model request failed");
  }

  const responseText = await response.text();
  const chatId = extractChatId(responseText);

  if (!chatId) {
    throw new NearAiError(
      "The completion response did not contain a chat id, so its TEE signature cannot be verified",
      { code: "missing_chat_id", status: 502 },
    );
  }

  return { responseText, chatId, response };
}

/**
 * A model can be served by several TEE nodes. The signature is cached on the
 * node that served the completion, so a lookup can briefly 404 while another
 * node answers. Retry before giving up.
 */
export async function fetchChatSignature(
  chatId: string,
  modelId: string,
  options: { retries?: number; delayMs?: number } = {},
): Promise<ChatSignature> {
  const { retries = 8, delayMs = 900 } = options;
  const params = new URLSearchParams({
    model: modelId,
    signing_algo: "ecdsa",
  });
  const url = `${NEARAI_BASE_URL}/v1/signature/${encodeURIComponent(chatId)}?${params.toString()}`;

  let lastError: NearAiError | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey()}`,
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });

    if (response.ok) {
      return (await response.json()) as ChatSignature;
    }

    lastError = await readError(response, "Could not fetch the response signature");
    if (response.status !== 404 || attempt === retries) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw (
    lastError ??
    new NearAiError("Could not fetch the response signature", {
      code: "signature_unavailable",
    })
  );
}

/** Verify GPU evidence with NVIDIA's Remote Attestation Service. */
export async function verifyGpuWithNras(
  payload: string | Record<string, unknown>,
): Promise<unknown> {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);

  const response = await fetch(NVIDIA_NRAS_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await readError(response, "NVIDIA NRAS rejected the GPU evidence");
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
