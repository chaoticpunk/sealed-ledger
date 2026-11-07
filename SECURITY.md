# Security policy

Sealed Ledger is a hackathon prototype provided under the MIT license, without
warranty.

## Reporting a vulnerability

Please do not open a public issue containing:

- an API key or other credential
- real receipts, bank statements, or personal financial data
- exploit details that could be used against a deployed instance

Use GitHub's private **Security advisories** ("Report a vulnerability") on this
repository instead. Include reproduction steps and the affected commit; never
include real user data.

## Deployment note

The app has no authentication. A public deployment uses the operator's NEAR AI
Cloud key and credits. Put any public instance behind access control or rate
limiting, and use a dedicated low-limit key.

## Scope

The verification claims and their limits are documented in
[`docs/VERIFICATION.md`](docs/VERIFICATION.md) and
[`docs/OVERVIEW.md`](docs/OVERVIEW.md). The app does not implement Sigstore
provenance or TLS-fingerprint binding; NVIDIA JWT verification is delegated to
NRAS over TLS.
