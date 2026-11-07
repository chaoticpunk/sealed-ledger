import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Cpu,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

import { AuditorApp } from "@/components/auditor-app";
import { SealMark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SectionHeading } from "@/components/ui";
import { SITE } from "@/lib/site";

const PROOF_ROWS = [
  { label: "Model", value: "Qwen/Qwen3.8-27B" },
  { label: "CPU TEE", value: "Intel TDX · dcap-qvl" },
  { label: "GPU TEE", value: "NVIDIA NRAS · verified" },
  { label: "Signer", value: "0x71c4…4e2 · bound" },
  { label: "Retention", value: "0 bytes" },
];

const STEPS = [
  {
    number: "01",
    title: "Evidence in",
    body: "Drop receipt photos or a CSV statement. The server parses them in memory and prepares one private request.",
    icon: FileCheck2,
  },
  {
    number: "02",
    title: "Analysis inside the enclave",
    body: "A NEAR AI-hosted model categorizes every row and flags anomalies inside an Intel TDX VM with an NVIDIA TEE GPU.",
    icon: Cpu,
  },
  {
    number: "03",
    title: "Proof out",
    body: "The app verifies the TDX quote, GPU evidence, response hashes, and ECDSA signer before showing any result.",
    icon: ShieldCheck,
  },
];

const PRIVACY_ROWS = [
  {
    label: "Leaves your browser",
    value: "Only the files you choose, over TLS to cloud-api.near.ai",
    icon: ArrowUpRight,
  },
  {
    label: "Server memory",
    value: "Parsed once, held only until this response closes",
    icon: Cpu,
  },
  {
    label: "Written to disk",
    value: "Nothing · no database, no logs, no cache",
    icon: LockKeyhole,
  },
  {
    label: "Seen by the host",
    value: "Ciphertext and attestation metadata, never prompt plaintext",
    icon: KeyRound,
  },
];

const CHECKS = [
  "TEE-hosted model selected from /v1/models",
  "Fresh 256-bit nonce per request",
  "Intel TDX quote validated with dcap-qvl",
  "TDX report data binds the signing address + nonce",
  "NVIDIA NRAS overall and per-GPU verdicts",
  "GPU payload nonce matches the request nonce",
  "Compose manifest compared with mr_config",
  "Request + response SHA-256 match the signature",
  "ECDSA signer recovers to the attested TEE address",
  "No database, disk writes, content logs, or cache",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#audit"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-forest focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-card focus:shadow-lg"
      >
        Skip to audit workspace
      </a>
      <SiteHeader />

      <main id="top" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 paper-grid opacity-[0.32] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

          <div className="shell relative grid gap-14 pb-16 pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-20 lg:pt-20">
            <div className="animate-fade-up">
              <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-forest/15 bg-card/80 px-3.5 py-2 text-forest shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                NEAR Hackathon 2026 · Track 03
              </p>

              <h1 className="display-1 mt-6 max-w-[44rem] text-ink">
                Know where your money went.{" "}
                <span className="italic text-forest">Without telling anyone.</span>
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-[1.02rem] leading-relaxed text-ink-soft">
                Sealed Ledger reads receipts and bank statements inside NEAR AI
                Cloud&apos;s confidential TEE, categorizes every charge, finds the
                anomalies, and proves the analysis stayed private. No account. No
                storage. No plaintext outside the enclave.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href="#audit" className="btn btn-primary btn-lg">
                  Run a private audit
                  <ArrowDown className="h-4 w-4" />
                </a>
                <a href="#how-it-works" className="btn btn-secondary btn-lg">
                  See the proof chain
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="chip chip-accent">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Intel TDX
                </span>
                <span className="chip">
                  <Fingerprint className="h-3.5 w-3.5 text-forest" />
                  NVIDIA NRAS
                </span>
                <span className="chip">
                  <LockKeyhole className="h-3.5 w-3.5 text-forest" />
                  0 bytes retained
                </span>
                <span className="chip">
                  <TerminalSquare className="h-3.5 w-3.5 text-forest" />
                  near-ai-cloud skill
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[30rem] animate-fade-up animation-delay-200">
              <div className="pointer-events-none absolute -inset-6 rounded-[2.2rem] bg-mint/10 blur-2xl" />

              <div className="panel relative overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="flex items-center gap-3">
                    <SealMark className="h-10 w-10" />
                    <div>
                      <p className="text-[0.92rem] font-extrabold leading-none text-ink">
                        Audit certificate
                      </p>
                      <p className="mono-label mt-1.5 text-ink-faint">
                        <span className="hidden sm:inline">Sealed Ledger · </span>
                        TEE verified
                      </p>
                    </div>
                  </div>
                  <span className="stamp border-forest/35 px-2.5 py-1.5 font-mono text-[0.58rem] font-bold uppercase text-forest/80">
                    Verified
                  </span>
                </div>

                <div className="px-5 py-5">
                  <div className="flex items-center gap-3.5 rounded-xl border border-forest/15 bg-mint-soft/45 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-forest/20 bg-card text-forest">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.85rem] font-extrabold text-ink">
                        Hardware proof attached
                      </p>
                      <p className="mt-0.5 text-[0.72rem] text-ink-soft">
                        Intel TDX quote + NVIDIA GPU evidence
                      </p>
                    </div>
                    <span className="font-mono text-[0.68rem] font-semibold text-forest">
                      10/10
                    </span>
                  </div>

                  <dl className="mt-4 divide-y divide-line">
                    {PROOF_ROWS.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-4 py-2.5"
                      >
                        <dt className="text-[0.72rem] font-bold text-ink-soft">
                          {row.label}
                        </dt>
                        <dd className="truncate font-mono text-[0.64rem] font-medium text-ink-faint">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex items-center gap-2 overflow-hidden rounded-lg border border-line bg-paper/70 px-3 py-2">
                    <span className="mono-label shrink-0 text-ink-faint">
                      nonce
                    </span>
                    <span className="truncate font-mono text-[0.62rem] text-ink-soft">
                      8f3a91c4e7b2…c21b4e7a90aa
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line bg-paper/40 px-5 py-3">
                  <span className="mono-label text-ink-faint">
                    Fresh per audit
                  </span>
                  <span className="inline-flex items-center gap-1.5 mono-label text-forest">
                    <Check className="h-3 w-3" />
                    proof.json
                  </span>
                </div>
              </div>

              <span className="absolute -right-3 top-20 hidden h-9 w-9 items-center justify-center rounded-full border border-forest/15 bg-card text-forest shadow-sm sm:flex">
                <ScanLine className="h-4 w-4" />
              </span>
              <span className="absolute -left-3 bottom-16 hidden h-9 w-9 items-center justify-center rounded-full border border-forest/15 bg-card text-forest shadow-sm sm:flex">
                <Fingerprint className="h-4 w-4" />
              </span>
            </div>
          </div>
        </section>

        <div className="shell mt-12 sm:mt-16">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-forest">Private workspace</p>
              <h2 className="display-2 mt-2 text-ink">Run an audit.</h2>
            </div>
            <div className="max-w-md">
              <p className="text-[0.85rem] leading-relaxed text-ink-soft">
                Upload evidence, watch the enclave work, then inspect the proof.
                Your files are held in memory for one request and never stored.
              </p>
              <Link
                href="/app"
                className="mt-2 inline-flex items-center gap-1 text-[0.74rem] font-bold text-forest transition-colors hover:text-forest-deep"
              >
                Open focused workspace
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <AuditorApp />
        </div>

        <section
          id="how-it-works"
          className="shell mt-24 scroll-mt-24 sm:mt-28"
        >
          <SectionHeading
            eyebrow="How it works"
            title="A private auditor with a paper trail."
            description="Three moves: evidence in, analysis inside the enclave, proof out. Every claim in the result is backed by a check you can inspect."
          />

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="panel group p-5 transition-colors hover:border-forest/25 sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="mono-label text-ink-faint">
                      {step.number}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-forest/15 bg-mint-soft/45 text-forest transition-colors group-hover:bg-mint-soft">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <h3 className="title-3 mt-5 text-ink">{step.title}</h3>
                  <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-soft">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.25fr]">
            <div className="panel-dark relative overflow-hidden p-6 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-mint/20 blur-3xl" />
              <p className="eyebrow text-mint/65">The trust chain</p>
              <h3 className="mt-3 font-display text-[2.05rem] leading-none tracking-tight text-white">
                Hardware first.
                <br />
                Signature second.
              </h3>
              <p className="mt-4 max-w-md text-[0.82rem] leading-relaxed text-mint-soft/65">
                A signature alone proves someone signed bytes. Binding that
                signature to genuine Intel TDX and NVIDIA hardware is what makes
                the result verifiable.
              </p>
              <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-3.5">
                <p className="mono-label text-mint/50">Chain of trust</p>
                <p className="mt-2 font-mono text-[0.68rem] leading-relaxed text-mint-soft/75">
                  NVIDIA GPU → Intel TDX quote → signing address → chat
                  signature → exact request + response bytes
                </p>
              </div>
            </div>

            <div className="panel p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-forest">Checklist</p>
                  <h3 className="title-3 mt-2 text-ink">
                    What the Verified panel proves
                  </h3>
                </div>
                <span className="chip shrink-0">{CHECKS.length} checks</span>
              </div>
              <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {CHECKS.map((check) => (
                  <li
                    key={check}
                    className="flex items-start gap-2.5 text-[0.76rem] leading-relaxed text-ink-soft"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-soft/80 text-forest">
                      <Check className="h-3 w-3" />
                    </span>
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="privacy" className="shell mt-24 scroll-mt-24 sm:mt-28">
          <SectionHeading
            eyebrow="Privacy design"
            title="The best retention policy is having nothing to retain."
            description="The server processes your files, then forgets them. The only external destination is the NEAR AI Cloud TEE."
          />

          <div className="mt-8 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="panel overflow-hidden">
              <div className="grid gap-px bg-line sm:grid-cols-2">
                {PRIVACY_ROWS.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="bg-card p-5 sm:p-6">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-forest/15 bg-mint-soft/45 text-forest">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="ui-label mt-4">{row.label}</p>
                      <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink">
                        {row.value}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-line bg-paper/45 px-5 py-4 sm:px-6">
                <p className="text-[0.76rem] leading-relaxed text-ink-soft">
                  <span className="font-bold text-ink">No-retention in code:</span>{" "}
                  the route handler holds uploads in a local array, passes them to
                  the TEE request, returns the result, and ends. There is no
                  database client, no filesystem write, no content logger, and no
                  response cache.
                </p>
              </div>
            </div>

            <div className="panel ledger-lines p-6 sm:p-7">
              <p className="eyebrow text-amber">Built for Track 03</p>
              <h3 className="title-3 mt-2 text-ink">
                Privacy &amp; Private AI, end to end
              </h3>
              <ul className="mt-5 space-y-3">
                {[
                  "OpenAI-compatible NEAR AI Cloud API at cloud-api.near.ai/v1",
                  "TEE-hosted model chosen from /v1/models",
                  "Fresh-nonce attestation rendered as a Verified panel",
                  "Zero server-side retention, documented in code and README",
                  "Fictional samples so judges never need real data",
                  "Minimal verification script before the UI, using the near-ai-cloud skill",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[0.78rem] leading-relaxed text-ink-soft"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={SITE.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-[0.76rem] font-bold text-forest transition-colors hover:text-forest-deep"
              >
                NEAR AI Cloud quickstart
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
