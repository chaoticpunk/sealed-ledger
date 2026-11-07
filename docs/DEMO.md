# Demo script

## Short video

A 28-second captioned video made from the real audit screenshots is committed at
[`demo.mp4`](demo.mp4) (1080×1080, H.264 + silent AAC). Attach it to the X post
as-is, or use it as a storyboard for a screen recording.

## 3-minute live demo script

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

## X demo post

The human must publish the post; the agent may draft it but must not post it.
Attach `demo.mp4` to the first tweet. Both `@NEARProtocol` and `#NEARHackathon`
are required, and the post must say the project was built at NEAR HACKATHON.

### Tweet 1 — problem + demo video (273 characters with one link)

> Your bank statement shouldn't be handed to an AI. Built Sealed Ledger at NEAR
> HACKATHON: receipts + CSV are audited inside NEAR AI Cloud TEEs, and every
> result ships with a hardware proof. 0 bytes retained. Track 03 🧾🔐
>
> https://sealed-ledger.vercel.app
> @NEARProtocol #NEARHackathon

### Tweet 2 — reply with NEAR's role, result, repo, and a question (270 characters)

> NEAR AI Cloud supplies confidential inference + TDX/NVIDIA attestation. The app
> verifies the TDX quote, NRAS GPU evidence, nonce binding, exact byte hashes,
> and ECDSA signer. 22/22 checks · $4,905 · 4 anomalies.
>
> Repo: https://github.com/chaoticpunk/sealed-ledger
> What would you audit first?

The submission `demoUrl` is the URL of tweet 1.

## Submission form fields

| Field | Value |
|---|---|
| Project name | Sealed Ledger |
| Track | `privacy` (Track 03 — Privacy & Private AI) |
| Repository | `https://github.com/chaoticpunk/sealed-ledger` |
| Demo post | URL of tweet 1 in the X thread |
| Description (`idea`) | see `docs/SUBMISSION.md` |
| Team size | `1` if solo; API also accepts `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| NEAR wallet | address for prize payment |
| Website | **omit** — the submission API has no website field |

The human must review the full JSON payload and explicitly approve it before the
submission is sent. Do not submit a second time to fix a mistake; use the
request-changes flow instead.

Deadline: **2026-11-14 23:59 UTC**.
