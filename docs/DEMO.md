# Demo script

Target: **3 minutes**, recorded as a screen capture with the app at 1440 px wide.

## Before recording

```bash
cp .env.example .env.local        # add NEARAI_CLOUD_API_KEY
npm install
npm run verify:minimal            # show this terminal output first
npm run dev                       # http://localhost:3000
```

Open `http://localhost:3000/app` (or click **Start audit** from the landing page), click **Load sample**, and leave the six fictional files loaded. Do one dry run so the first real run is not a cold start.

## Script

**0:00 — The problem.**
"Expense apps ask you to upload your most sensitive documents to a server you do not control. I built Sealed Ledger for the Privacy track: it audits your spending inside a hardware enclave, and then proves the analysis stayed private."

**0:20 — Evidence in.**
Click **Load sample**. "This is fictional data: a 24-row bank statement and five receipt photos. Duplicates, a subscription price jump, and a late-night charge are seeded in. The files are parsed in server memory — there is no database, no disk write, no content log."

**0:35 — Run.**
Click **Run private audit**. While progress runs: "The server generates a fresh 256-bit nonce, fetches an attestation report for the model and gateway TEEs, sends the documents to a NEAR AI-hosted model, then verifies the Intel TDX quote, NVIDIA GPU evidence, and the ECDSA signature over the exact request and response bytes."

**1:00 — The Verified panel.**
Point at the top of the dark panel:
- "Every check passed (the count varies with the attestation; typically 20–22)."
- "The nonce is bound into TDX report data and NVIDIA's `eat_nonce`."
- "The signer recovers to the attested model TEE address."
- "Compose manifest matches `mr_config`."
- "Evidence section: signer, nonce, both SHA-256 hashes."
- "0 bytes retained. The route handler closes and there is nothing to delete."

**1:40 — The audit result.**
Scroll to the ledger:
- "$4,905 spend, $4,200 income, 4 anomalies."
- "Duplicate coffee charge, $1,899 electronics purchase, StreamWave went from $15.99 to $24.99, and a 02:13 diner charge."
- "Four of five receipts reconciled to statement rows; the hardware-store receipt is receipt-only. The app did not double-count."

**2:20 — The proof.**
Click **Download proof JSON**. Open it briefly:
- "It contains the nonce, hashes, addresses, and check results. No receipts, no transactions, no personal data."
- Point at the verification center link: "Anyone can independently check this against NEAR AI's verification center."

**2:40 — Close.**
"Sealed Ledger is a working private expense auditor: NEAR AI Cloud's OpenAI-compatible API, a TEE-hosted model, fresh-nonce attestation, a real Verified panel, zero server-side retention, and fictional samples. The minimal verification script is in the repo and runs the same chain from the command line."

## X post template

> Built **Sealed Ledger** at NEAR HACKATHON: a private expense auditor that runs inside NEAR AI Cloud TEEs.
>
> Upload receipts or a bank statement → the model categorizes and finds anomalies inside Intel TDX + NVIDIA enclaves → every result ships with a Verified panel (TDX quote, NRAS GPU evidence, ECDSA signer, nonce binding) and zero server-side retention.
>
> A sample run passed 22/22 proof checks in ~37s: $4,905 spend, 4 anomalies, 4/5 receipts reconciled.
>
> Track 03 — Privacy & Private AI 🧾🔐
>
> [repo link] · [demo video]
>
> @NEARProtocol #NEARHackathon

Both `@NEARProtocol` and `#NEARHackathon` are required.

## Submission form fields

| Field | Value |
|---|---|
| Project name | Sealed Ledger |
| Track | 03 — Privacy & Private AI |
| Repository | public GitHub URL |
| Demo post | public X post URL with the video/screenshots |
| Description | see `docs/SUBMISSION.md` |
| Team size | solo or team |
| NEAR wallet | address for prize payment |

Deadline: **2026-11-14 23:59 UTC**.
