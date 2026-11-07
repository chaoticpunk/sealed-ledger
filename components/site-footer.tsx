import { ArrowUpRight, LockKeyhole } from "lucide-react";

import { Wordmark } from "@/components/logo";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-deep/35">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[0.84rem] leading-relaxed text-ink-soft">
            A private expense auditor built for NEAR Hackathon 2026, Privacy &amp;
            Private AI. Receipts are analyzed inside NEAR AI Cloud&apos;s
            confidential TEEs and every answer is checked against hardware
            attestation.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[0.7rem] font-semibold text-ink-soft">
            <LockKeyhole className="h-3.5 w-3.5 text-forest" />
            No accounts. No storage. No plaintext leaves the enclave.
          </p>
        </div>

        <div>
          <p className="ui-label">Verify it yourself</p>
          <ul className="mt-4 space-y-3 text-[0.84rem] text-ink-soft">
            <li>
              <a
                className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                href={SITE.verificationUrl}
                target="_blank"
                rel="noreferrer"
              >
                NEAR AI verification center
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                href={SITE.intelExplorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                Intel TDX attestation explorer
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
            <li>
              <a
                className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                href={SITE.docsUrl}
                target="_blank"
                rel="noreferrer"
              >
                NEAR AI Cloud docs
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="ui-label">Hackathon</p>
          <ul className="mt-4 space-y-3 text-[0.84rem] text-ink-soft">
            <li>
              <a
                className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                href={SITE.hackathonUrl}
                target="_blank"
                rel="noreferrer"
              >
                NEAR Hackathon 2026
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
            <li>Track 03 — Privacy &amp; Private AI</li>
            <li>
              {SITE.repoUrl ? (
                <a
                  className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                  href={SITE.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source repository
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-ink-faint">Source repository</span>
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="shell flex flex-col gap-2 py-5 text-[0.7rem] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            All sample documents are fictional. Never upload real financial data
            to a demo deployment you do not control.
          </p>
          <p className="font-mono uppercase tracking-[0.14em]">
            NEAR AI Cloud · Intel TDX · NVIDIA NRAS
          </p>
        </div>
      </div>
    </footer>
  );
}
