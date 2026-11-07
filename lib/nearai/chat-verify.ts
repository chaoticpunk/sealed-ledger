import { createHash } from "crypto";
import { verifyMessage } from "ethers";

import type { ChatSignature } from "./types";

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export type SignatureKind = "provider_tee" | "gateway";

export function resolveSignatureKind(signature: ChatSignature): SignatureKind {
  if (
    signature.signature_kind === "provider_tee" ||
    signature.signature_kind === "gateway"
  ) {
    return signature.signature_kind;
  }

  return signature.text.split(":").length === 3
    ? "provider_tee"
    : "gateway";
}

export interface HashValidation {
  valid: boolean;
  hasModelId: boolean;
  signedModelId: string | null;
  signedRequestHash: string;
  signedResponseHash: string;
  requestHashMatch: boolean;
  responseHashMatch: boolean;
  modelIdMatch: boolean | null;
  expectedModelId: string | null;
  error?: string;
}

export function compareHashes(
  signatureText: string,
  expectedRequestHash: string,
  expectedResponseHash: string,
  expectedModelId: string,
): HashValidation {
  const parts = signatureText.split(":");
  const base = {
    valid: false,
    hasModelId: false,
    signedModelId: null as string | null,
    signedRequestHash: "",
    signedResponseHash: "",
    requestHashMatch: false,
    responseHashMatch: false,
    modelIdMatch: null as boolean | null,
    expectedModelId,
  };

  if (parts.length !== 2 && parts.length !== 3) {
    return {
      ...base,
      error: `Expected 2 or 3 colon-separated fields in the signed text, received ${parts.length}`,
    };
  }

  const hasModelId = parts.length === 3;
  const signedModelId = hasModelId ? parts[0] : null;
  const signedRequestHash = parts[hasModelId ? 1 : 0];
  const signedResponseHash = parts[hasModelId ? 2 : 1];

  const requestHashMatch = signedRequestHash === expectedRequestHash;
  const responseHashMatch = signedResponseHash === expectedResponseHash;
  const modelIdMatch = hasModelId ? signedModelId === expectedModelId : null;

  return {
    valid: requestHashMatch && responseHashMatch && modelIdMatch !== false,
    hasModelId,
    signedModelId,
    signedRequestHash,
    signedResponseHash,
    requestHashMatch,
    responseHashMatch,
    modelIdMatch,
    expectedModelId,
  };
}

export interface SignatureValidation {
  valid: boolean;
  recoveredAddress: string | null;
  expectedAddresses: string[];
  signatureKindMatches: boolean;
  error?: string;
}

export function verifySignature(
  message: string,
  signature: string,
  expectedAddresses: string[],
): SignatureValidation {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    const valid = expectedAddresses.some(
      (address) =>
        recoveredAddress.toLowerCase() === address.toLowerCase(),
    );

    return {
      valid,
      recoveredAddress,
      expectedAddresses,
      signatureKindMatches: true,
    };
  } catch (error) {
    return {
      valid: false,
      recoveredAddress: null,
      expectedAddresses,
      signatureKindMatches: true,
      error: error instanceof Error ? error.message : "Signature recovery failed",
    };
  }
}

export interface ChatVerification {
  kind: SignatureKind;
  claimMatchesPayload: boolean;
  requestHash: string;
  responseHash: string;
  hashValidation: HashValidation;
  signatureValidation: SignatureValidation;
  expectedAddress: string | null;
  valid: boolean;
  error?: string;
}

export function verifyChatSignature(options: {
  signature: ChatSignature;
  requestBody: string;
  responseText: string;
  modelId: string;
  modelAddresses: string[];
  gatewayAddresses: string[];
}): ChatVerification {
  const {
    signature,
    requestBody,
    responseText,
    modelId,
    modelAddresses,
    gatewayAddresses,
  } = options;

  const kind = resolveSignatureKind(signature);
  const payloadParts = signature.text.split(":").length;
  const claimMatchesPayload =
    payloadParts === (kind === "provider_tee" ? 3 : 2);

  const requestHash = sha256Hex(requestBody);
  const responseHash = sha256Hex(responseText);
  const hashValidation = compareHashes(
    signature.text,
    requestHash,
    responseHash,
    modelId,
  );

  if (
    kind === "provider_tee" &&
    hashValidation.valid &&
    hashValidation.modelIdMatch !== true
  ) {
    hashValidation.valid = false;
    hashValidation.error =
      "A model-TEE signature must commit to the requested model id";
  }

  const expectedAddresses =
    kind === "gateway" ? gatewayAddresses : modelAddresses;
  const signatureValidation = verifySignature(
    signature.text,
    signature.signature,
    expectedAddresses,
  );

  const expectedAddress = signatureValidation.recoveredAddress
    ? expectedAddresses.find(
        (address) =>
          address.toLowerCase() ===
          signatureValidation.recoveredAddress?.toLowerCase(),
      ) ?? null
    : null;

  const signerReturnedByApi =
    signature.signing_address?.toLowerCase() ===
    signatureValidation.recoveredAddress?.toLowerCase();

  const valid =
    claimMatchesPayload &&
    hashValidation.valid &&
    signatureValidation.valid &&
    signerReturnedByApi;

  return {
    kind,
    claimMatchesPayload,
    requestHash,
    responseHash,
    hashValidation,
    signatureValidation,
    expectedAddress,
    valid,
    error: hashValidation.error ?? signatureValidation.error,
  };
}
