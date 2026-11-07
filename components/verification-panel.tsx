"use client";

import {
  ArrowUpRight,
  Check,
  Download,
  FileCheck2,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { StatusPill } from "@/components/ui";
import { cn, formatDate, shortHash } from "@/lib/format";
import { SITE } from "@/lib/site";
import type {
  VerificationCheck,
  VerificationReport,
} from "@/lib/verification/types";

const GROUP_LABELS: Record<VerificationCheck["category"], string> = {
  model: "Model policy",
  attestation: "Attestation",
  tdx: "CPU · Intel TDX",
  gpu: "GPU · NVIDIA NRAS",
  signature: "Response signature",
  data: "Data handling",
};

const GROUP_ORDER: VerificationCheck["category"][] = [
  "model",
  "attestation",
  "tdx",
  "gpu",
  "signature",
  "data",
];

function EvidenceRow({
  label,
  value,
  mono = true,
  copy = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  const displayValue = value.length > 40 ? shortHash(value, 10) : value;

  return (
    <div className="flex flex-col gap-1.5 border-b border-white/10 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <span className="shrink-0 pt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.13em] text-mint/55">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-left sm:items-start sm:text-right">
        <span
          className={cn(
            "min-w-0 break-all text-[0.72rem] leading-relaxed text-mint-soft/85",
            mono && "font-mono",
          )}
          title={value}
        >
          <span className="sm:hidden">{displayValue}</span>
          <span className="hidden sm:inline">{value}</span>
        </span>
        {copy && <CopyButton value={value} label="Copy" />}
      </span>
    </div>
  );
}

export function VerificationPanel({
  verification,
  onDownloadProof,
}: {
  verification: VerificationReport;
  onDownloadProof: () => void;
}) {
  const passed = verification.checks.filter(
    (check) => check.status === "pass",
  ).length;
  const failed = verification.checks.filter(
    (check) => check.status === "fail",
  ).length;
  const skipped = verification.checks.filter(
    (check) => check.status === "skip",
  ).length;

  const grouped = GROUP_ORDER.map((category) => ({
    category,
    checks: verification.checks.filter(
      (check) => check.category === category,
    ),
  })).filter((group) => group.checks.length > 0);

  const timing =
    verification.timing.totalMs < 1_000
      ? `${verification.timing.totalMs} ms`
      : `${(verification.timing.totalMs / 1_000).toFixed(1)} s`;

  return (
    <section
      id="verification"
      className={cn(
        "panel-dark scroll-mt-28 overflow-hidden",
        verification.verified && "verified-glow",
      )}
    >
      <div className="relative">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{
            background: verification.verified
              ? "radial-gradient(circle, rgba(47,191,143,.5), transparent 65%)"
              : "radial-gradient(circle, rgba(168,59,38,.5), transparent 65%)",
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border",
                verification.verified
                  ? "border-mint/30 bg-mint/10 text-mint"
                  : "border-ember/40 bg-ember/10 text-ember-soft",
              )}
            >
              {verification.verified ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-mint/60">
              Audit certificate
            </span>
            <span className="text-mint-soft/25">/</span>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-mint/40">
              Sealed Ledger
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip !border-white/10 !bg-white/[0.04] !text-[0.62rem] !text-mint-soft/60">
              {verification.signatureKind}
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-mint/40">
              {formatDate(verification.attestedAt.slice(0, 10))}
            </span>
          </div>
        </div>

        <div className="relative px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border",
                  verification.verified
                    ? "border-mint/40 bg-mint/10 text-mint"
                    : "border-ember/40 bg-ember/10 text-ember-soft",
                )}
              >
                {verification.verified ? (
                  <ShieldCheck className="h-8 w-8 animate-seal-pop" />
                ) : (
                  <ShieldAlert className="h-8 w-8 animate-seal-pop" />
                )}
                <span className="seal-ring animate-spin-slow" />
              </div>

              <div>
                <p className="eyebrow text-mint/70">
                  {verification.verified
                    ? "Cryptographic result"
                    : "Verification incomplete"}
                </p>
                <h3 className="mt-2 max-w-xl font-display text-[2rem] leading-none tracking-tight text-white sm:text-[2.35rem]">
                  {verification.verified
                    ? "Verified in a hardware TEE"
                    : "Analysis returned, proof failed"}
                </h3>
                <p className="mt-3 max-w-xl text-[0.84rem] leading-relaxed text-mint-soft/65">
                  {verification.verified
                    ? "The model ran inside an Intel TDX confidential VM with an NVIDIA TEE GPU. The completion is bound to the attested signer and the exact bytes exchanged."
                    : "The analysis is shown below, but at least one cryptographic check failed. Treat the result as unverified."}
                </p>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                <p className="font-mono text-[1.35rem] leading-none text-mint">
                  {passed}
                </p>
                <p className="mt-1.5 text-[0.56rem] uppercase tracking-[0.13em] text-mint/50">
                  passed
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                <p
                  className={cn(
                    "font-mono text-[1.35rem] leading-none",
                    failed > 0 ? "text-ember-soft" : "text-mint-soft/70",
                  )}
                >
                  {failed}
                </p>
                <p className="mt-1.5 text-[0.56rem] uppercase tracking-[0.13em] text-mint/50">
                  failed
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                <p className="font-mono text-[1.35rem] leading-none text-mint-soft/70">
                  {skipped}
                </p>
                <p className="mt-1.5 text-[0.56rem] uppercase tracking-[0.13em] text-mint/50">
                  skipped
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-[0.65rem] font-bold text-mint-soft">
              <FileCheck2 className="h-3.5 w-3.5" />
              Intel TDX
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-[0.65rem] font-bold text-mint-soft">
              <Fingerprint className="h-3.5 w-3.5" />
              NVIDIA NRAS
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-[0.65rem] font-bold text-mint-soft">
              <Check className="h-3.5 w-3.5" />
              ECDSA signer bound
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-3 py-1.5 text-[0.65rem] font-bold text-mint-soft">
              <Timer className="h-3.5 w-3.5" />
              {timing}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-mint-soft/55">
              0 bytes retained
            </span>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[1.38fr_1fr]">
            <div>
              <p className="eyebrow text-mint/50">Checks performed</p>
              <div className="mt-3 space-y-4">
                {grouped.map((group) => (
                  <div key={group.category}>
                    <p className="mb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-mint/40">
                      {GROUP_LABELS[group.category]}
                    </p>
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      {group.checks.map((check) => (
                        <div
                          key={check.id}
                          className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-3 py-3 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-[0.78rem] font-semibold leading-snug text-mint-soft/90">
                              {check.label}
                            </p>
                            {check.detail && (
                              <p className="mt-1 break-words text-[0.68rem] leading-relaxed text-mint-soft/50">
                                {check.detail}
                              </p>
                            )}
                          </div>
                          <StatusPill status={check.status} className="shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="eyebrow text-mint/50">Evidence</p>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-1">
                <EvidenceRow label="Model" value={verification.model.id} />
                <EvidenceRow
                  label="Signer"
                  value={verification.signingAddress ?? "not recovered"}
                />
                <EvidenceRow
                  label="Signature"
                  value={`${verification.signatureKind} · ${shortHash(
                    verification.signature.signedText,
                    18,
                  )}`}
                />
                <EvidenceRow label="Nonce" value={verification.nonce} />
                <EvidenceRow
                  label="Request SHA-256"
                  value={verification.hashes.request}
                />
                <EvidenceRow
                  label="Response SHA-256"
                  value={verification.hashes.response}
                />
                <EvidenceRow
                  label="Attested"
                  value={`${formatDate(verification.attestedAt.slice(0, 10))} · ${
                    verification.attestation.modelNodes
                  } model node(s) · ${verification.attestation.gpuCount} GPU`}
                  mono={false}
                  copy={false}
                />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={SITE.verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-between rounded-xl border border-mint/20 bg-mint/10 px-3.5 py-2.5 text-[0.74rem] font-bold text-mint-soft transition-colors hover:bg-mint/15"
                >
                  Open the verification center
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={onDownloadProof}
                  className="inline-flex items-center justify-between rounded-xl border border-white/15 px-3.5 py-2.5 text-[0.74rem] font-bold text-mint-soft/80 transition-colors hover:bg-white/5"
                >
                  Download proof JSON
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-4 text-[0.65rem] leading-relaxed text-mint-soft/40">
                The proof JSON contains the nonce, hashes, addresses, and check
                results. It contains no receipts, statement rows, or personal
                data.
              </p>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <p className="eyebrow text-mint/45">Verify independently</p>
                <ol className="mt-2.5 space-y-2 text-[0.66rem] leading-relaxed text-mint-soft/55">
                  <li>
                    <span className="mr-1.5 font-mono text-mint/70">01</span>
                    Copy the nonce and open the NEAR AI verification center.
                  </li>
                  <li>
                    <span className="mr-1.5 font-mono text-mint/70">02</span>
                    Compare the signer with the model TEE attestation report.
                  </li>
                  <li>
                    <span className="mr-1.5 font-mono text-mint/70">03</span>
                    Re-hash the exact response bytes and match the signed hash.
                  </li>
                </ol>
              </div>

              <div className="mt-3 rounded-xl border border-mint/20 bg-mint/10 p-3.5">
                <p className="text-[0.74rem] font-bold text-mint-soft">
                  Nothing to delete
                </p>
                <p className="mt-1 text-[0.66rem] leading-relaxed text-mint-soft/55">
                  Uploads live in a local array for the duration of this
                  request. The route handler has no database client, no
                  filesystem write, and no content logger.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
