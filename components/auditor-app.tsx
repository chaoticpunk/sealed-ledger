"use client";

import { AlertCircle, LockKeyhole, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProgressRail, type ProgressState } from "@/components/progress-rail";
import { ResultsView } from "@/components/results-view";
import { UploadPanel, type UploadItem } from "@/components/upload-panel";
import { cn } from "@/lib/format";
import {
  MAX_IMAGES,
  MAX_TOTAL_BYTES,
  isCsvFile,
  isImageFile,
  prepareFile,
  safeFileName,
} from "@/lib/files";
import type { ProgressEvent } from "@/lib/progress";
import type { AuditResponse } from "@/lib/response";

type Phase = "idle" | "running" | "done" | "error";

interface Health {
  configured: boolean;
  model: string;
  listed: boolean;
  teeHosted: boolean;
  owner?: string;
  error?: string;
  baseUrl: string;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function makeItem(file: File): Promise<UploadItem> {
  const prepared = await prepareFile(file);
  const kind = isImageFile(prepared) ? "image" : "csv";
  return {
    id: makeId(),
    file: prepared,
    kind,
    previewUrl: kind === "image" ? URL.createObjectURL(prepared) : undefined,
  };
}

export function AuditorApp() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<ProgressState>({});
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const itemsRef = useRef<UploadItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json() as Promise<Health>)
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) {
          setHealth({
            configured: false,
            model: "unknown",
            listed: false,
            teeHosted: false,
            error: "Could not reach the health endpoint",
            baseUrl: "",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - started);
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!result) return;
    const target = document.getElementById("verification");
    if (target) {
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [result]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const supported = files.filter(
        (file) => isImageFile(file) || isCsvFile(file),
      );

      if (supported.length === 0) {
        setError("Use PNG, JPG, WebP, or CSV files.");
        return;
      }

      const prepared = await Promise.all(supported.map(makeItem));
      const next = [...itemsRef.current, ...prepared];
      const images = next.filter((item) => item.kind === "image").length;
      const bytes = next.reduce((sum, item) => sum + item.file.size, 0);

      if (images > MAX_IMAGES) {
        for (const item of prepared) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setError(`Upload at most ${MAX_IMAGES} receipt images.`);
        return;
      }

      if (bytes > MAX_TOTAL_BYTES) {
        for (const item of prepared) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setError("Total upload is larger than 12 MB.");
        return;
      }

      setError(null);
      setItems(next);
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    const target = itemsRef.current.find((item) => item.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const clearItems = useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    setItems([]);
  }, []);

  const reset = useCallback(() => {
    clearItems();
    setPhase("idle");
    setResult(null);
    setError(null);
    setProgress({});
    setElapsedMs(0);
  }, [clearItems]);

  const loadSample = useCallback(async () => {
    setSampleLoading(true);
    setError(null);

    try {
      const manifestResponse = await fetch("/samples/samples.json", {
        cache: "no-store",
      });
      if (!manifestResponse.ok) throw new Error("sample manifest unavailable");

      const manifest = (await manifestResponse.json()) as Array<{
        files: string[];
      }>;

      const names = manifest.flatMap((entry) => entry.files);
      const files = await Promise.all(
        names.map(async (name) => {
          const response = await fetch(`/samples/${name}`, {
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`sample ${name} unavailable`);
          const blob = await response.blob();
          const type = name.toLowerCase().endsWith(".csv")
            ? "text/csv"
            : "image/png";
          return new File([blob], safeFileName(name), { type });
        }),
      );

      const prepared = await Promise.all(files.map(makeItem));

      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      setItems(prepared);

      setPhase("idle");
      setResult(null);
      setProgress({});
    } catch {
      setError(
        "Could not load the fictional sample. Run `npm run samples` and try again.",
      );
    } finally {
      setSampleLoading(false);
    }
  }, []);

  const runAudit = useCallback(async () => {
    if (!health?.configured) {
      setError(
        "NEAR AI Cloud is not configured. Add NEARAI_CLOUD_API_KEY to .env.local and restart the server.",
      );
      setPhase("error");
      return;
    }

    if (items.length === 0) {
      setError("Add at least one receipt or statement first.");
      return;
    }

    setPhase("running");
    setResult(null);
    setError(null);
    setProgress({});
    setElapsedMs(0);

    let settled = false;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const form = new FormData();
      for (const item of items) {
        form.append("files", item.file, item.file.name);
      }

      const response = await fetch("/api/audit", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`The audit endpoint returned HTTP ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);

          if (line) {
            let payload: {
              type?: string;
              event?: ProgressEvent;
              data?: AuditResponse;
              message?: string;
            };

            try {
              payload = JSON.parse(line);
            } catch {
              throw new Error("The audit stream contained malformed data.");
            }

            if (payload.type === "progress" && payload.event) {
              const event = payload.event;
              setProgress((previous) => ({
                ...previous,
                [event.step]: event,
              }));
            }

            if (payload.type === "result" && payload.data) {
              setResult(payload.data);
              setPhase("done");
              settled = true;
            }

            if (payload.type === "error") {
              setError(payload.message ?? "The private audit failed.");
              setPhase("error");
              settled = true;
            }
          }

          newline = buffer.indexOf("\n");
        }
      }

      if (!settled) {
        setError("The audit stream ended before a result was returned.");
        setPhase("error");
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setResult(null);
        setProgress({});
        setElapsedMs(0);
        setPhase("idle");
        setError("Audit cancelled. No files were stored.");
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "The private audit could not be completed.",
        );
        setPhase("error");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [health?.configured, items]);

  const cancelAudit = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const downloadProof = useCallback(() => {
    if (!result) return;

    const verification = result.verification;
    const proof = {
      project: "Sealed Ledger",
      track: "Privacy & Private AI — NEAR Hackathon 2026",
      generatedAt: new Date().toISOString(),
      model: verification.model,
      nonce: verification.nonce,
      attestedAt: verification.attestedAt,
      signatureKind: verification.signatureKind,
      signingAddress: verification.signingAddress,
      signedText: verification.signature.signedText,
      requestHash: verification.hashes.request,
      responseHash: verification.hashes.response,
      attestation: verification.attestation,
      checks: verification.checks.map((check) => ({
        id: check.id,
        label: check.label,
        status: check.status,
        detail: check.detail,
      })),
      retention: "none",
      note: "This proof contains no receipts, statement rows, or personal data.",
    };

    const blob = new Blob([JSON.stringify(proof, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sealed-ledger-proof-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }, [result]);

  const configured = health?.configured ?? false;
  const running = phase === "running";

  return (
    <section id="audit" className="scroll-mt-24" aria-busy={running}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "chip",
            configured ? "chip-accent" : "chip-danger",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {configured ? "TEE model ready" : "API key required"}
        </span>
        {health?.model && (
          <span className="chip font-mono">{health.model}</span>
        )}
        {health?.owner && <span className="chip">owned by {health.owner}</span>}
        <span className="chip">
          <LockKeyhole className="h-3.5 w-3.5 text-forest" />
          0 bytes retained
        </span>
        <span className="ml-auto hidden font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-faint sm:block">
          Fresh 256-bit nonce per run
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.16fr_0.84fr]">
        <UploadPanel
          items={items}
          configured={configured}
          running={running}
          sampleLoading={sampleLoading}
          model={health?.model}
          healthError={health?.error}
          onFiles={addFiles}
          onRemove={removeItem}
          onClear={clearItems}
          onLoadSample={loadSample}
          onRun={runAudit}
          onCancel={cancelAudit}
        />

        <ProgressRail
          progress={progress}
          running={running}
          elapsedMs={elapsedMs}
          hasFiles={items.length > 0}
        />
      </div>

      {health && health.listed && !health.teeHosted && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-ember/25 bg-ember-soft/40 px-4 py-3 text-[0.75rem] text-ember">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The configured model <code className="font-mono">{health.model}</code>{" "}
            is owned by <code className="font-mono">{health.owner ?? "unknown"}</code>{" "}
            and is not a NEAR AI-hosted TEE model. Set{" "}
            <code className="font-mono">NEARAI_MODEL</code> to a model owned by{" "}
            <code className="font-mono">nearai</code>.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-ember/20 bg-ember-soft/60 px-4 py-3.5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
            <div>
              <p className="text-[0.84rem] font-bold text-ember">
                The audit did not finish
              </p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-soft">
                {error}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {configured && items.length > 0 && !running && (
              <button
                type="button"
                onClick={runAudit}
                className="btn btn-secondary btn-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-card hover:text-ink"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={cn("mt-6 animate-fade-up")}>
          <ResultsView
            result={result}
            onReset={reset}
            onDownloadProof={downloadProof}
          />
        </div>
      )}
    </section>
  );
}
