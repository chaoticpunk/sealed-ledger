"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[0.65rem] font-bold text-ink-soft transition-colors hover:border-forest/40 hover:text-forest"
      aria-label={`${label}: ${value.slice(0, 24)}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-forest" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
