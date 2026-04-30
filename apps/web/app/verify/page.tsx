"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  ShieldCheck
} from "lucide-react";
import {
  buildExplorerAddressUrl,
  buildStorageRootUrl,
  getReportFromChain,
  readConfiguredRegistryAddress,
  RegistryReport
} from "../../lib/og/registry";

export default function VerifyPage() {
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<RegistryReport | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const contractAddress = readConfiguredRegistryAddress();
  const createdAtLabel = useMemo(() => {
    if (!report) {
      return "";
    }

    return formatTimestamp(report.createdAt);
  }, [report]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedReportId = parseReportId(reportId);

    if (parsedReportId === null) {
      setReport(null);
      setStatusMessage("Invalid report ID");
      setErrorMessage("Report ID must be a non-negative whole number.");
      return;
    }

    setIsLoading(true);
    setReport(null);
    setStatusMessage("Reading registry");
    setErrorMessage("");

    try {
      const registryReport = await getReportFromChain(parsedReportId);
      setReport(registryReport);
      setStatusMessage("Report found");
    } catch (error) {
      setStatusMessage("Verification failed");
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 text-slate-950 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-900"
              href="/"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to generator
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Verify report
            </h1>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {statusMessage}
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Lookup</h2>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-semibold text-slate-800">
                Report ID
                <input
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-blue-200 transition focus:border-blue-600 focus:ring-4"
                  inputMode="numeric"
                  min="0"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={reportId}
                  onChange={(event) => setReportId(event.target.value)}
                />
              </label>

              {errorMessage ? (
                <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {errorMessage}
                </div>
              ) : null}

              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                type="submit"
                disabled={isLoading}
              >
                <FileSearch className="h-4 w-4" aria-hidden="true" />
                {isLoading ? "Verifying..." : "Verify report"}
              </button>
            </form>

            <div className="mt-5 rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Registry contract
              </p>
              <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-700">
                {contractAddress || "Not configured"}
              </p>
              {contractAddress ? (
                <ExternalAnchor
                  href={buildExplorerAddressUrl(contractAddress)}
                  label="Open contract"
                />
              ) : null}
            </div>
          </aside>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Registry Record</h2>
              </div>

              {report ? (
                <div className="mt-5 space-y-3">
                  <Field label="Title" value={report.title} />
                  <Field label="Owner" value={report.owner} />
                  <Field
                    label="Source root hash"
                    value={report.sourceRootHash}
                    href={buildStorageRootUrl(report.sourceRootHash)}
                  />
                  <Field
                    label="Report root hash"
                    value={report.reportRootHash}
                    href={buildStorageRootUrl(report.reportRootHash)}
                  />
                  <Field
                    label="Metadata root hash"
                    value={report.metadataRootHash}
                    href={buildStorageRootUrl(report.metadataRootHash)}
                  />
                  <Field label="Created at" value={createdAtLabel} />
                </div>
              ) : (
                <div className="mt-5 flex min-h-96 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Enter a report ID to read the on-chain registry record.
                </div>
              )}
            </div>

            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-700" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Verification Result</h2>
              </div>

              <div className="mt-5 rounded-md bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {report ? "Registry record exists" : "No report loaded"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {report
                    ? "The report ID resolves to a ProofNoteRegistry record with source, report, and metadata root hashes."
                    : "Verification will check whether the report ID exists in the configured ProofNoteRegistry contract."}
                </p>
              </div>

              {report ? (
                <div className="mt-4 space-y-3 text-sm">
                  <CheckRow label="Owner address present" value={Boolean(report.owner)} />
                  <CheckRow
                    label="Source root present"
                    value={Boolean(report.sourceRootHash)}
                  />
                  <CheckRow
                    label="Report root present"
                    value={Boolean(report.reportRootHash)}
                  />
                  <CheckRow
                    label="Metadata root present"
                    value={Boolean(report.metadataRootHash)}
                  />
                </div>
              ) : null}
            </aside>
          </section>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  href
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        {href ? <ExternalAnchor href={href} label={`Open ${label}`} compact /> : null}
      </div>
      <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <span className="text-slate-700">{label}</span>
      <span className={value ? "font-semibold text-teal-700" : "font-semibold text-red-700"}>
        {value ? "Pass" : "Missing"}
      </span>
    </div>
  );
}

function ExternalAnchor({
  href,
  label,
  compact = false
}: {
  href: string;
  label: string;
  compact?: boolean;
}) {
  if (!href) {
    return null;
  }

  return (
    <a
      className={
        compact
          ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-blue-600 hover:text-blue-700"
          : "mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-900"
      }
      href={href}
      rel="noreferrer"
      target="_blank"
      aria-label={label}
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      {compact ? null : label}
    </a>
  );
}

function parseReportId(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

function formatTimestamp(value: bigint) {
  const timestampMs = Number(value) * 1000;

  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return value.toString();
  }

  return `${new Date(timestampMs).toLocaleString()} (${value.toString()})`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Verification failed.";
}
