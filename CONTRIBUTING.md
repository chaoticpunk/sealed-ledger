# Contributing

## Setup

```bash
npm install
cp .env.example .env.local   # add NEARAI_CLOUD_API_KEY
npm run dev                  # http://localhost:3000
```

Unit tests and the production build do not require an API key.

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If the change affects the verification layer, also run:

```bash
npm run verify:minimal
```

and update `docs/minimal-verify-output.txt` if the expected output changed.

## Privacy invariants

These are not style preferences; they are the product:

- Do not add a database, filesystem write, upload directory, content log,
  analytics, or response cache for user files.
- Do not add a "demo mode" that marks a verification check as passed without
  cryptographic evidence. UI fixtures belong in tests and must never ship as a
  fallback.
- Keep `NEARAI_CLOUD_API_KEY` server-side. Never commit `.env.local`, print the
  key, or send it to the browser.
- Do not log receipt text, statement rows, prompts, model output, or file names.

## Code layout

- `app/` — pages and API routes
- `components/` — client UI
- `lib/audit/` — parsing, reconciliation, rules, prompt/schema
- `lib/nearai/` — NEAR AI Cloud client and verification
- `scripts/` — minimal verification and sample generation
- `test/` — unit tests for parsing, rules, hashing, signatures, and TDX binding

See `AGENTS.md` for the project-specific invariants and Next.js 16 notes.
