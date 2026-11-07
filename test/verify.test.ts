import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { checkReportData, verifyCompose } from "@/lib/nearai/verify";
import type { AttestationInfo, TdxVerification } from "@/lib/nearai/types";

const addressHex = "ab".repeat(20);
const nonce = "cd".repeat(32);

function attestation(overrides: Partial<AttestationInfo> = {}): AttestationInfo {
  return {
    signing_address: `0x${addressHex}`,
    signing_algo: "ecdsa",
    intel_quote: "00",
    ...overrides,
  };
}

function tdx(reportDataHex: string, mrConfig = ""): TdxVerification {
  return {
    verified: true,
    status: "UpToDate",
    reportDataHex,
    mrConfig,
  };
}

describe("checkReportData", () => {
  it("accepts report data that binds the address and nonce", () => {
    const result = checkReportData(
      attestation(),
      nonce,
      tdx(`${addressHex}${"0".repeat(24)}${nonce}`),
    );

    expect(result.bindsAddress).toBe(true);
    expect(result.embedsNonce).toBe(true);
  });

  it("rejects a mismatched address or nonce", () => {
    const wrongAddress = checkReportData(
      attestation(),
      nonce,
      tdx(`${"0".repeat(64)}${nonce}`),
    );
    expect(wrongAddress.bindsAddress).toBe(false);

    const wrongNonce = checkReportData(
      attestation(),
      "ef".repeat(32),
      tdx(`${addressHex}${"0".repeat(24)}${nonce}`),
    );
    expect(wrongNonce.embedsNonce).toBe(false);
  });

  it("hashes the address + TLS fingerprint when the report includes one", () => {
    const fingerprint = "12".repeat(32);
    const expected = createHash("sha256")
      .update(Buffer.from(addressHex, "hex"))
      .update(Buffer.from(fingerprint, "hex"))
      .digest("hex");

    const result = checkReportData(
      attestation({ tls_cert_fingerprint: fingerprint }),
      nonce,
      tdx(`${expected}${nonce}`),
    );

    expect(result.bindsAddress).toBe(true);
    expect(result.embedsNonce).toBe(true);
  });
});

describe("verifyCompose", () => {
  const appCompose = JSON.stringify({
    docker_compose_file: "services:\n  api:\n    image: example@sha256:abc",
  });
  const composeHash = createHash("sha256").update(appCompose).digest("hex");

  it("matches the attested compose manifest against mr_config", () => {
    const result = verifyCompose(
      attestation({
        info: {
          tcb_info: JSON.stringify({ app_compose: appCompose }),
        },
      }),
      tdx("", `01${composeHash}`),
    );

    expect(result.available).toBe(true);
    expect(result.matches).toBe(true);
    expect(result.composeHash).toBe(composeHash);
  });

  it("reports a mismatch when mr_config points elsewhere", () => {
    const result = verifyCompose(
      attestation({
        info: {
          tcb_info: JSON.stringify({ app_compose: appCompose }),
        },
      }),
      tdx("", `01${"0".repeat(64)}`),
    );

    expect(result.available).toBe(true);
    expect(result.matches).toBe(false);
  });

  it("skips when no compose manifest is present", () => {
    const result = verifyCompose(attestation(), tdx("", ""));
    expect(result.available).toBe(false);
    expect(result.matches).toBeNull();
  });
});
