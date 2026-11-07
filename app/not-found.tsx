import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Wordmark } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-lg p-8 text-center sm:p-10">
        <div className="flex justify-center">
          <Wordmark />
        </div>

        <p className="eyebrow mt-8 text-forest">404 · Page not found</p>
        <h1 className="display-2 mt-3 text-ink">
          This entry is not in the ledger.
        </h1>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-soft">
          The page you requested does not exist or has moved. Your files were
          never stored, so there is nothing to recover here.
        </p>

        <Link href="/" className="btn btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Sealed Ledger
        </Link>
      </div>
    </main>
  );
}
