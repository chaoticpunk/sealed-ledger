import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";

import { cn } from "@/lib/format";
import type { CheckStatus } from "@/lib/verification/types";

export function StatusPill({
  status,
  className,
}: {
  status: CheckStatus;
  className?: string;
}) {
  const config = {
    pass: {
      label: "Pass",
      icon: CheckCircle2,
      classes: "border-forest/20 bg-mint-soft/70 text-forest",
    },
    fail: {
      label: "Fail",
      icon: AlertTriangle,
      classes: "border-ember/25 bg-ember-soft/80 text-ember",
    },
    skip: {
      label: "Skipped",
      icon: MinusCircle,
      classes: "border-line bg-paper-deep/50 text-ink-faint",
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em]",
        config.classes,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "mint" | "ember";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel-flat rounded-xl border border-line bg-card px-4 py-4",
        className,
      )}
    >
      <p className="text-[0.68rem] font-bold leading-tight text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "stat-value mt-2",
          tone === "mint" && "text-forest",
          tone === "ember" && "text-ember",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-[0.68rem] leading-relaxed text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", "max-w-2xl")}>
      <p className="eyebrow text-forest">{eyebrow}</p>
      <h2 className="display-2 mt-3 text-ink">{title}</h2>
      {description && (
        <p className="mt-4 max-w-xl text-[0.92rem] leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}
