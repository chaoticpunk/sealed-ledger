/**
 * Minimal NEAR AI Cloud verification walkthrough.
 *
 * Required by the Privacy & Private AI track: send one completion, verify the
 * attestation, and show the output before the UI exists.
 *
 *   npm run verify:minimal
 *
 * Everything here is also used by the app's /api/audit route.
 */
import { randomBytes } from "crypto";

import {
  assertTeeHostedModel,
  fetchAttestationReport,
  fetchChatSignature,
  isConfigured,
  selectedModel,
  sendChatCompletion,
} from "../lib/nearai/client";
import { verifyChatSignature } from "../lib/nearai/chat-verify";
import {
  pickAttestationForSigner,
  verifyGatewayAttestation,
  verifyModelAttestation,
} from "../lib/nearai/verify";
import type { AttestationInfo } from "../lib/nearai/types";

const ok = (value: boolean) => (value ? "✅" : "❌");
const results: Array<{ label: string; pass: boolean; detail?: string }> = [];

function record(label: string, pass: boolean, detail?: string): boolean {
  results.push({ label, pass, detail });
  console.log(`   ${ok(pass)} ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

function line(label: string, value: string): void {
  console.log(`   ${label.padEnd(24)} ${value}`);
}

async function main(): Promise<void> {
  console.log("\n🔐 Sealed Ledger · minimal NEAR AI Cloud verification\n");

  if (!isConfigured()) {
    console.error(
      "❌ NEARAI_CLOUD_API_KEY is missing.\n" +
        "   Add it to .env.local, then run: npm run verify:minimal\n" +
        "   Get a key at https://cloud.near.ai (Credits → API Keys).\n",
    );
    process.exit(1);
  }

  const modelId = selectedModel();
  line("Model", modelId);

  // 1. The model must be listed and TEE-hosted.
  console.log("\n1) Model policy");
  const model = await assertTeeHostedModel(modelId);
  record(
    "Model is listed by /v1/models",
    true,
    `${model.id} · owner ${model.owned_by ?? "unknown"}`,
  );
  record(
    "Model is TEE-hosted",
    model.owned_by?.toLowerCase() === "nearai",
    "owned by nearai",
  );

  // 2. Fresh nonce → attestation report.
  console.log("\n2) Fresh attestation");
  const nonce = randomBytes(32).toString("hex");
  line("Request nonce", nonce);

  const report = await fetchAttestationReport(modelId, nonce);
  const modelAttestations = report.model_attestations ?? [];
  const gateway = report.gateway_attestation;

  record(
    "Model TEE attestation returned",
    modelAttestations.length > 0,
    `${modelAttestations.length} node(s)`,
  );
  record("Gateway TEE attestation returned", Boolean(gateway));

  if (modelAttestations.length === 0 || !gateway) {
    throw new Error("The attestation report is missing a model or gateway TEE");
  }

  for (const [index, attestation] of modelAttestations.entries()) {
    record(
      `Model node ${index + 1} echoes the nonce`,
      attestation.request_nonce?.toLowerCase() === nonce.toLowerCase(),
      attestation.request_nonce ? "request_nonce matches" : "no request_nonce",
    );
  }
  record(
    "Gateway echoes the nonce",
    gateway.request_nonce?.toLowerCase() === nonce.toLowerCase(),
    gateway.request_nonce ? "request_nonce matches" : "no request_nonce",
  );

  line(
    "Model TEE address(es)",
    modelAttestations
      .map((attestation) => attestation.signing_address)
      .join(", "),
  );
  line("Gateway TEE address", gateway.signing_address);

  // 3. One completion, exactly as the app sends it.
  console.log("\n3) One TEE completion");
  const requestBody = JSON.stringify({
    model: modelId,
    messages: [
      { role: "user", content: "Respond with only two words." },
    ],
    stream: false,
    temperature: 0,
  });

  const chat = await sendChatCompletion(requestBody);
  const completion = JSON.parse(chat.responseText) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = completion.choices?.[0]?.message?.content ?? "";
  record("Completion returned", content.length > 0, JSON.stringify(content));
  line("Chat id", chat.chatId);

  // 4. Fetch and verify the signature over the exact bytes.
  console.log("\n4) Signature over exact request/response bytes");
  const signature = await fetchChatSignature(chat.chatId, modelId);
  const chatVerification = verifyChatSignature({
    signature,
    requestBody,
    responseText: chat.responseText,
    modelId,
    modelAddresses: modelAttestations.map(
      (attestation) => attestation.signing_address,
    ),
    gatewayAddresses: [gateway.signing_address],
  });

  line("Signature kind", chatVerification.kind);
  line("Request SHA-256", chatVerification.requestHash);
  line("Response SHA-256", chatVerification.responseHash);
  line(
    "Recovered signer",
    chatVerification.signatureValidation.recoveredAddress ?? "none",
  );

  record(
    "Signed payload shape matches the claimed kind",
    chatVerification.claimMatchesPayload,
  );
  record(
    "Signed request + response hashes match",
    chatVerification.hashValidation.valid,
    chatVerification.hashValidation.error,
  );
  record(
    "Signer recovers to an attested TEE address",
    chatVerification.signatureValidation.valid,
  );

  if (!chatVerification.valid) {
    throw new Error("Chat signature verification failed; refusing to continue");
  }

  // 5. Verify the hardware behind the signer.
  console.log("\n5) Hardware attestation");
  const signer = chatVerification.signatureValidation.recoveredAddress as string;
  const selectedAttestation = pickAttestationForSigner(
    report,
    signer,
    chatVerification.kind,
  );

  const modelAttestationToVerify: AttestationInfo =
    chatVerification.kind === "provider_tee"
      ? selectedAttestation ?? modelAttestations[0]
      : modelAttestations[0];

  const [modelBundle, gatewayBundle] = await Promise.all([
    verifyModelAttestation(modelAttestationToVerify, nonce),
    verifyGatewayAttestation(gateway, nonce),
  ]);

  record(
    "Intel TDX quote verified (model)",
    modelBundle.tdx.verified,
    `dcap-qvl status: ${modelBundle.tdx.status ?? "unknown"}`,
  );
  record(
    "TDX report data binds the signing address (model)",
    modelBundle.reportData.bindsAddress,
  );
  record(
    "TDX report data embeds the nonce (model)",
    modelBundle.reportData.embedsNonce,
  );
  record(
    "NVIDIA NRAS overall verdict (model)",
    modelBundle.gpu.overallResult,
  );
  record(
    "NVIDIA eat_nonce matches the request nonce",
    modelBundle.gpu.overallNonceMatches && modelBundle.gpu.payloadNonceMatches,
  );

  for (const gpu of modelBundle.gpu.gpus) {
    record(
      `${gpu.key}: secure boot / debug / measurements / nonce`,
      gpu.secureBoot === true &&
        gpu.debugStatus === "disabled" &&
        gpu.measurementResult === "success" &&
        gpu.nonceMatch !== false &&
        !gpu.expired &&
        gpu.warning === null,
      `${gpu.hwmodel ?? "GPU"} · driver ${gpu.driverVersion ?? "?"} · vbios ${
        gpu.vbiosVersion ?? "?"
      }`,
    );
  }

  record(
    "Intel TDX quote verified (gateway)",
    gatewayBundle.tdx.verified,
    `dcap-qvl status: ${gatewayBundle.tdx.status ?? "unknown"}`,
  );
  record(
    "TDX report data binds the gateway address",
    gatewayBundle.reportData.bindsAddress,
  );
  record(
    "TDX report data embeds the nonce (gateway)",
    gatewayBundle.reportData.embedsNonce,
  );

  if (modelBundle.compose.available) {
    record(
      "Model compose manifest matches mr_config",
      modelBundle.compose.matches === true,
    );
  } else {
    console.log("   ⚠️  No app_compose manifest in this attestation (skipped)");
  }

  // 6. Summary.
  console.log("\n6) Summary");
  const failed = results.filter((result) => !result.pass);
  for (const result of results) {
    console.log(`   ${ok(result.pass)} ${result.label}`);
  }

  if (failed.length === 0) {
    console.log(
      `\n✅ All ${results.length} checks passed. The completion ran inside a TEE and the exact bytes are signed by the attested address.\n`,
    );
  } else {
    console.log(
      `\n❌ ${failed.length} of ${results.length} checks failed. Do not trust this result.\n`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `\n❌ Verification failed: ${
      error instanceof Error ? error.message : "unknown error"
    }\n`,
  );
  process.exit(1);
});
