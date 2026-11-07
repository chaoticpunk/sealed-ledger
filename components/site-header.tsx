import Link from "next/link";
import { ArrowRight, ArrowUpRight, GitBranch, ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/logo";
import { SITE } from "@/lib/site";

export function SiteHeader({
  workspaceHref = "/app",
}: {
  workspaceHref?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-xl">
      <div className="shell flex h-[4.35rem] items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label="Sealed Ledger home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-7 text-[0.82rem] font-semibold text-ink-soft lg:flex">
          <Link
            className="transition-colors hover:text-ink"
            href={workspaceHref}
          >
            Workspace
          </Link>
          <Link
            className="transition-colors hover:text-ink"
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link className="transition-colors hover:text-ink" href="/#privacy">
            Privacy
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-forest/15 bg-mint-soft/50 px-3 py-1.5 text-[0.7rem] font-bold text-forest md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
            </span>
            NEAR AI Cloud TEE
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          {SITE.repoUrl ? (
            <a
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
              href={SITE.repoUrl}
              target="_blank"
              rel="noreferrer"
            >
              <GitBranch className="h-4 w-4" />
              Source
            </a>
          ) : (
            <a
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
              href={SITE.docsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Docs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
          <Link href={workspaceHref} className="btn btn-primary btn-sm">
            Start audit
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
