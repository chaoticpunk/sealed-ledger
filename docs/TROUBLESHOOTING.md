# Troubleshooting

Start with these three checks:

```bash
# 1. Is the server up and is the key/model configured?
curl -s http://localhost:3000/api/health | jq

# 2. Does the same chain work outside the UI?
npm run verify:minimal

# 3. Check the terminal running `npm run dev` for compile or runtime errors.
```

Remember: `/api/audit` returns HTTP 200 and streams errors as NDJSON events.
An audit failure shows up in the UI banner / `error` event, not as a non-200
response.

---

## 1. `402 — No spending limit configured`

### Symptom

`npm run verify:minimal` stops at:

```text
❌ Verification failed: The TEE model request failed (HTTP 402):
{"error":{"message":"No spending limit configured. Please contact support to set up credits.","type":"no_limit_configured"}}
```

The UI shows an audit error instead of a result. Model listing and attestation
checks may still pass.

### Cause

The API key is valid, but the NEAR AI Cloud account has no credits or no
spending limit configured for this key/account. This is not a code bug.

> The project's current key passes all 27 checks. This section applies when a
> new key or account hits the same 402.

### Fix

1. Sign in at <https://cloud.near.ai>.
2. Open **Credits** and add credits (hackathon participants may use the NEAR AI
   Cloud Credits form linked in the README).
3. If credits are present but the 402 persists, contact NEAR AI Cloud support
   and ask them to configure a spending limit for the account.
4. Re-run:

   ```bash
   npm run verify:minimal
   ```

5. Save the successful output to `docs/minimal-verify-output.txt`.

### Notes

- `/api/health` can return `configured:true`, `listed:true`, and
  `teeHosted:true` while completions still return 402. Health does not check
  credits.
- The UI maps 402 to a generic `insufficient_credits` message; the raw
  `no_limit_configured` detail is visible in `verify:minimal` and the server
  log.

---

## 2. `401` / `403` — key rejected

```text
NEAR AI Cloud rejected the API key. Check NEARAI_CLOUD_API_KEY and your credits.
```

- Confirm the key is pasted without quotes or trailing whitespace
  (`lib/nearai/client.ts` trims it, but a copied newline can still surprise).
- Regenerate the key at <https://cloud.near.ai>.
- Update `.env.local` and **restart** `npm run dev`; environment variables are
  read at startup.
- If the key was committed, pasted in chat, or shown on screen, revoke it.

---

## 3. `configured:false` — key not loaded

`GET /api/health` returns `configured:false`.

- Check `.env.local` exists in the repo root and contains:

  ```bash
  NEARAI_CLOUD_API_KEY=...
  ```

- Restart the dev server after editing. Next.js reads `.env.local` at startup.
- Confirm you are not running from a different working directory.
- `.env.local` is gitignored; do not commit it.

---

## 4. Health says `Could not reach the models endpoint`

`/api/health` returns `error: "Could not reach the NEAR AI Cloud models endpoint"`.

- Check outbound network access to `https://cloud-api.near.ai`.
- If `NEARAI_CLOUD_BASE_URL` is set, confirm it is correct and reachable.
- Try the public endpoint directly:

  ```bash
  curl -s https://cloud-api.near.ai/v1/models | head
  ```

- Corporate proxies / VPNs can block NVIDIA NRAS or Intel PCCS separately;
  model listing can work while attestation later fails.

---

## 5. `model_not_found` or `model_not_tee`

```text
Model <id> is not listed by NEAR AI Cloud...
Model <id> is listed with owner "<owner>"; it is not a NEAR AI-hosted TEE model.
```

- Check `NEARAI_MODEL` in `.env.local`.
- List the models and pick one with `owned_by: "nearai"`:

  ```bash
  curl -s https://cloud-api.near.ai/v1/models | jq '.data[] | {id, owned_by}'
  ```

- The default is `Qwen/Qwen3.8-27B`; another compatible multimodal model may
  also work if it is TEE-hosted and returns JSON.
- Restart after changing `NEARAI_MODEL`.

---

## 6. No model or gateway attestation

```text
The attestation response contained no model TEE...
The attestation response contained no gateway TEE...
```

- This usually means the selected model is not TEE-hosted, or the upstream
  attestation endpoint is degraded.
- Re-run `npm run verify:minimal` to see the raw attestation response context.
- Try again later; attestation depends on live NEAR AI Cloud services.

---

## 7. Signature errors

### `The TEE response signature did not verify. The result was discarded.`

The pipeline refuses to show a result when the signature does not recover to an
attested address. This is intentional.

- Retry the audit. Signature lookup can briefly race across model nodes.
- If it persists, check the model/gateway attestation details in the error and
  in `docs/VERIFICATION.md`.
- Do not "fix" this by ignoring the signature; that would violate the project's
  verification invariant.

### `signature_unavailable` / repeated 404

`fetchChatSignature` retries 404 up to 8 times with 900 ms spacing because the
signature is cached on the node that served the completion. If all retries
fail, the audit errors. Retry; if it persists, the upstream signature service
may be degraded.

### `missing_chat_id`

The completion response had no `id`, so no signature can be fetched. This is an
upstream/protocol error; retry and check the raw response in `verify:minimal`.

---

## 8. TDX, NRAS, or compose checks fail

If a hardware check fails, the result is still returned but
`verification.verified` is `false`; the UI labels it **unverified** and lists
the failed checks. This is different from a signature failure, which discards
the result.

Common causes:

- NVIDIA NRAS or Intel PCCS is temporarily unavailable or rate-limited.
- The GPU evidence expired or its nonce does not match the request.
- The attested compose manifest does not match `mr_config` (upstream deployment
  changed).
- A transient network failure during dcap-qvl collateral fetch.

Retry first. Read the `detail` on the failed check and cross-reference
`docs/VERIFICATION.md`. Do not present a failed result as verified.

---

## 9. Model returned invalid JSON

```text
The TEE model did not return a valid audit after two attempts...
```

The pipeline tries once more with a repair note describing the schema error.
If the second attempt still fails, the audit errors.

- Retry; some models occasionally emit malformed JSON.
- If it is reproducible, check the model's JSON mode support and the prompt/
  schema in `lib/audit/prompt.ts` / `lib/audit/schema.ts`.
- The client/route automatically retries once without `response_format` /
  `chat_template_kwargs` if the gateway rejects those fields with 400/422.

---

## 10. Upload and parsing errors

| Message | Cause / fix |
|---|---|
| `Upload at least one receipt image or a bank statement CSV.` | Empty selection |
| `"<file>" is not supported. Use PNG, JPG, WebP, or CSV.` | Unsupported type or missing MIME |
| `"<file>" is larger than 5 MB.` | Per-file server limit; compress the image |
| `Upload is larger than 12 MB...` | Total limit; remove files |
| `Upload at most 6 receipt images.` | Image count limit |
| `The file "<name>" is not valid UTF-8 CSV.` | Re-export the statement as UTF-8 |
| `No debit transactions were found.` | Not an error; the parser found no spend |

Notes:

- The browser downscales images >1.5 MB to max 1800 px JPEG before upload.
- Multiple CSVs are merged; rows keep their source order and indices are
  offset.
- Mixed currencies are flagged in `warnings`; totals include only the
  statement's base currency.

---

## 11. "Load sample" fails

```text
Could not load the fictional sample. Run `npm run samples` and try again.
```

The browser fetches `/samples/samples.json` and the files it lists. If the
files are missing or the manifest is malformed:

```bash
npm run samples
```

Then reload the page. The samples are committed, so this is usually only an
issue after a partial checkout or manual deletion.

---

## 12. Dev/build issues

### Port 3000 already in use

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs kill
npm run dev
```

### `@phala/dcap-qvl-node` fails to load

Keep `serverExternalPackages: ["@phala/dcap-qvl-node"]` in `next.config.ts`.
Do not bundle the package. Reinstall dependencies if the native/WASM payload is
missing:

```bash
rm -rf node_modules
npm ci
```

### Next 16 rejects `export const runtime` / `export const dynamic`

`cacheComponents` is enabled. Routes must not declare those exports; see
`AGENTS.md`. Remove them if a patch adds them.

### Environment changes not picked up

Restart `npm run dev`. `NEXT_PUBLIC_REPO_URL` is inlined at build time, so a
production build must be rebuilt after changing it.

---

## 13. UI shows results but marks them unverified

That is the intended behavior when hardware checks fail:

- The analysis is still displayed.
- `verification.verified` is `false`.
- The Verified panel lists the failed checks.

Use the proof JSON's `checks` array to see exactly which check failed. If the
signature itself failed, there is no result at all.

---

## 14. What to include in a bug report

- `curl -s http://localhost:3000/api/health`
- The failing step and `detail` from the progress rail or NDJSON
- `npm run verify:minimal` output (redact the API key; the script does not print
  it, but review before sharing)
- Whether the failure is signature (result discarded) or hardware (result shown
  unverified)
- Node version, OS, and whether the app is local or deployed

Never paste `NEARAI_CLOUD_API_KEY` into an issue, chat, or screenshot.
