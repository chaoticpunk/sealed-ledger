import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AuditorApp } from "@/components/auditor-app";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Workspace — Sealed Ledger",
  description:
    "Run a private expense audit inside NEAR AI Cloud's confidential TEE. Upload receipts or a statement and inspect the cryptographic proof.",
};

export default function WorkspacePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader workspaceHref="#audit" />

      <main className="flex-1">
        <div className="shell py-10 sm:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.74rem] font-bold text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to overview
          </Link>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-forest">Private workspace</p>
              <h1 className="display-2 mt-2 text-ink">Audit a ledger.</h1>
              <p className="mt-3 max-w-xl text-[0.9rem] leading-relaxed text-ink-soft">
                Upload receipts or a statement. The enclave does the analysis;
                the certificate proves it. Files are held in memory for one
                request and never stored.
              </p>
            </div>
          </div>

          <div className="mt-7">
            <AuditorApp />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.74rem] text-ink-faint">
            <span>Need the full story?</span>
            <Link
              href="/#how-it-works"
              className="font-bold text-forest transition-colors hover:text-forest-deep"
            >
              How verification works
            </Link>
            <Link
              href="/#privacy"
              className="font-bold text-forest transition-colors hover:text-forest-deep"
            >
              Privacy design
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
