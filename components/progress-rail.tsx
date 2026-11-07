"use client";

import { AlertTriangle, Check, Loader2, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/format";
import {
  PIPELINE_STEPS,
  type PipelineStep,
  type ProgressEvent,
} from "@/lib/progress";

export type ProgressState = Partial<Record<PipelineStep, ProgressEvent>>;

export function ProgressRail({
  progress,
  running,
  elapsedMs,
  hasFiles = false,
}: {
  progress: ProgressState;
  running: boolean;
  elapsedMs: number;
  hasFiles?: boolean;
}) {
  const doneCount = PIPELINE_STEPS.filter(
    (step) => progress[step.id]?.status === "done",
  ).length;
  const hasError = PIPELINE_STEPS.some(
    (step) => progress[step.id]?.status === "error",
  );

  return (
    <div className="panel flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-forest">02 · Proof</p>
          <h3 className="title-3 mt-2 text-ink">Live verification</h3>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-soft">
            Every step leaves a check in the certificate.
          </p>
        </div>
        <span className="chip shrink-0 font-mono">
          {running ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {(elapsedMs / 1000).toFixed(1)}s
            </>
          ) : (
            <>
              <LockKeyhole className="h-3 w-3 text-forest" />
              TDX
            </>
          )}
        </span>
      </div>

      <div
        className="mt-5 flex items-center justify-between rounded-xl border border-line bg-paper/45 px-3.5 py-2.5"
        aria-live="polite"
      >
        <span className="text-[0.7rem] font-bold text-ink-soft">
          {hasError
            ? "Verification stopped"
            : running
              ? "Attestation in progress"
              : doneCount === PIPELINE_STEPS.length
                ? "All checks complete"
                : hasFiles
                  ? "Ready to run"
                  : "Waiting for evidence"}
        </span>
        <span className="font-mono text-[0.62rem] text-ink-faint">
          {doneCount}/{PIPELINE_STEPS.length}
        </span>
      </div>

      <ol className="mt-5">
        {PIPELINE_STEPS.map((step, index) => {
          const event = progress[step.id];
          const status = event?.status ?? "pending";
          const isLast = index === PIPELINE_STEPS.length - 1;

          return (
            <li
              key={step.id}
              className={cn(
                "relative -mx-2 flex gap-3 rounded-xl px-2 py-2.5",
                status === "active" && "bg-mint-soft/30",
              )}
            >
              {!isLast && (
                <span
                  className={cn(
                    "absolute left-[1.32rem] top-[2.4rem] h-[calc(100%-1.5rem)] w-px",
                    status === "done" ? "bg-forest/25" : "bg-line",
                  )}
                />
              )}

              <span
                className={cn(
                  "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-bold",
                  status === "done" && "border-forest bg-forest text-card",
                  status === "active" &&
                    "border-forest/40 bg-mint-soft text-forest",
                  status === "error" &&
                    "border-ember/40 bg-ember-soft text-ember",
                  status === "pending" && "border-line bg-card text-ink-faint",
                )}
              >
                {status === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : status === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : status === "error" ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>

              <span className="min-w-0 pt-0.5">
                <span
                  className={cn(
                    "block text-[0.8rem] font-bold",
                    status === "pending" ? "text-ink-faint" : "text-ink",
                  )}
                >
                  {step.label}
                </span>
                <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-ink-faint">
                  {event?.detail ?? step.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto border-t border-line pt-4">
        <p className="ui-label">Proof stack</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip !min-h-0 !px-2 !py-1 !text-[0.6rem]">
            256-bit nonce
          </span>
          <span className="chip !min-h-0 !px-2 !py-1 !text-[0.6rem]">
            dcap-qvl
          </span>
          <span className="chip !min-h-0 !px-2 !py-1 !text-[0.6rem]">
            NVIDIA NRAS
          </span>
          <span className="chip !min-h-0 !px-2 !py-1 !text-[0.6rem]">
            ECDSA recovery
          </span>
        </div>
      </div>
    </div>
  );
}
