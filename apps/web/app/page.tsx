"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  ListChecks,
  ShieldCheck,
  Upload,
  Wand2
} from "lucide-react";
import { GeneratedReport, isGeneratedReport, RiskLevel } from "../lib/report";
import {
  buildExplorerTxUrl,
  StorageUploadReceipt,
  uploadProofNoteArtifacts
} from "../lib/og/storage";
import {
  buildExplorerAddressUrl,
  readConfiguredRegistryAddress,
  recordReportOnChain,
  RegistryRecordReceipt
} from "../lib/og/registry";

const maxPreviewLength = 1400;

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [generatedReport, setGeneratedReport] =
    useState<GeneratedReport | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting for upload");
  const [errorMessage, setErrorMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [storageMessage, setStorageMessage] = useState("Not uploaded");
  const [storageReceipt, setStorageReceipt] =
    useState<StorageUploadReceipt | null>(null);
  const [registryMessage, setRegistryMessage] = useState("Not recorded");
  const [registryReceipt, setRegistryReceipt] =
    useState<RegistryRecordReceipt | null>(null);

  const hasSource = sourceText.trim().length > 0;
  const registryContractAddress =
    registryReceipt?.contractAddress || readConfiguredRegistryAddress();
  const reportJson = useMemo(() => {
    if (!generatedReport) {
      return "";
    }

    return JSON.stringify(generatedReport, null, 2);
  }, [generatedReport]);
  const sourcePreview = useMemo(() => {
    if (!sourceText) {
      return "";
    }

    return sourceText.length > maxPreviewLength
      ? `${sourceText.slice(0, maxPreviewLength).trim()}...`
      : sourceText;
  }, [sourceText]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    setErrorMessage("");

    if (!selectedFile) {
      return;
    }

    if (!/\.(txt|md)$/i.test(selectedFile.name)) {
      setFileName("");
      setSourceText("");
      setGeneratedReport(null);
      setStorageReceipt(null);
      setStorageMessage("Not uploaded");
      setRegistryReceipt(null);
      setRegistryMessage("Not recorded");
      setStatusMessage("Unsupported file");
      setErrorMessage("Please upload a .txt or .md file.");
      event.target.value = "";
      return;
    }

    const text = await selectedFile.text();
    setFileName(selectedFile.name);
    setSourceText(text);
    setGeneratedReport(null);
    setStorageReceipt(null);
    setStorageMessage("Not uploaded");
    setRegistryReceipt(null);
    setRegistryMessage("Not recorded");
    setStatusMessage("Source ready");
  }

  async function handleGenerateReport() {
    if (!hasSource) {
      setStatusMessage("Upload required");
      setErrorMessage("Upload a .txt or .md source file before generating.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Generating report");
    setStorageReceipt(null);
    setStorageMessage("Not uploaded");
    setRegistryReceipt(null);
    setRegistryMessage("Not recorded");
    setErrorMessage("");

    try {
      // Data flow: the browser reads the local file, then sends only title,
      // source text, and instruction to the server route. API keys stay server-side.
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: fileName.replace(/\.(txt|md)$/i, "") || "ProofNote report",
          sourceText,
          instruction
        })
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        throw new Error(readApiError(payload));
      }

      if (!isGeneratedReport(payload)) {
        throw new Error("The API returned an invalid report schema.");
      }

      setGeneratedReport(payload);
      setStorageReceipt(null);
      setStorageMessage("Ready to upload");
      setRegistryReceipt(null);
      setRegistryMessage("Not recorded");
      setStatusMessage("Report generated");
    } catch (error) {
      setGeneratedReport(null);
      setStorageReceipt(null);
      setRegistryReceipt(null);
      setStatusMessage("Generation failed");
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleUploadToStorage() {
    if (!generatedReport) {
      setErrorMessage("Generate a report before uploading to 0G Storage.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setStorageReceipt(null);
    setStorageMessage("Preparing wallet");
    setRegistryReceipt(null);
    setRegistryMessage("Not recorded");

    let storageUploaded = false;

    try {
      // Data flow: source/report content is already in browser memory; this
      // call asks the wallet to sign 0G Storage uploads and returns root/tx IDs.
      const receipt = await uploadProofNoteArtifacts({
        title: generatedReport.title || fileName || "ProofNote report",
        sourceText,
        report: generatedReport,
        onProgress: (progress) => setStorageMessage(progress.message)
      });

      setStorageReceipt(receipt);
      storageUploaded = true;
      setStorageMessage("Uploaded to 0G Storage");
      setRegistryMessage("Waiting for wallet transaction");
      setStatusMessage("Recording on chain");

      // Current MVP uses the uploaded report JSON root as metadataRootHash
      // until a separate metadata artifact is introduced.
      const onChainReceipt = await recordReportOnChain({
        title: generatedReport.title,
        sourceRootHash: receipt.sourceRootHash,
        reportRootHash: receipt.reportRootHash,
        metadataRootHash: receipt.reportRootHash
      });

      setRegistryReceipt(onChainReceipt);
      setRegistryMessage("Recorded on chain");
      setStatusMessage("Proof recorded");
    } catch (error) {
      if (!storageUploaded) {
        setStorageMessage("Upload failed");
      } else {
        setRegistryMessage("Record failed");
      }
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-6 text-slate-950 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              ProofNote AI
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
              Local report generator
            </h1>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {statusMessage}
          </div>
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-600 hover:text-blue-900"
            href="/verify"
          >
            Verify report
          </Link>
        </header>

        <section className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Input</h2>
            </div>

            <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-blue-600 hover:bg-blue-50">
              <FileText className="h-8 w-8 text-slate-500" aria-hidden="true" />
              <span className="mt-3 text-sm font-semibold text-slate-800">
                {fileName || "Choose a .txt or .md file"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                File content is read in your browser.
              </span>
              <input
                className="sr-only"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileChange}
              />
            </label>

            <label className="mt-5 block text-sm font-semibold text-slate-800">
              Report instruction
              <textarea
                className="mt-2 h-32 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-600 focus:ring-4"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Example: summarize the evidence, risks, and final recommendation."
              />
            </label>

            {errorMessage ? (
              <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {errorMessage}
              </div>
            ) : null}

            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="button"
              onClick={handleGenerateReport}
              disabled={!hasSource || isGenerating}
            >
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              {isGenerating ? "Generating..." : "Generate report"}
            </button>

            <div className="mt-5 rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Source preview
              </p>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
                {sourcePreview || "No source loaded yet."}
              </pre>
            </div>
          </aside>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-teal-700" aria-hidden="true" />
                <h2 className="text-lg font-semibold">Structured Report</h2>
              </div>

              {generatedReport ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <h3 className="text-2xl font-semibold">
                      {generatedReport.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {generatedReport.summary}
                    </p>
                  </div>

                  <ReportSection title="Key Points">
                    <ul className="space-y-2 text-sm text-slate-700">
                      {generatedReport.key_points.map((point) => (
                        <li
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                          key={point}
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </ReportSection>

                  <ReportSection title="Risks">
                    <div className="grid gap-3 md:grid-cols-2">
                      {generatedReport.risks.map((risk) => (
                        <article
                          className="rounded-md border border-slate-200 bg-white p-3"
                          key={`${risk.level}-${risk.description}`}
                        >
                          <RiskBadge level={risk.level} />
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {risk.description}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {risk.evidence}
                          </p>
                        </article>
                      ))}
                    </div>
                  </ReportSection>

                  <ReportSection title="Conclusion">
                    <p className="text-sm leading-6 text-slate-700">
                      {generatedReport.conclusion}
                    </p>
                  </ReportSection>
                </div>
              ) : (
                <div className="mt-5 flex min-h-96 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Upload a source file and generate a report to preview the schema output.
                </div>
              )}
            </div>

            <div className="space-y-5">
              <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-violet-700" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">Report JSON</h2>
                </div>
                <pre className="mt-5 min-h-72 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                  {reportJson || "{\n  \"title\": \"\",\n  \"summary\": \"\",\n  \"key_points\": [],\n  \"risks\": [],\n  \"conclusion\": \"\"\n}"}
                </pre>
              </aside>

              <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-700" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">0G Storage</h2>
                </div>

                <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {storageMessage}
                </div>

                {storageReceipt ? (
                  <div className="mt-4 space-y-3">
                    <ProofField
                      label="Source root hash"
                      value={storageReceipt.sourceRootHash}
                    />
                    <ProofField
                      label="Report root hash"
                      value={storageReceipt.reportRootHash}
                    />
                    <ProofField
                      label="Source tx hash"
                      value={storageReceipt.sourceTxHash}
                      href={buildExplorerTxUrl(storageReceipt.sourceTxHash)}
                    />
                    <ProofField
                      label="Report tx hash"
                      value={storageReceipt.reportTxHash}
                      href={buildExplorerTxUrl(storageReceipt.reportTxHash)}
                    />
                  </div>
                ) : null}

                <button
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                  onClick={handleUploadToStorage}
                  disabled={!generatedReport || isUploading}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {isUploading ? "Publishing..." : "Upload and record proof"}
                </button>
              </aside>

              <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-teal-700" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">On-chain Record</h2>
                </div>

                <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {registryMessage}
                </div>

                <div className="mt-4 space-y-3">
                  <ProofField
                    label="Contract address"
                    value={registryContractAddress || "Not configured"}
                    href={
                      registryContractAddress
                        ? buildExplorerAddressUrl(registryContractAddress)
                        : ""
                    }
                  />
                  {registryReceipt ? (
                    <ProofField
                      label="Registry tx hash"
                      value={registryReceipt.transactionHash}
                      href={buildExplorerTxUrl(registryReceipt.transactionHash)}
                    />
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function ReportSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const levelClasses = {
    low: "bg-teal-50 text-teal-700 ring-teal-200",
    medium: "bg-amber-50 text-amber-700 ring-amber-200",
    high: "bg-red-50 text-red-700 ring-red-200"
  };

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] ring-1 ${levelClasses[level]}`}
    >
      {level}
    </span>
  );
}

function ProofField({
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
        {href ? (
          <a
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-blue-600 hover:text-blue-700"
            href={href}
            rel="noreferrer"
            target="_blank"
            aria-label={`Open ${label}`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <p className="mt-2 break-all font-mono text-xs leading-5 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function readApiError(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Report generation failed.";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Report generation failed.";
}
