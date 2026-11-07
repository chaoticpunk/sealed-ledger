"use client";

import {
  ArrowRight,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { prettyBytes } from "@/lib/files";

export interface UploadItem {
  id: string;
  file: File;
  kind: "image" | "csv";
  previewUrl?: string;
}

export function UploadPanel({
  items,
  configured,
  running,
  sampleLoading,
  model,
  healthError,
  onFiles,
  onRemove,
  onClear,
  onLoadSample,
  onRun,
  onCancel,
}: {
  items: UploadItem[];
  configured: boolean;
  running: boolean;
  sampleLoading: boolean;
  model?: string;
  healthError?: string;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onLoadSample: () => void;
  onRun: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const images = items.filter((item) => item.kind === "image").length;
  const csv = items.filter((item) => item.kind === "csv").length;

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) {
      onFiles(Array.from(event.dataTransfer.files));
    }
  }

  const disabled = items.length === 0 || running || !configured;

  return (
    <div className="panel flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-forest">01 · Evidence</p>
          <h3 className="title-3 mt-2 text-ink">Upload receipts &amp; statements</h3>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-soft">
            Receipt photos or a bank CSV. Parsed in memory, never written to
            disk.
          </p>
        </div>
        <span className="chip chip-accent shrink-0">
          <ShieldCheck className="h-3.5 w-3.5" />
          In-memory
        </span>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload receipt images or a CSV statement"
        data-dragging={dragging}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="dropzone mt-5"
      >
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card shadow-sm">
          <UploadCloud className="h-6 w-6 text-forest" />
          <span className="absolute inset-0 rounded-2xl border border-mint/40 animate-pulse-soft" />
        </div>
        <p className="mt-4 text-[0.95rem] font-extrabold text-ink">
          Drop files here, or{" "}
          <span className="text-forest underline decoration-forest/30 underline-offset-4">
            browse
          </span>
        </p>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-faint">
          PNG, JPG, WebP receipts · CSV statement
        </p>
        <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
          6 images · 12 MB · 0 bytes stored
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".csv,text/csv,image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) {
            onFiles(Array.from(event.target.files));
            event.target.value = "";
          }
        }}
      />

      {items.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.72rem] font-semibold text-ink-faint">
              {items.length} file{items.length === 1 ? "" : "s"} · {images}{" "}
              image{images === 1 ? "" : "s"} · {csv} CSV · {prettyBytes(totalBytes)}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-[0.72rem] font-bold text-ink-soft transition-colors hover:text-ember"
            >
              Clear all
            </button>
          </div>

          <ul className="mt-2.5 max-h-56 space-y-2 overflow-y-auto pr-0.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-card px-2.5 py-2"
              >
                {item.kind === "image" && item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper">
                    <FileSpreadsheet className="h-4.5 w-4.5 text-forest" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8rem] font-bold text-ink">
                    {item.file.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.08em] text-ink-faint">
                    {item.kind === "image" ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <FileSpreadsheet className="h-3 w-3" />
                    )}
                    {item.kind === "image" ? "Receipt" : "Statement"} ·{" "}
                    {prettyBytes(item.file.size)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-ember-soft hover:text-ember"
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-amber/20 bg-amber-soft/45 p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] font-extrabold text-ink">
                No data? Use the fictional sample.
              </p>
              <p className="mt-0.5 text-[0.72rem] leading-relaxed text-ink-soft">
                A 24-row September statement plus five receipts, seeded with
                duplicates, a subscription jump, and a late-night charge.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLoadSample}
            disabled={sampleLoading}
            className="btn btn-secondary btn-sm w-full shrink-0 sm:w-auto"
          >
            {sampleLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Load sample"
            )}
          </button>
        </div>
      </div>

      {!configured && (
        <div className="mt-3 rounded-xl border border-ember/20 bg-ember-soft/55 px-3.5 py-3 text-[0.74rem] leading-relaxed text-ember">
          {healthError ? (
            <>The server health check failed: {healthError}.</>
          ) : (
            <>
              Server key missing. Add{" "}
              <code className="font-mono text-[0.7rem]">
                NEARAI_CLOUD_API_KEY
              </code>{" "}
              to <code className="font-mono text-[0.7rem]">.env.local</code> and
              restart <code className="font-mono text-[0.7rem]">npm run dev</code>.
            </>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-line pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-[0.7rem] leading-relaxed text-ink-faint">
            <p className="flex items-center gap-1.5 font-bold text-ink-soft">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
              <span className="truncate">
                {model ? model : "TEE model selected at runtime"}
              </span>
            </p>
            <p className="mt-1">
              {running
                ? "Attestation and analysis in progress…"
                : items.length === 0
                  ? "Add a receipt or statement to run."
                  : configured
                    ? "Ready when you are."
                    : "Configure the API key to run."}
            </p>
          </div>
          {running ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                disabled
                aria-busy="true"
                className="btn btn-primary flex-1 sm:flex-none"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Auditing…
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRun}
              disabled={disabled}
              className="btn btn-primary w-full sm:w-auto"
            >
              Run private audit
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
