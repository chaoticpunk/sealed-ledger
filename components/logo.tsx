import { cn } from "@/lib/format";

export function SealMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("h-9 w-9", className)}
    >
      <circle cx="24" cy="24" r="22" fill="#0e3b2e" />
      <circle
        cx="24"
        cy="24"
        r="17.5"
        stroke="#35d399"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.65"
      />
      <path d="M15 19h13" stroke="#fbf8f1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15 24h9" stroke="#fbf8f1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15 29h6" stroke="#fbf8f1" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="m27 28.5 3 3 6-7"
        stroke="#35d399"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <SealMark className={compact ? "h-8 w-8" : "h-9 w-9"} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.45rem] tracking-[-0.02em] text-ink">
          Sealed Ledger
        </span>
        {!compact && (
          <span className="mt-1 hidden font-mono text-[9px] uppercase tracking-[0.24em] text-ink-faint sm:block">
            private audit · TEE proof
          </span>
        )}
      </span>
    </span>
  );
}
