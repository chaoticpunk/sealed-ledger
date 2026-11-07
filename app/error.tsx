"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Wordmark } from "@/components/logo";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-lg p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <Wordmark />
        </div>

        <span className="mt-8 inline-flex h-12 w-12 items-center justify-center rounded-full border border-ember/25 bg-ember-soft/60 text-ember">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="eyebrow mt-4 text-ember">Unexpected error</p>
        <h1 className="display-2 mt-3 text-ink">
          The ledger could not finish that page.
        </h1>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-soft">
          No audit data is stored, so nothing was retained from this request.
          Try loading the page again, or return to the workspace.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            Back to workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
