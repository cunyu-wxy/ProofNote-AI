"use client";

import { useEffect, useState } from "react";
import {
  clearStoredRuntimeConfig,
  defaultRuntimeConfig,
  readStoredRuntimeConfig,
  RuntimeConfig,
  writeStoredRuntimeConfig
} from "./runtimeConfig";

export function useRuntimeConfig() {
  const [runtimeConfig, setRuntimeConfig] =
    useState<RuntimeConfig>(defaultRuntimeConfig);

  useEffect(() => {
    setRuntimeConfig(readStoredRuntimeConfig());
  }, []);

  function updateRuntimeConfig(patch: Partial<RuntimeConfig>) {
    setRuntimeConfig((currentConfig) => {
      const nextConfig = {
        ...currentConfig,
        ...patch
      };

      writeStoredRuntimeConfig(nextConfig);
      return nextConfig;
    });
  }

  function resetRuntimeConfig() {
    clearStoredRuntimeConfig();
    setRuntimeConfig(defaultRuntimeConfig);
  }

  return {
    runtimeConfig,
    updateRuntimeConfig,
    resetRuntimeConfig
  };
}
