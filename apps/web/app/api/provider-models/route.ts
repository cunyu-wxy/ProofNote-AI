import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const defaultOpenAIBaseUrl = "https://api.openai.com/v1";

type ErrorResponse = {
  error: string;
};

type ModelsResponse = {
  models: string[];
};

type ProviderModelsRequest = {
  apiKey?: string;
  baseUrl?: string;
};

export async function POST(request: NextRequest) {
  const parsedBody = await parseRequestBody(request);

  if (!parsedBody.ok) {
    return NextResponse.json<ErrorResponse>(
      { error: parsedBody.error },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(buildModelsUrl(parsedBody.baseUrl), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${parsedBody.apiKey}`,
        "Content-Type": "application/json"
      }
    });
    const responseBody = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return NextResponse.json<ErrorResponse>(
        { error: readProviderError(responseBody, response.status) },
        { status: 502 }
      );
    }

    const models = extractModelIds(responseBody);

    if (models.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "Provider /models returned no model ids." },
        { status: 502 }
      );
    }

    return NextResponse.json<ModelsResponse>({ models });
  } catch (error) {
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
      apiKey: string;
      baseUrl: string;
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

  const typedBody = body as ProviderModelsRequest;
  const apiKey = readString(typedBody.apiKey).trim();
  const baseUrl =
    readString(typedBody.baseUrl).trim() || defaultOpenAIBaseUrl;

  if (!apiKey) {
    return { ok: false, error: "Enter an API key before loading models." };
  }

  if (!isAllowedProviderUrl(baseUrl)) {
    return {
      ok: false,
      error: "Base URL must be an http(s) OpenAI-compatible endpoint."
    };
  }

  return {
    ok: true,
    apiKey,
    baseUrl
  };
}

function buildModelsUrl(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (/\/models$/i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl;
  }

  if (/\/responses$/i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl.replace(/\/responses$/i, "/models");
  }

  if (/\/chat\/completions$/i.test(normalizedBaseUrl)) {
    return normalizedBaseUrl.replace(/\/chat\/completions$/i, "/models");
  }

  return `${normalizedBaseUrl}/models`;
}

function extractModelIds(responseBody: unknown) {
  const candidates = collectModelCandidates(responseBody);
  const modelIds = candidates
    .map(readModelId)
    .filter((modelId): modelId is string => Boolean(modelId));

  return Array.from(new Set(modelIds)).sort((left, right) =>
    left.localeCompare(right)
  );
}

function collectModelCandidates(responseBody: unknown) {
  if (Array.isArray(responseBody)) {
    return responseBody;
  }

  if (!isRecord(responseBody)) {
    return [];
  }

  if (Array.isArray(responseBody.data)) {
    return responseBody.data;
  }

  if (Array.isArray(responseBody.models)) {
    return responseBody.models;
  }

  return [];
}

function readModelId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value) && typeof value.id === "string") {
    return value.id;
  }

  if (isRecord(value) && typeof value.name === "string") {
    return value.name;
  }

  return "";
}

function isAllowedProviderUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function readProviderError(responseBody: unknown, status: number) {
  if (isRecord(responseBody) && isRecord(responseBody.error)) {
    const message = responseBody.error.message;

    if (typeof message === "string") {
      return `Provider /models request failed: ${message}`;
    }
  }

  return `Provider /models request failed with status ${status}.`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to load provider models.";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
