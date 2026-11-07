# Submission notes

## Track

**03 — Privacy & Private AI** ("Private by design")

## Project name

**Sealed Ledger**

## Description (20–2,000 characters)

Expense auditing requires handing bank statements and receipts to an AI service, where users can only trust the provider’s promise not to retain or inspect them. Sealed Ledger lets them verify instead. Users upload receipt photos and/or a bank CSV; a multimodal model inside NEAR AI Cloud’s Intel TDX confidential VM with an NVIDIA TEE GPU categorizes every charge and flags anomalies. NEAR AI Cloud provides the confidential inference endpoint and the TDX/NVIDIA attestation; the app generates a fresh 256-bit nonce, verifies the Intel TDX quote with dcap-qvl, validates NVIDIA NRAS GPU evidence, checks that TDX report data binds the signing address and nonce, re-hashes the exact request/response bytes, and recovers the ECDSA signer to the attested TEE address. Every result ships with a Verified panel and proof.json containing no personal data. Uploads are held in server memory for one request only: no database, disk writes, content logs, or cache. The repo includes a focused /app workspace, a minimal verification script, the official near-ai-cloud skill, and fictional samples. A sample run passed 22/22 checks in ~37s: $4,905 spend, 4 anomalies, 4/5 receipts reconciled.

## How the build maps to the track brief

| Brief | Implementation |
|---|---|
| Users upload receipts or a bank statement | Drag/drop for PNG/JPG/WebP + CSV; five fictional receipt PNGs and a 24-row CSV included |
| Model categorizes spending and identifies anomalies | `Qwen/Qwen3.8-27B` (TEE-hosted, multimodal) returns JSON categories; deterministic rules add duplicates, outliers, subscription jumps, late-night, and currency checks |
| Demonstrate the analysis occurred within a TEE | Verified panel + `proof.json`: TDX quote status, report-data binding, NVIDIA NRAS verdicts, nonce echo, exact-byte hashes, ECDSA signer |
| OpenAI-compatible API at `cloud-api.near.ai/v1`, key in `.env` | `lib/nearai/client.ts`; `.env.example`; key only read server-side |
| TEE-hosted model from the models endpoint | `assertTeeHostedModel()` requires `owned_by === "nearai"` |
| Fresh nonce + validate attestation per docs | `randomBytes(32)`; dcap-qvl; NRAS; report-data checks |
| Verified panel listing checks | `components/verification-panel.tsx`, checks grouped by model / attestation / TDX / GPU / signature / data handling |
| No server-side retention after response | In-memory only; no DB, fs writes, content logs, or cache; documented in README and code |
| Fictional samples | `public/samples/`, regenerate with `npm run samples` |
| Use the `near-ai-cloud` skill | Vendored at `.claude/skills/near-ai-cloud/`; its flow is used by both the CLI and the app |
| Minimal script first, show output, then UI | `scripts/minimal-verify.ts` + `docs/minimal-verify-output.txt` |

## What judges should run

```bash
npm install
cp .env.example .env.local      # add a NEAR AI Cloud API key
npm run verify:minimal          # one completion + full cryptographic walkthrough
npm run dev                     # open http://localhost:3000
```

In the UI: **Load sample → Run private audit**. The fictional sample needs no real data.

## Judging-criteria notes

- **Technical implementation:** real dcap-qvl TDX verification, real NVIDIA NRAS calls, real ECDSA recovery over exact bytes, deterministic parsing/rules, streaming progress, refusal to display unverified results.
- **Design:** ledger-inspired visual system (paper, ink, serif display, mono evidence), responsive layout, accessible status labels, no generic dashboard styling.
- **Impact:** expense auditing is a natural private-AI use case; the same pattern (TEE + attested signer + zero retention) applies to payroll, invoicing, and medical receipts.
- **Originality:** combines receipt/statement reconciliation with a full hardware-proof panel; the "Verified" panel is a product feature, not a debug console.
- **Sustainability:** the verification layer is reusable for any NEAR AI Cloud workload; the app has no server storage cost and no data-liability surface.

## Links to include in the public post

- Repository: <https://github.com/chaoticpunk/sealed-ledger>
- Live demo: <https://sealed-ledger.vercel.app>
- Workspace: <https://sealed-ledger.vercel.app/app>
- Demo video: [`docs/demo.mp4`](demo.mp4) (28 s, 1080×1080, captions burned in)
- Demo screenshots: `docs/screenshots/`
- NEAR AI Cloud: <https://cloud.near.ai>
- Verification center: <https://cloud.near.ai/verify>

## Pre-submit checklist

- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm test` passes (32 tests)
- [x] `npm run build` passes
- [x] `npm run verify:minimal` passes against a real key; output saved to `docs/minimal-verify-output.txt` (27 checks)
- [x] `.env.local` is not committed (`git status` clean of secrets)
- [x] Public repo contains `public/samples/` and `.claude/skills/near-ai-cloud/`
- [x] Live demo deployed with the production key; full sample audit verified
- [x] 28-second captioned demo video committed to `docs/demo.mp4`
- [ ] X post is public, says "built at NEAR HACKATHON", tags `@NEARProtocol`, and includes `#NEARHackathon`
- [ ] Both repo link and X post link submitted before **2026-11-14 23:59 UTC**
- [ ] NEAR wallet address ready for prize payment (no wallet connection needed)
