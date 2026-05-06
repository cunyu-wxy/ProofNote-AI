export type RuntimeConfig = {
  openAiApiKey: string;
  openAiBaseUrl: string;
  openAiModel: string;
  expectedWalletAddress: string;
  registryAddress: string;
};

const runtimeConfigStorageKey = "proofnote-runtime-config-v1";

export const defaultRuntimeConfig: RuntimeConfig = {
  openAiApiKey: "",
  openAiBaseUrl: "https://api.openai.com/v1",
  openAiModel: "gpt-5.4-mini",
  expectedWalletAddress: "",
  registryAddress: ""
};

export function readStoredRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return defaultRuntimeConfig;
  }

  const storedConfig = window.sessionStorage.getItem(runtimeConfigStorageKey);

  if (!storedConfig) {
    return defaultRuntimeConfig;
  }

  try {
    return normalizeRuntimeConfig(JSON.parse(storedConfig));
  } catch {
    return defaultRuntimeConfig;
  }
}

export function writeStoredRuntimeConfig(config: RuntimeConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    runtimeConfigStorageKey,
    JSON.stringify(normalizeRuntimeConfig(config))
  );
}

export function clearStoredRuntimeConfig() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(runtimeConfigStorageKey);
}

export function normalizeRuntimeConfig(value: unknown): RuntimeConfig {
  if (!isRecord(value)) {
    return defaultRuntimeConfig;
  }

  return {
    openAiApiKey: readString(value.openAiApiKey),
    openAiBaseUrl:
      readString(value.openAiBaseUrl) || defaultRuntimeConfig.openAiBaseUrl,
    openAiModel:
      readString(value.openAiModel) || defaultRuntimeConfig.openAiModel,
    expectedWalletAddress: readString(value.expectedWalletAddress),
    registryAddress: readString(value.registryAddress)
  };
}

export function isEvmAddressLike(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
