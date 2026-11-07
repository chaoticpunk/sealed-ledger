<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sealed Ledger — agent notes

Project for NEAR Hackathon 2026, Track 03 (Privacy & Private AI). Read `README.md` and `docs/VERIFICATION.md` before changing verification logic.

## Rules for agents

1. **Never fake verification.** The Verified panel must only render checks that were actually computed from a live attestation/signature. Do not add demo modes that mark checks as passed without cryptographic evidence. UI fixtures belong in tests only and must never ship as a fallback.
2. **Never retain user content.** No database, filesystem writes, analytics, content logging, response caching, or error messages that echo receipt/statement text. `grep -r "console\\." app components lib` must stay empty.
3. **Use the vendored skill.** `.claude/skills/near-ai-cloud/` is the official `near/agent-skills` skill. Follow its verification flow and endpoint shapes.
4. **Keep the minimal script first.** `scripts/minimal-verify.ts` is a track requirement. Changes to the verification layer should keep `npm run verify:minimal` working.
5. **No secrets.** `NEARAI_CLOUD_API_KEY` lives in `.env.local` (gitignored) and is read only in server code. Never print it or send it to the browser.

## Commands

```bash
npm run dev              # Next.js 16 app (Turbopack)
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke            # health-check an existing server or start one on :3100
npm run verify:minimal   # requires a real key in .env.local
npm run samples          # regenerate fictional sample receipts/CSV
```

## Verification invariants

- Attestation is fetched with a fresh 32-byte nonce before the completion.
- The completion is non-streaming so the model TEE signs (`provider_tee`).
- Request/response hashes are over the exact wire strings.
- A result is shown as verified only if every non-skipped check passes.
- TDX verification uses `@phala/dcap-qvl-node`; keep it in `serverExternalPackages`.
- Do not add `export const runtime` or `export const dynamic` to routes: `cacheComponents` is enabled and rejects them in Next 16.
