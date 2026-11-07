# Deployment

Sealed Ledger is a Next.js 16 app with one stateful external dependency
(NEAR AI Cloud) and no database, queue, cache, or background worker. That makes
deployment simple, but there are a few constraints worth knowing.

## 1. Requirements

- Node.js **>= 20.6** (the repo was developed on Node 24)
- A NEAR AI Cloud API key with credits / a spending limit
- Outbound HTTPS access to:
  - `https://cloud-api.near.ai`
  - `https://nras.attestation.nvidia.com`
  - Intel TDX collateral endpoints used by `dcap-qvl`
- No persistent volume, database, or object storage is required or wanted

## 2. Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NEARAI_CLOUD_API_KEY` | Yes | — | Server-only. Never commit it. |
| `NEARAI_MODEL` | No | `Qwen/Qwen3.8-27B` | Must appear in `/v1/models` with `owned_by: nearai` |
| `NEARAI_CLOUD_BASE_URL` | No | `https://cloud-api.near.ai` | Override only for a compatible gateway |
| `NEXT_PUBLIC_REPO_URL` | No | empty | Public repo link shown in the header/footer. `NEXT_PUBLIC_*` is inlined at build time. |
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | Absolute base URL for Open Graph / Twitter cards. Set it in production so `og.png` resolves for crawlers. |

Locally, these live in `.env.local` (gitignored). In production, set them in
the host's environment or secret manager.

`NEARAI_CLOUD_API_KEY` is read in `lib/nearai/client.ts` and never sent to the
browser. `/api/health` reports only whether it is configured.

## 3. Local

```bash
npm ci
cp .env.example .env.local     # add NEARAI_CLOUD_API_KEY
npm run dev                    # http://localhost:3000
```

Production-mode smoke test:

```bash
npm run build
npm start                      # http://localhost:3000
curl -s http://localhost:3000/api/health
```

`npm run build` also runs TypeScript. The build must succeed with
`serverExternalPackages: ["@phala/dcap-qvl-node"]` intact; removing it can
break TDX quote verification at runtime.

## 4. Node host (recommended)

A single Node process behind a TLS-terminating reverse proxy is the simplest
topology:

```
Internet → reverse proxy (TLS) → next start (Node) → cloud-api.near.ai
```

Deploy steps:

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

The default port is `3000`; set `PORT` if your host requires it.

### Reverse proxy notes

- The audit route streams NDJSON. Disable proxy buffering for `/api/audit`.
  The route already sends `x-accel-buffering: no` for nginx-style proxies.
- Allow long responses: `maxDuration = 300` and the upstream fetches can take
  10–30 seconds in a normal run.
- Do not cache responses. The route sends `Cache-Control: no-store`.
- Terminate TLS at the proxy; TLS to NEAR AI Cloud is separate and terminates
  inside the gateway TEE.

### No persistence

Do not add a database, a writeable upload directory, a CDN cache, or request
body logging to "help" the app. The privacy design depends on there being
nothing to retain. The app can be restarted or scaled horizontally at any time.

## 5. Vercel / serverless

The app can deploy to Vercel, with caveats:

| Constraint | Detail | Mitigation |
|---|---|---|
| Function duration | `maxDuration = 300` requires a plan that allows 300-second functions. TDX + NRAS normally completes in 10–30 s. | Use a plan with the limit, or prefer a Node host |
| Request body size | Serverless request bodies may be capped at **4.5 MB** | The browser downscales images >1.5 MB to max 1800 px JPEG; the fictional sample is under 1 MB per image |
| Native/WASM dependency | `@phala/dcap-qvl-node` is a native/WASM package | Keep it in `serverExternalPackages`; verify TDX verification in the deployed runtime |
| Streaming | The route streams NDJSON | Use a runtime/plan that supports streamed responses |
| No shared disk | Not needed | Nothing to configure |

Set `NEARAI_CLOUD_API_KEY` and `NEARAI_MODEL` in the project's environment
settings. Set `NEXT_PUBLIC_REPO_URL` before the build if you want the Source
links populated.

After deploying:

```bash
curl -s https://your-host/api/health
# expect configured:true, listed:true, teeHosted:true
```

Then run one audit with the fictional sample. A `verified: true` result with
the proof JSON is the deployment's real smoke test.

## 6. Access control warning

The app has **no authentication**. If you deploy it with your key, anyone who
can reach the URL can run audits against your NEAR AI Cloud credits.

Before exposing a public demo:

- Use a dedicated key with a low spending limit.
- Put the deployment behind a private URL, access proxy, or password gate.
- Add rate limiting at the edge if it is public.
- Never put the key in client-side code or a `NEXT_PUBLIC_*` variable.

## 7. Key rotation

1. Generate a new key at <https://cloud.near.ai>.
2. Update the host's secret / `.env.local`.
3. Restart or redeploy the app.
4. Revoke the old key.
5. Run `npm run verify:minimal` or one UI audit to confirm.

If a key has appeared in a chat, screenshot, or public repository, rotate it.

## 8. Operational checklist

- [ ] `NEARAI_CLOUD_API_KEY` set in the host, not in git
- [ ] `NEARAI_MODEL` listed by `/v1/models` with `owner: nearai`
- [ ] `/api/health` returns `configured:true`, `listed:true`, `teeHosted:true`
- [ ] `npm run smoke` passes against the running server
- [ ] One sample audit returns `verified: true`
- [ ] TDX and NRAS checks appear in the Verified panel
- [ ] Reverse proxy does not buffer `/api/audit`
- [ ] No database, volume, upload directory, or content logging added
- [ ] Public deployment is access-controlled or rate-limited
- [ ] `NEXT_PUBLIC_REPO_URL` set before build if Source links are wanted
- [ ] Old keys revoked after rotation

## 9. Troubleshooting

See [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) for the common failures,
including the current `402 — No spending limit configured` blocker and the
distinction between a missing key, an invalid model, and missing credits.
