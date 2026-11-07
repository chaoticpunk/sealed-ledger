# HTTP API

The app has two routes:

| Route | Method | Purpose |
|---|---|---|
| `/api/audit` | `POST` | Run a private audit; streams NDJSON progress and the result |
| `/api/health` | `GET` | Report key/model readiness without exposing the key |

Default local base URL: `http://localhost:3000`.

---

## `POST /api/audit`

### Request

`Content-Type: multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `files` | file, repeated | Yes | Receipt images and/or CSV statements |

Accepted files:

| Kind | Types | Limits |
|---|---|---|
| Receipt image | `image/png`, `image/jpeg`, `image/jpg`, `image/webp` | Max 6 images; max 5 MB each |
| Statement | `text/csv`, `application/csv`, `.csv` | UTF-8; multiple CSVs are merged |

Total upload limit: **12 MB**. The browser also downscales images larger than
1.5 MB to a max dimension of 1800 px (JPEG, quality 0.9) before upload.

The server parses everything in memory; there is no upload middleware, disk
write, database, or content log.

### Response

`200 OK` with `Content-Type: application/x-ndjson; charset=utf-8`.

The route streams one JSON object per line. It returns HTTP 200 even when the
audit fails; failures arrive as an `error` event inside the stream. This lets
the browser render progress before the outcome is known.

Response headers:

```
content-type: application/x-ndjson; charset=utf-8
cache-control: no-store, max-age=0
x-accel-buffering: no
x-content-type-options: nosniff
```

Route duration limit: `export const maxDuration = 300` (5 minutes).

### Event types

#### `progress`

```json
{
  "type": "progress",
  "event": {
    "step": "attestation",
    "status": "active",
    "detail": "Requesting a fresh 256-bit nonce attestation"
  }
}
```

`step` is one of:

| Step | Meaning |
|---|---|
| `ingest` | Parse CSV and read images in memory |
| `model` | Confirm the model is listed and TEE-hosted |
| `attestation` | Fetch nonce-bound attestation reports |
| `analysis` | Send the documents to the TEE model |
| `signature` | Fetch and verify the chat signature |
| `hardware` | Verify Intel TDX and NVIDIA GPU evidence |

`status` is `active`, `done`, or `error`. `detail` is a short human-readable
message. Progress events are advisory; the result event is authoritative.

#### `result`

```json
{
  "type": "result",
  "data": { "analysis": { "...": "..." }, "verification": { "...": "..." }, "warnings": [] }
}
```

`data` is an `AuditResponse`:

```ts
interface AuditResponse {
  analysis: {
    currency: string;
    period: { start: string | null; end: string | null };
    totals: {
      spend: number;
      income: number;
      net: number;
      transactions: number;
      anomalies: number;
    };
    categories: Array<{
      name: string;
      amount: number;
      count: number;
      share: number;
    }>;
    transactions: Array<{
      id: string;
      date: string;
      time?: string;
      merchant: string;
      description?: string;
      amount: number;
      currency: string;
      direction: "debit" | "credit";
      category: string;
      source: "statement" | "receipt" | "both";
      receiptFile?: string;
      matchedStatementIndex?: number;
      confidence?: number;
      anomaly?: {
        severity: "high" | "medium" | "low";
        reasons: string[];
        source: "model" | "rules" | "both";
      };
    }>;
    anomalies: Array<{
      transactionId: string;
      date: string;
      merchant: string;
      amount: number;
      currency: string;
      category: string;
      severity: "high" | "medium" | "low";
      reasons: string[];
      source: "model" | "rules" | "both";
    }>;
    summary: string;
    sources: {
      statementRows: number;
      receipts: number;
      matchedReceipts: number;
    };
  };
  verification: {
    verified: boolean;
    checks: Array<{
      id: string;
      label: string;
      status: "pass" | "fail" | "skip";
      detail?: string;
      category: "model" | "attestation" | "tdx" | "gpu" | "signature" | "data";
    }>;
    model: { id: string; name?: string; owner?: string };
    nonce: string;
    attestedAt: string;
    signingAddress: string | null;
    signatureKind: "provider_tee" | "gateway";
    hashes: { request: string; response: string };
    signature: {
      recovered: string | null;
      expected: string | null;
      signedText: string;
    };
    attestation: {
      modelNodes: number;
      gatewayAddress: string | null;
      tdxStatus: string | null;
      gpuCount: number;
      gpuModels: string[];
      composeVerified: boolean | null;
    };
    timing: { totalMs: number; verifiedAt: string };
    retention: "none";
  };
  warnings: string[];
}
```

`verification.verified` is `true` only when every check's status is `pass` or
`skip`. The UI refuses to label a result verified otherwise.

The proof download (`proof.json`) is assembled client-side from
`verification`. It contains no transaction rows, receipts, or personal data.

#### `error`

```json
{
  "type": "error",
  "code": "insufficient_credits",
  "message": "NEAR AI Cloud reports insufficient credits for this request."
}
```

The server also emits a final `progress` event with `status: "error"` and the
same message before the `error` event.

### Error codes

| Code | HTTP context | Meaning / action |
|---|---|---|
| `missing_api_key` | 503 | `NEARAI_CLOUD_API_KEY` is not set; add it to `.env.local` and restart |
| `auth_failed` | 401 / 403 | Key rejected; check/rotate the key |
| `insufficient_credits` | 402 | No credits or no spending limit; add credits / contact support |
| `model_not_found` | 400 | `NEARAI_MODEL` is not in `/v1/models` |
| `model_not_tee` | 400 | Model is listed but `owned_by` is not `nearai` |
| `upstream_error` | varies | NEAR AI Cloud or NRAS returned an error; message includes context |
| `missing_chat_id` | 502 | Completion had no chat id, so no signature lookup is possible |
| `signature_unavailable` | 502 | Signature endpoint kept returning 404 after retries |
| `audit_failed` | — | Parsing, model JSON, or another pipeline error |

### Example

```bash
curl -N -X POST http://localhost:3000/api/audit \
  -F "files=@public/samples/bank-statement-2026-09.csv;type=text/csv" \
  -F "files=@public/samples/receipt-01-harbor-pine.png;type=image/png"
```

Sample output (abridged):

```jsonl
{"type":"progress","event":{"step":"ingest","status":"active","detail":"Parsing files in memory"}}
{"type":"progress","event":{"step":"ingest","status":"done","detail":"24 statement row(s), 1 receipt image(s)"}}
{"type":"progress","event":{"step":"model","status":"active","detail":"Confirming Qwen/Qwen3.8-27B is TEE-hosted"}}
...
{"type":"result","data":{"analysis":{"currency":"USD", ...},"verification":{"verified":true, ...},"warnings":[]}}
```

A `jq`-friendly consumer can split lines and filter on `type`.

### Client behavior

`components/auditor-app.tsx` reads the response with
`response.body.getReader()`, decodes chunks, splits on `\n`, and dispatches each
JSON line. It updates the progress rail on `progress`, renders results on
`result`, and shows the error banner on `error`.

There is no polling and no retry of a failed audit. Reloading or running again
creates a fresh nonce and a fresh request.

---

## `GET /api/health`

Reports readiness. This endpoint never returns the API key.

### Response

```json
{
  "configured": true,
  "model": "Qwen/Qwen3.8-27B",
  "listed": true,
  "teeHosted": true,
  "owner": "nearai",
  "baseUrl": "https://cloud-api.near.ai"
}
```

| Field | Meaning |
|---|---|
| `configured` | `NEARAI_CLOUD_API_KEY` is non-empty |
| `model` | `NEARAI_MODEL` or the default |
| `listed` | The model appears in `GET /v1/models` |
| `teeHosted` | `owned_by === "nearai"` |
| `owner` | The reported owner, if listed |
| `error` | Set when the models endpoint could not be reached |
| `baseUrl` | The configured NEAR AI Cloud base URL |

Headers: `cache-control: no-store, max-age=0`.

The endpoint calls `GET /v1/models` on each request (the models endpoint is
public and does not require a key). It can take ~1 s when the upstream is
reachable.

### Readiness states

| `configured` | `listed` | `teeHosted` | Meaning |
|---|---|---|---|
| `false` | any | any | Key missing; uploads work but audits cannot run |
| `true` | `false` | `false` | Key set but model is not in `/v1/models`; check `NEARAI_MODEL` |
| `true` | `true` | `false` | Model exists but is not NEAR AI-hosted; audits will be rejected |
| `true` | `true` | `true` | Ready for an audit |

A `true/true/true` health response does **not** guarantee credits. The 402
failure only appears when a completion is attempted.

---

## Security notes

- `NEARAI_CLOUD_API_KEY` is read only in server code and is never included in a
  response, the proof JSON, or the browser bundle.
- Both routes are same-origin by default; no CORS headers are set.
- There is **no authentication** on the app. If you deploy it publicly with
  your key, anyone with the URL can spend your credits. Put it behind a private
  URL, access proxy, or rate limit, or use a dedicated low-limit key.
- No request bodies are logged. Error messages are derived from upstream
  errors and do not echo receipt or statement content.
