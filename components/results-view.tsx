"use client";

import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  FileDown,
  Landmark,
  Layers,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { VerificationPanel } from "@/components/verification-panel";
import { Stat } from "@/components/ui";
import { cn, formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { AuditResponse } from "@/lib/response";
import type { AnomalySeverity, Transaction } from "@/lib/audit/types";

const SEVERITY_CLASSES: Record<AnomalySeverity, string> = {
  high: "border-ember/25 bg-ember-soft/60 text-ember",
  medium: "border-amber/25 bg-amber-soft/60 text-amber",
  low: "border-line bg-paper-deep/50 text-ink-soft",
};

const SEVERITY_ACCENT: Record<AnomalySeverity, string> = {
  high: "border-l-ember/70",
  medium: "border-l-amber/60",
  low: "border-l-line-strong",
};

const SOURCE_ICON = {
  statement: Landmark,
  receipt: Receipt,
  both: Layers,
};

function csvCell(value: string | number | undefined | null): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function SourceBadge({ source }: { source: Transaction["source"] }) {
  const Icon = SOURCE_ICON[source];
  const label =
    source === "statement"
      ? "statement"
      : source === "receipt"
        ? "receipt"
        : "both";

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-paper/70 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-ink-faint">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function CategoryBar({
  name,
  amount,
  count,
  share,
  currency,
}: {
  name: string;
  amount: number;
  count: number;
  share: number;
  currency: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 truncate text-[0.82rem] font-bold text-ink">
          {name}
        </p>
        <div className="flex shrink-0 items-baseline gap-2.5">
          <p className="font-mono text-[0.74rem] font-semibold text-ink">
            {formatMoney(amount, currency, { cents: false })}
          </p>
          <p className="w-9 text-right font-mono text-[0.66rem] text-ink-faint">
            {formatPercent(share)}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep/80">
        <div
          className="h-full rounded-full bg-forest transition-[width] duration-700"
          style={{ width: `${Math.max(share * 100, 1.5)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[0.64rem] text-ink-faint">
        {count} transaction{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function ResultsView({
  result,
  onReset,
  onDownloadProof,
}: {
  result: AuditResponse;
  onReset: () => void;
  onDownloadProof: () => void;
}) {
  const { analysis, verification, warnings } = result;
  const maxAnomalySeverity = analysis.anomalies[0]?.severity;
  const [filter, setFilter] = useState<"all" | "flagged">("all");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleTransactions = analysis.transactions.filter((transaction) => {
    if (filter === "flagged" && !transaction.anomaly) return false;
    if (!normalizedQuery) return true;

    return [
      transaction.merchant,
      transaction.category,
      transaction.description,
      transaction.receiptFile,
      transaction.currency,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  function exportCsv() {
    const header = [
      "Date",
      "Time",
      "Merchant",
      "Category",
      "Source",
      "Direction",
      "Amount",
      "Currency",
      "Anomaly severity",
      "Anomaly reasons",
    ];
    const rows = analysis.transactions.map((transaction) => [
      transaction.date,
      transaction.time ?? "",
      transaction.merchant,
      transaction.category,
      transaction.source,
      transaction.direction,
      transaction.amount.toFixed(2),
      transaction.currency,
      transaction.anomaly?.severity ?? "",
      transaction.anomaly?.reasons.join(" | ") ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const period =
      analysis.period.start && analysis.period.end
        ? `${analysis.period.start}_${analysis.period.end}`
        : "audit";
    anchor.href = url;
    anchor.download = `sealed-ledger-${period}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <div className="space-y-5">
      <VerificationPanel
        verification={verification}
        onDownloadProof={onDownloadProof}
      />

      <section id="results" className="scroll-mt-28">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow text-forest">Audit result</p>
            <h2 className="display-2 mt-2 text-ink">The ledger, decoded.</h2>
            <p className="mt-3 max-w-2xl text-[0.92rem] leading-relaxed text-ink-soft">
              {analysis.summary}
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="btn btn-secondary btn-sm shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Run another
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          <Stat
            label="Spend audited"
            value={formatMoney(analysis.totals.spend, analysis.currency, {
              cents: false,
            })}
            hint={`${analysis.sources.statementRows} statement rows + ${analysis.sources.receipts} receipts`}
            className="col-span-2 lg:col-span-1"
          />
          <Stat
            label="Income"
            value={formatMoney(analysis.totals.income, analysis.currency, {
              cents: false,
            })}
            hint="Credits in the statement"
            tone="mint"
          />
          <Stat
            label="Net"
            value={formatMoney(analysis.totals.net, analysis.currency, {
              cents: false,
              signed: true,
            })}
            hint="Income minus discretionary spend"
            tone={analysis.totals.net >= 0 ? "mint" : "ember"}
          />
          <Stat
            label="Anomalies"
            value={String(analysis.totals.anomalies)}
            hint="Model + deterministic rules"
            tone={analysis.totals.anomalies > 0 ? "ember" : "mint"}
          />
          <Stat
            label="Reconciled"
            value={`${analysis.sources.matchedReceipts}/${analysis.sources.receipts}`}
            hint="Receipts matched to statement rows"
          />
        </div>

        {warnings.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber/20 bg-amber-soft/40 px-4 py-3 text-[0.74rem] leading-relaxed text-ink-soft">
            <p className="font-bold text-amber">Parser notes</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.slice(0, 6).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.12fr]">
          <div className="panel p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-forest">By category</p>
                <h3 className="title-3 mt-2 text-ink">Where the money went</h3>
              </div>
              <span className="chip shrink-0">
                {analysis.categories.length} categories
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {analysis.categories.map((category) => (
                <CategoryBar
                  key={category.name}
                  name={category.name}
                  amount={category.amount}
                  count={category.count}
                  share={category.share}
                  currency={analysis.currency}
                />
              ))}
              {analysis.categories.length === 0 && (
                <p className="text-sm text-ink-faint">
                  No debit transactions were found.
                </p>
              )}
            </div>
          </div>

          <div className="panel flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-ember">Needs a look</p>
                <h3 className="title-3 mt-2 text-ink">Anomaly review</h3>
              </div>
              <span
                className={cn(
                  "chip !border-transparent shrink-0",
                  maxAnomalySeverity
                    ? SEVERITY_CLASSES[maxAnomalySeverity]
                    : "bg-mint-soft/60 text-forest",
                )}
              >
                {analysis.anomalies.length > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    {analysis.anomalies.length} flagged
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    clean
                  </>
                )}
              </span>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5 lg:max-h-[40rem]">
              {analysis.anomalies.map((anomaly) => (
                <div
                  key={anomaly.transactionId}
                  className={cn(
                    "rounded-xl border border-line border-l-2 bg-card p-3.5",
                    SEVERITY_ACCENT[anomaly.severity],
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.84rem] font-bold text-ink">
                        {anomaly.merchant}
                      </p>
                      <p className="mt-0.5 text-[0.66rem] text-ink-faint">
                        {formatDate(anomaly.date)} · {anomaly.category}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.08em]",
                        SEVERITY_CLASSES[anomaly.severity],
                      )}
                    >
                      {anomaly.severity}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <p className="font-mono text-[0.92rem] font-semibold text-ink">
                      {formatMoney(anomaly.amount, anomaly.currency)}
                    </p>
                    <p className="text-[0.58rem] uppercase tracking-[0.08em] text-ink-faint">
                      {anomaly.source === "both"
                        ? "model + rules"
                        : anomaly.source}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {anomaly.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex gap-2 text-[0.72rem] leading-relaxed text-ink-soft"
                      >
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ember/60" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {analysis.anomalies.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-12 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-soft/70 text-forest">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-ink">
                    No material anomalies
                  </p>
                  <p className="mt-1 max-w-xs text-[0.74rem] text-ink-faint">
                    The model and the deterministic rules both found nothing
                    worth flagging.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-[0.68rem] text-ink-faint">
                {analysis.anomalies.length} of {analysis.transactions.length}{" "}
                transactions flagged
              </p>
              <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
                model + rules
              </span>
            </div>
          </div>
        </div>

        <div className="panel mt-3 overflow-hidden">
          <div className="flex flex-col justify-between gap-3 p-5 pb-4 sm:flex-row sm:items-end sm:p-6 sm:pb-4">
            <div>
              <p className="eyebrow text-forest">Ledger</p>
              <h3 className="title-3 mt-2 text-ink">Every transaction</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-52">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search merchant or category"
                  aria-label="Search transactions"
                  className="h-9 w-full rounded-lg border border-line bg-paper/60 pl-8 pr-3 text-[0.72rem] font-medium text-ink placeholder:text-ink-faint focus:border-forest/40 focus:bg-card"
                />
              </div>
              <div className="flex rounded-lg border border-line bg-paper/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  aria-pressed={filter === "all"}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[0.7rem] font-bold transition-colors",
                    filter === "all"
                      ? "bg-card text-ink shadow-sm"
                      : "text-ink-faint hover:text-ink",
                  )}
                >
                  All {analysis.transactions.length}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("flagged")}
                  aria-pressed={filter === "flagged"}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[0.7rem] font-bold transition-colors",
                    filter === "flagged"
                      ? "bg-card text-ink shadow-sm"
                      : "text-ink-faint hover:text-ink",
                  )}
                >
                  Flagged {analysis.anomalies.length}
                </button>
              </div>
              <button
                type="button"
                onClick={exportCsv}
                className="btn btn-secondary btn-sm"
              >
                <FileDown className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <span className="hidden text-[0.64rem] text-ink-faint sm:inline">
                {analysis.period.start} → {analysis.period.end}
              </span>
            </div>
          </div>

          <div className="max-h-[42rem] overflow-auto border-t border-line">
            <table className="data-table hidden w-full min-w-[760px] border-collapse text-left md:table">
              <thead className="sticky top-0 z-10 bg-paper/95 backdrop-blur">
                <tr className="border-b border-line">
                  {["Date", "Merchant", "Category", "Source", "Amount", "Flag"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className={cn(
                          "px-5 py-2.5",
                          heading === "Amount" && "text-right",
                        )}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={cn(
                      "border-b border-line/70 last:border-0",
                      transaction.anomaly
                        ? "bg-ember-soft/15 hover:bg-ember-soft/25"
                        : "hover:bg-paper/45",
                    )}
                  >
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-[0.7rem] text-ink-soft">
                      {formatDate(transaction.date)}
                      {transaction.time && (
                        <span className="ml-1.5 text-[0.6rem] text-ink-faint">
                          {transaction.time}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="max-w-[18rem] truncate text-[0.8rem] font-semibold text-ink">
                        {transaction.merchant}
                      </p>
                      {transaction.receiptFile && (
                        <p className="max-w-[18rem] truncate text-[0.62rem] text-ink-faint">
                          {transaction.receiptFile}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-md border border-line bg-paper/70 px-2 py-0.5 text-[0.62rem] font-semibold text-ink-soft">
                        {transaction.category}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <SourceBadge source={transaction.source} />
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-5 py-3 text-right font-mono text-[0.76rem] font-semibold",
                        transaction.direction === "credit"
                          ? "text-forest"
                          : "text-ink",
                      )}
                    >
                      {transaction.direction === "credit" ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowDownLeft className="h-3 w-3" />+
                          {formatMoney(transaction.amount, transaction.currency)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3" />-
                          {formatMoney(transaction.amount, transaction.currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {transaction.anomaly ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.06em]",
                            SEVERITY_CLASSES[transaction.anomaly.severity],
                          )}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {transaction.anomaly.severity}
                        </span>
                      ) : (
                        <span className="text-[0.62rem] text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divide-y divide-line md:hidden">
              {visibleTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={cn(
                    "flex items-start justify-between gap-3 px-4 py-3.5",
                    transaction.anomaly && "bg-ember-soft/15",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.8rem] font-semibold text-ink">
                      {transaction.merchant}
                    </p>
                    <p className="mt-0.5 text-[0.64rem] leading-relaxed text-ink-faint">
                      {formatDate(transaction.date)}
                      {transaction.time ? ` · ${transaction.time}` : ""} ·{" "}
                      {transaction.category}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <SourceBadge source={transaction.source} />
                      {transaction.anomaly && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.06em]",
                            SEVERITY_CLASSES[transaction.anomaly.severity],
                          )}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {transaction.anomaly.severity}
                        </span>
                      )}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 font-mono text-[0.78rem] font-semibold",
                      transaction.direction === "credit"
                        ? "text-forest"
                        : "text-ink",
                    )}
                  >
                    {transaction.direction === "credit" ? "+" : "-"}
                    {formatMoney(transaction.amount, transaction.currency)}
                  </p>
                </div>
              ))}
            </div>

            {visibleTransactions.length === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                {normalizedQuery ? (
                  <Search className="h-6 w-6 text-forest" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-forest" />
                )}
                <p className="mt-2 text-sm font-bold text-ink">
                  {normalizedQuery
                    ? "No matching transactions"
                    : "Nothing flagged in this ledger"}
                </p>
                <p className="mt-1 text-[0.72rem] text-ink-faint">
                  {normalizedQuery
                    ? "Try a different merchant, category, or file name."
                    : "Switch back to “All” to see every transaction."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-card/70 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            <p className="max-w-2xl text-[0.74rem] leading-relaxed text-ink-soft">
              This result came from a TEE-hosted model and was checked against
              hardware attestation. The app kept no copy of your files. Download
              the proof JSON to keep the cryptographic evidence; the receipts and
              statement rows are not included.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadProof}
            className="btn btn-primary btn-sm shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download proof
          </button>
        </div>
      </section>
    </div>
  );
}
