import { NextRequest, NextResponse } from "next/server";
import {
  buildMockReport,
  GenerateReportInput,
  GeneratedReport,
  isGeneratedReport,
  reportJsonSchema
} from "../../../lib/report";

export const runtime = "nodejs";

const defaultOpenAIBaseUrl = "https://api.openai.com/v1";
const defaultOpenAIModel = "gpt-5.4-mini";
const sourceTextMaxLength = 60_000;
const instructionMaxLength = 2_000;
const titleMaxLength = 160;

type ErrorResponse = {
  error: string;
};

type GenerateReportRequest = GenerateReportInput & {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

type OpenAIConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ResponseOutputContent = {
  type?: unknown;
  text?: unknown;
};

type ResponseOutputItem = {
  type?: unknown;
  content?: unknown;
};

type OpenAIResponseBody = {
  output_text?: unknown;
  output?: unknown;
  error?: unknown;
};

type ChatCompletionBody = {
  choices?: unknown;
  error?: unknown;
};

type ProviderRequestResult = {
  ok: boolean;
  status: number;
  body: unknown;
  endpoint: "responses" | "chat.completions";
};

// Data flow: the browser sends source text plus request-scoped provider
// settings. The API key is used only for this one server-side request; it is
// not read from .env, logged, stored, or exposed back to the browser.
export async function POST(request: NextRequest) {
  const parsedBody = await parseRequestBody(request);

  if (!parsedBody.ok) {
    return NextResponse.json<ErrorResponse>(
      { error: parsedBody.error },
      { status: 400 }
    );
  }

  if (!parsedBody.config.apiKey) {
    return NextResponse.json<GeneratedReport>(
      buildMockReport(parsedBody.data)
    );
  }

  try {
    const report = await generateReportWithProvider(
      parsedBody.data,
      parsedBody.config
    );
    return NextResponse.json<GeneratedReport>(report);
  } catch (error) {
    console.error("Report generation failed", getLogSafeErrorMessage(error));

    return NextResponse.json<ErrorResponse>(
      { error: getErrorMessage(error) },
      { status: 502 }
    );
  }
}

async function parseRequestBody(
  request: NextRequest
): Promise<
  | {
      ok: true;
      data: GenerateReportInput;
      config: OpenAIConfig;
    }
  | {
      ok: false;
      error: string;
    }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "Request body must be valid JSON." };
  }

  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const typedBody = body as GenerateReportRequest;
  const title = readString(typedBody.title).trim();
  const sourceText = readString(typedBody.sourceText).trim();
  const instruction = readString(typedBody.instruction).trim();
  const apiKey = readString(typedBody.apiKey).trim();
  const baseUrl =
    readString(typedBody.baseUrl).trim() || defaultOpenAIBaseUrl;
  const model = readString(typedBody.model).trim() || defaultOpenAIModel;

  if (!title) {
    return { ok: false, error: "title is required." };
  }

  if (title.length > titleMaxLength) {
    return { ok: false, error: `title must be ${titleMaxLength} characters or less.` };
  }

  if (!sourceText) {
    return { ok: false, error: "sourceText is required." };
  }

  if (sourceText.length > sourceTextMaxLength) {
    return {
      ok: false,
      error: `sourceText must be ${sourceTextMaxLength} characters or less.`
    };
  }

  if (instruction.length > instructionMaxLength) {
    return {
      ok: false,
      error: `instruction must be ${instructionMaxLength} characters or less.`
    };
  }

  if (apiKey && !isAllowedProviderUrl(baseUrl)) {
    return {
      ok: false,
      error: "Base URL must be an http(s) OpenAI-compatible endpoint."
    };
  }

  return {
    ok: true,
    data: {
      title,
      sourceText,
      instruction
    },
    config: {
      apiKey,
      baseUrl,
      model
    }
  };
}

async function generateReportWithProvider(
  input: GenerateReportInput,
  config: OpenAIConfig
): Promise<GeneratedReport> {
  const urls = buildProviderUrls(config.baseUrl);
  const firstResult =
    urls.preferredEndpoint === "chat.completions"
      ? await requestChatCompletions(input, config, urls.chatCompletionsUrl, true)
      : await requestResponses(input, config, urls.responsesUrl);
  const result =
    shouldTryAlternateEndpoint(firstResult)
      ? await requestChatCompletions(input, config, urls.chatCompletionsUrl, true)
      : firstResult;
  const finalResult =
    shouldRetryChatWithoutSchema(result)
      ? await requestChatCompletions(input, config, urls.chatCompletionsUrl, false)
      : result;

  if (!finalResult.ok) {
    throw new Error(
      readProviderError(finalResult.body, finalResult.status, finalResult.endpoint)
    );
  }

  const outputText =
    finalResult.endpoint === "responses"
      ? extractResponsesOutputText(finalResult.body)
      : extractChatCompletionText(finalResult.body);
  const normalizedReport = normalizeGeneratedReport(
    parseReportJson(outputText),
    input
  );

  if (!isGeneratedReport(normalizedReport)) {
    throw new Error("The provider returned JSON that does not match the report schema.");
  }

  return normalizedReport;
}

async function requestResponses(
  input: GenerateReportInput,
  config: OpenAIConfig,
  url: string
): Promise<ProviderRequestResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      instructions:
        "You generate concise diligence reports from user-provided source text. Use only the source text and the user's instruction. Return JSON that exactly matches the provided schema.",
      input: [
        `Title: ${input.title}`,
        `Instruction: ${input.instruction || "Summarize the source."}`,
        "Source text:",
        input.sourceText
      ].join("\n\n"),
      text: {
        format: {
          type: "json_schema",
          name: "proofnote_report",
          strict: true,
          schema: reportJsonSchema
        }
      },
      store: false
    })
  });

  return {
    ok: response.ok,
    status: response.status,
    body: (await response.json().catch(() => null)) as unknown,
    endpoint: "responses"
  };
}

async function requestChatCompletions(
  input: GenerateReportInput,
  config: OpenAIConfig,
  url: string,
  useJsonSchema: boolean
): Promise<ProviderRequestResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You generate concise diligence reports from user-provided source text. Return only valid JSON that exactly matches the ProofNote report schema."
        },
        {
          role: "user",
          content: [
            `Title: ${input.title}`,
            `Instruction: ${input.instruction || "Summarize the source."}`,
            "Source text:",
            input.sourceText
          ].join("\n\n")
        }
      ],
      response_format: useJsonSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: "proofnote_report",
              strict: true,
              schema: reportJsonSchema
            }
          }
        : {
            type: "json_object"
          }
    })
  });

  return {
    ok: response.ok,
    status: response.status,
    body: (await response.json().catch(() => null)) as unknown,
    endpoint: "chat.completions"
  };
}

function buildProviderUrls(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (/\/responses$/i.test(normalizedBaseUrl)) {
    return {
      responsesUrl: normalizedBaseUrl,
      chatCompletionsUrl: normalizedBaseUrl.replace(
        /\/responses$/i,
        "/chat/completions"
      ),
      preferredEndpoint: "responses" as const
    };
  }

  if (/\/chat\/completions$/i.test(normalizedBaseUrl)) {
    return {
      responsesUrl: normalizedBaseUrl.replace(
        /\/chat\/completions$/i,
        "/responses"
      ),
      chatCompletionsUrl: normalizedBaseUrl,
      preferredEndpoint: "chat.completions" as const
    };
  }

  return {
    responsesUrl: `${normalizedBaseUrl}/responses`,
    chatCompletionsUrl: `${normalizedBaseUrl}/chat/completions`,
    preferredEndpoint: "responses" as const
  };
}

function shouldTryAlternateEndpoint(result: ProviderRequestResult) {
  return result.endpoint === "responses" && (result.status === 404 || result.status === 405);
}

function shouldRetryChatWithoutSchema(result: ProviderRequestResult) {
  if (result.endpoint !== "chat.completions" || result.ok) {
    return false;
  }

  const message = readProviderError(result.body, result.status, result.endpoint).toLowerCase();

  return (
    result.status === 400 &&
    (message.includes("response_format") ||
      message.includes("json_schema") ||
      message.includes("json object"))
  );
}

function isAllowedProviderUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function parseReportJson(outputText: string) {
  const trimmedText = outputText.trim();
  const unfencedText = trimmedText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfencedText) as unknown;
  } catch {
    const jsonStart = unfencedText.indexOf("{");
    const jsonEnd = unfencedText.lastIndexOf("}");

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(unfencedText.slice(jsonStart, jsonEnd + 1)) as unknown;
      } catch {
        throw new Error("The provider returned invalid JSON.");
      }
    }

    throw new Error("The provider returned invalid JSON.");
  }
}

function normalizeGeneratedReport(
  providerValue: unknown,
  input: GenerateReportInput
): GeneratedReport {
  if (isGeneratedReport(providerValue)) {
    return providerValue;
  }

  const fallbackReport = buildMockReport(input);
  const reportValue = unwrapReportValue(providerValue);

  if (!isRecord(reportValue)) {
    return fallbackReport;
  }

  const keyPoints =
    readStringArray(reportValue.key_points) ||
    readStringArray(reportValue.keyPoints) ||
    readStringArray(reportValue.keypoints) ||
    readStringArray(reportValue.points) ||
    readStringArray(reportValue.highlights) ||
    fallbackReport.key_points;
  const risks =
    normalizeRisks(reportValue.risks) ||
    normalizeRisks(reportValue.risk_assessment) ||
    normalizeRisks(reportValue.riskAssessment) ||
    fallbackReport.risks;

  return {
    title:
      readString(reportValue.title) ||
      readString(reportValue.report_title) ||
      readString(reportValue.reportTitle) ||
      fallbackReport.title,
    summary:
      readString(reportValue.summary) ||
      readString(reportValue.abstract) ||
      readString(reportValue.overview) ||
      fallbackReport.summary,
    key_points: keyPoints.length > 0 ? keyPoints : fallbackReport.key_points,
    risks: risks.length > 0 ? risks : fallbackReport.risks,
    conclusion:
      readString(reportValue.conclusion) ||
      readString(reportValue.recommendation) ||
      readString(reportValue.final_assessment) ||
      readString(reportValue.finalAssessment) ||
      fallbackReport.conclusion
  };
}

function unwrapReportValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return parseReportJson(value);
    } catch {
      return value;
    }
  }

  if (!isRecord(value)) {
    return value;
  }

  return (
    readRecord(value.report) ||
    readRecord(value.generated_report) ||
    readRecord(value.generatedReport) ||
    readRecord(value.data) ||
    readRecord(value.result) ||
    value
  );
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (isRecord(item)) {
        return (
          readString(item.text) ||
          readString(item.point) ||
          readString(item.description) ||
          readString(item.summary)
        );
      }

      return "";
    })
    .filter(Boolean);

  return strings.length > 0 ? strings : null;
}

function normalizeRisks(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return [
      {
        level: "medium" as const,
        description: value.trim(),
        evidence: value.trim()
      }
    ];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const risks = value
    .map(normalizeRisk)
    .filter((risk): risk is GeneratedReport["risks"][number] => Boolean(risk));

  return risks.length > 0 ? risks : null;
}

function normalizeRisk(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return {
      level: "medium" as const,
      description: value.trim(),
      evidence: value.trim()
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const description =
    readString(value.description) ||
    readString(value.risk) ||
    readString(value.issue) ||
    readString(value.title) ||
    readString(value.summary);

  if (!description) {
    return null;
  }

  return {
    level: normalizeRiskLevel(
      readString(value.level) ||
        readString(value.severity) ||
        readString(value.risk_level) ||
        readString(value.riskLevel)
    ),
    description,
    evidence:
      readString(value.evidence) ||
      readString(value.reason) ||
      readString(value.detail) ||
      readString(value.source) ||
      description
  };
}

function normalizeRiskLevel(value: string): GeneratedReport["risks"][number]["level"] {
  const normalizedValue = value.toLowerCase();

  if (normalizedValue.includes("high") || normalizedValue.includes("critical")) {
    return "high";
  }

  if (normalizedValue.includes("low")) {
    return "low";
  }

  return "medium";
}

function extractResponsesOutputText(responseBody: unknown) {
  if (!isRecord(responseBody)) {
    throw new Error("The provider returned an invalid response body.");
  }

  const typedBody = responseBody as OpenAIResponseBody;

  if (typeof typedBody.output_text === "string") {
    return typedBody.output_text;
  }

  if (!Array.isArray(typedBody.output)) {
    throw new Error("The provider response did not include output text.");
  }

  for (const item of typedBody.output) {
    if (!isResponseOutputItem(item) || !Array.isArray(item.content)) {
      continue;
    }

    const textContent = item.content.find(
      (content): content is ResponseOutputContent =>
        isResponseOutputContent(content) && content.type === "output_text"
    );

    if (typeof textContent?.text === "string") {
      return textContent.text;
    }
  }

  throw new Error("The provider response output text was empty.");
}

function extractChatCompletionText(responseBody: unknown) {
  if (!isRecord(responseBody)) {
    throw new Error("The provider returned an invalid chat response body.");
  }

  const typedBody = responseBody as ChatCompletionBody;

  if (!Array.isArray(typedBody.choices)) {
    throw new Error("The provider chat response did not include choices.");
  }

  for (const choice of typedBody.choices) {
    if (!isRecord(choice) || !isRecord(choice.message)) {
      continue;
    }

    const content = choice.message.content;

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      const textContent = content.find(
        (item) => isRecord(item) && typeof item.text === "string"
      );

      if (isRecord(textContent) && typeof textContent.text === "string") {
        return textContent.text;
      }
    }
  }

  throw new Error("The provider chat response content was empty.");
}

function readProviderError(
  responseBody: unknown,
  status: number,
  endpoint: ProviderRequestResult["endpoint"]
) {
  if (isRecord(responseBody) && isRecord(responseBody.error)) {
    const message = responseBody.error.message;

    if (typeof message === "string") {
      return `Provider ${endpoint} request failed: ${message}`;
    }
  }

  return `Provider ${endpoint} request failed with status ${status}.`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Report generation failed.";
}

function getLogSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown error";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function isResponseOutputItem(value: unknown): value is ResponseOutputItem {
  return isRecord(value);
}

function isResponseOutputContent(value: unknown): value is ResponseOutputContent {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
