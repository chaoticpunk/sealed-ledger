import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";

import {
  compareHashes,
  resolveSignatureKind,
  sha256Hex,
  verifyChatSignature,
} from "@/lib/nearai/chat-verify";
import type { ChatSignature } from "@/lib/nearai/types";

const modelId = "Qwen/Qwen3.8-27B";
const requestBody = '{"model":"Qwen/Qwen3.8-27B","stream":false}';
const responseText = '{"id":"chat_123","choices":[]}';
const requestHash = sha256Hex(requestBody);
const responseHash = sha256Hex(responseText);

describe("compareHashes", () => {
  it("accepts a three-part model-TEE payload", () => {
    const result = compareHashes(
      `${modelId}:${requestHash}:${responseHash}`,
      requestHash,
      responseHash,
      modelId,
    );

    expect(result.valid).toBe(true);
    expect(result.modelIdMatch).toBe(true);
  });

  it("accepts a two-part gateway payload", () => {
    const result = compareHashes(
      `${requestHash}:${responseHash}`,
      requestHash,
      responseHash,
      modelId,
    );

    expect(result.valid).toBe(true);
    expect(result.modelIdMatch).toBeNull();
  });

  it("rejects a wrong response hash", () => {
    const result = compareHashes(
      `${modelId}:${requestHash}:${"0".repeat(64)}`,
      requestHash,
      responseHash,
      modelId,
    );

    expect(result.valid).toBe(false);
    expect(result.responseHashMatch).toBe(false);
  });
});

describe("resolveSignatureKind", () => {
  it("prefers the explicit kind and falls back to the payload shape", () => {
    const base = {
      signature: "0x",
      signing_address: "0x0",
      signing_algo: "ecdsa",
    };

    expect(
      resolveSignatureKind({
        ...base,
        text: `${modelId}:${requestHash}:${responseHash}`,
        signature_kind: "provider_tee",
      }),
    ).toBe("provider_tee");

    expect(
      resolveSignatureKind({
        ...base,
        text: `${requestHash}:${responseHash}`,
      }),
    ).toBe("gateway");
  });
});

describe("verifyChatSignature", () => {
  it("recovers a model-TEE signer over the exact bytes", async () => {
    const wallet = Wallet.createRandom();
    const text = `${modelId}:${requestHash}:${responseHash}`;
    const signature = await wallet.signMessage(text);

    const chat = verifyChatSignature({
      signature: {
        text,
        signature,
        signing_address: wallet.address,
        signing_algo: "ecdsa",
        signature_kind: "provider_tee",
      },
      requestBody,
      responseText,
      modelId,
      modelAddresses: [wallet.address],
      gatewayAddresses: [],
    });

    expect(chat.valid).toBe(true);
    expect(chat.kind).toBe("provider_tee");
    expect(chat.signatureValidation.recoveredAddress).toBe(wallet.address);
  });

  it("recovers a gateway signer over a two-part payload", async () => {
    const wallet = Wallet.createRandom();
    const text = `${requestHash}:${responseHash}`;
    const signature = await wallet.signMessage(text);

    const chat = verifyChatSignature({
      signature: {
        text,
        signature,
        signing_address: wallet.address,
        signing_algo: "ecdsa",
        signature_kind: "gateway",
      },
      requestBody,
      responseText,
      modelId,
      modelAddresses: [],
      gatewayAddresses: [wallet.address],
    });

    expect(chat.valid).toBe(true);
    expect(chat.kind).toBe("gateway");
  });

  it("rejects a signer that is not in the attested set", async () => {
    const wallet = Wallet.createRandom();
    const other = Wallet.createRandom();
    const text = `${modelId}:${requestHash}:${responseHash}`;
    const signature = await wallet.signMessage(text);

    const chat = verifyChatSignature({
      signature: {
        text,
        signature,
        signing_address: wallet.address,
        signing_algo: "ecdsa",
      } satisfies ChatSignature,
      requestBody,
      responseText,
      modelId,
      modelAddresses: [other.address],
      gatewayAddresses: [],
    });

    expect(chat.valid).toBe(false);
    expect(chat.signatureValidation.valid).toBe(false);
  });
});
