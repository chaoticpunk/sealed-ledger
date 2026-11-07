# Verification walkthrough

This document explains exactly what Sealed Ledger verifies, in the order the app verifies it, and what each check does and does not prove.

## API endpoints used

Base URL: `https://cloud-api.near.ai`

| Step | Request |
|---|---|
| Model policy | `GET /v1/models` |
| Attestation | `GET /v1/attestation/report?model={model}&signing_algo=ecdsa&nonce={nonce}` |
| Completion | `POST /v1/chat/completions` |
| Signature | `GET /v1/signature/{chat_id}?model={model}&signing_algo=ecdsa` |
| GPU | `POST https://nras.attestation.nvidia.com/v3/attest/gpu` |
| TDX collateral | `https://api.trustedservices.intel.com/tdx/certification/v4` (through dcap-qvl) |

Attestation retrieval requires the API key but is non-billable. `/v1/models` is public.

## 1. Fresh nonce

`lib/pipeline.ts` generates 32 random bytes:

```ts
const nonce = randomBytes(32).toString("hex"); // 64 hex chars
```

The nonce is sent with the attestation request and must reappear in:

- `gateway_attestation.request_nonce`
- each `model_attestations[].request_nonce`
- the NVIDIA `nvidia_payload.nonce`
- the NVIDIA JWT `eat_nonce`
- TDX `report_data[32..64]`

A fresh nonce per request prevents replay of old, valid attestations.

## 2. Model policy

The app calls `GET /v1/models` and requires:

- the model id exists;
- `owned_by.toLowerCase() === "nearai"`.

Third-party models proxied through the gateway may be listed but are not provably TEE-hosted. The default is `Qwen/Qwen3.8-27B`.

## 3. Intel TDX quote

`lib/nearai/verify.ts` calls `js_get_collateral` and `js_verify` from [`@phala/dcap-qvl-node`](https://github.com/Phala-Network/dcap-qvl):

```ts
const rawQuote = Buffer.from(stripHexPrefix(attestation.intel_quote), "hex");
const collateral = await js_get_collateral(TDX_PCCS_URL, rawQuote);
const raw = js_verify(rawQuote, collateral, BigInt(Math.floor(Date.now() / 1000)));
```

The status is accepted when it is `UpToDate` or `OutOfDate` (Intel still cryptographically verifies an out-of-date platform TCB; the app surfaces the status in the panel). `revoked`/malformed quotes fail.

## 4. TDX report-data binding

`checkReportData()` proves the signing key belongs to the enclave:

- Normal mode: `report_data[0..32]` is the 20-byte ECDSA address right-padded to 32 bytes.
- TLS-fingerprint mode: `report_data[0..32] = SHA-256(signing_address || tls_cert_fingerprint)`.
- In both modes, `report_data[32..64]` is the raw 32-byte nonce.

This blocks an attacker from presenting valid GPU evidence while using a signing key generated outside the TEE.

## 5. NVIDIA GPU attestation

The `nvidia_payload` is posted to NVIDIA NRAS. The response is `[["JWT", overall], {"GPU-0": perGpu, ...}]`.

The app checks:

| Claim | Expected |
|---|---|
| `x-nvidia-overall-att-result` | `true` |
| `eat_nonce` (overall and per-GPU) | matches the request nonce |
| `payload.nonce` | matches the request nonce |
| `secboot` | `true` |
| `dbgstat` | `"disabled"` |
| `measres` | `"success"` |
| `x-nvidia-gpu-attestation-report-nonce-match` | not `false` |
| all `x-nvidia-*-verified` booleans | `true` |
| `x-nvidia-attestation-warning` | `null` |
| `exp` / `iat` | not expired |

Per-GPU details (hardware model, driver, VBIOS) are shown in the Verified panel.

## 6. Compose manifest

`attestation.info.tcb_info.app_compose` is SHA-256 hashed. The verified TDX quote's `mr_config` must start with `01 + hash`. A match proves the exact container configuration that was measured into the TEE.

## 7. Gateway TEE

When the gateway returns a signed response, the gateway attestation goes through the same TDX, report-data, nonce, and compose checks. The signature is compared to the gateway address instead of a model address.

## 8. Chat signature

The app sends with `stream: false`. The exact JSON request-body string is hashed; the exact response-body string is hashed. The signature response contains:

```json
{
  "text": "Qwen/Qwen3.8-27B:{request_hash}:{response_hash}",
  "signature": "0x...",
  "signing_address": "0x...",
  "signing_algo": "ecdsa",
  "signature_kind": "provider_tee"
}
```

Checks:

- `signature_kind` matches the number of fields in `text` (3 = `provider_tee`, 2 = `gateway`).
- `text` commits to the requested model id (for `provider_tee`).
- Signed request hash equals SHA-256 of the exact request body.
- Signed response hash equals SHA-256 of the exact response text (including whitespace and newlines).
- `ethers.verifyMessage(text, signature)` recovers an address.
- The recovered address is case-insensitively equal to one of the attested model addresses (or the gateway address for `gateway`).
- The API-reported `signing_address` equals the recovered address.

If any check fails, the pipeline throws and no result is shown.

### Signature lookup retries

A model can be served by multiple TEE nodes. The signature is cached on the node that served the completion, so `GET /v1/signature/{id}` can briefly return 404 while another node answers. `fetchChatSignature()` retries 8 times with a 900 ms delay.

### Multiple attestation nodes

The attestation report can contain several model TEEs. The app extracts all signing addresses, picks the attestation whose address matches the recovered signer, and verifies that node plus the gateway. The panel shows the total node count.

## 9. What is deliberately not verified

- **Sigstore provenance** of container images is not fetched.
- **TLS certificate fingerprint binding** is not used (`include_tls_fingerprint` is off).
- **NVIDIA JWT signature** is not re-verified locally; NRAS is trusted over TLS, matching NVIDIA's reference flow and the official NEAR AI verifier.
- **Model correctness** is not a cryptographic property. The model can miscategorize a merchant; deterministic rules and the category hint are shown separately.

These omissions are listed so the claim stays precise: the app proves *where the computation ran and which bytes it signed*, not that the model's judgment is perfect.

## Independent verification

1. **The app itself**: every audit's Verified panel lists each check, the nonce, both hashes, the recovered signer, TDX status, GPU count, and the attestation timestamp.
2. **Download `proof.json`**: contains no receipts or statement content; compare its hashes with your own copy of the response if you log bytes.
3. **NEAR AI verification center**: <https://cloud.near.ai/verify>.
4. **TEE Attestation Explorer**: paste the `intel_quote` at <https://proof.t16z.com/>.
5. **Command line**: `npm run verify:minimal` runs the same chain against a one-line completion and prints every result.
6. **Full verifier**: the official [`nearai/nearai-cloud-verifier`](https://github.com/nearai/nearai-cloud-verifier) offers Python and TypeScript CLIs, including domain/TLS checks that this app does not perform.

## Code map

| Concern | File |
|---|---|
| API calls, retries, NRAS | `lib/nearai/client.ts` |
| TDX / report data / GPU / compose | `lib/nearai/verify.ts` |
| Hash + signature recovery | `lib/nearai/chat-verify.ts` |
| Nonce, orchestration, refusal | `lib/pipeline.ts` |
| Check list construction | `buildChecks()` in `lib/pipeline.ts` |
| Panel rendering | `components/verification-panel.tsx` |
| Minimal CLI | `scripts/minimal-verify.ts` |
