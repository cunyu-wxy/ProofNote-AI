import { NextRequest, NextResponse } from "next/server";
import {
  buildMockReport,
  GenerateReportInput,
  GeneratedReport,
  isGeneratedReport,
  reportJsonSchema
} from "../../../lib/report";

export const runtime = "nodejs";

const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const sourceTextMaxLength = 60_000;
const instructionMaxLength = 2_000;
const titleMaxLength = 160;

type ErrorResponse = {
  error: string;
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

// Data flow: the browser sends only user-provided text to this route.
// The route keeps OPENAI_API_KEY on the server, calls OpenAI when configured,
// validates the returned JSON schema, then sends the report back to the page.
export async function POST(request: NextRequest) {
  const parsedBody = await parseRequestBody(request);

  if (!parsedBody.ok) {
    return NextResponse.json<ErrorResponse>(
      { error: parsedBody.error },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json<GeneratedReport>(buildMockReport(parsedBody.data));
  }

  try {
    const report = await generateReportWithOpenAI(parsedBody.data);
    return NextResponse.json<GeneratedReport>(report);
  } catch (error) {
    console.error("Report generation failed", error);

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

  const title = readString(body.title).trim();
  const sourceText = readString(body.sourceText).trim();
  const instruction = readString(body.instruction).trim();

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

  return {
    ok: true,
    data: {
      title,
      sourceText,
      instruction
    }
  };
}

async function generateReportWithOpenAI(
  input: GenerateReportInput
): Promise<GeneratedReport> {
  const response = await fetch(openAiResponsesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
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

  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readOpenAIError(responseBody, response.status));
  }

  const outputText = extractOutputText(responseBody);
  const parsedReport = parseReportJson(outputText);

  if (!isGeneratedReport(parsedReport)) {
    throw new Error("OpenAI returned JSON that does not match the report schema.");
  }

  return parsedReport;
}

function parseReportJson(outputText: string) {
  try {
    return JSON.parse(outputText) as unknown;
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }
}

function extractOutputText(responseBody: unknown) {
  if (!isRecord(responseBody)) {
    throw new Error("OpenAI returned an invalid response body.");
  }

  const typedBody = responseBody as OpenAIResponseBody;

  if (typeof typedBody.output_text === "string") {
    return typedBody.output_text;
  }

  if (!Array.isArray(typedBody.output)) {
    throw new Error("OpenAI response did not include output text.");
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

  throw new Error("OpenAI response output text was empty.");
}

function readOpenAIError(responseBody: unknown, status: number) {
  if (isRecord(responseBody) && isRecord(responseBody.error)) {
    const message = responseBody.error.message;

    if (typeof message === "string") {
      return `OpenAI request failed: ${message}`;
    }
  }

  return `OpenAI request failed with status ${status}.`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Report generation failed.";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
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
