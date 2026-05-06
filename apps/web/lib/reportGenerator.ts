import { GenerateReportInput, GeneratedReport, isGeneratedReport } from "./report";
import { RuntimeConfig } from "./runtimeConfig";

export async function generateReportInBrowser(
  input: GenerateReportInput,
  config: RuntimeConfig
): Promise<GeneratedReport> {
  const response = await fetch("/api/generate-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...input,
      apiKey: config.openAiApiKey,
      baseUrl: config.openAiBaseUrl,
      model: config.openAiModel
    })
  });

  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readApiError(responseBody, response.status));
  }

  if (!isGeneratedReport(responseBody)) {
    throw new Error("The API returned JSON that does not match the report schema.");
  }

  return responseBody;
}

function readApiError(responseBody: unknown, status: number) {
  if (status === 404) {
    return "Local report API route was not found. Refresh the page; if it persists, restart pnpm dev.";
  }

  if (isRecord(responseBody) && isRecord(responseBody.error)) {
    const message = responseBody.error.message;

    if (typeof message === "string") {
      return message;
    }
  }

  if (
    isRecord(responseBody) &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return `Report generation failed with status ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
