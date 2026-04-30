import type { Eip1193Provider, JsonRpcSigner } from "ethers";
import type { GeneratedReport } from "../report";

type UploadStage = "wallet" | "source" | "report";

export type StorageUploadProgress = {
  stage: UploadStage;
  message: string;
};

export type StorageUploadReceipt = {
  sourceRootHash: string;
  reportRootHash: string;
  sourceTxHash: string;
  reportTxHash: string;
};

export type UploadProofNoteArtifactsInput = {
  title: string;
  sourceText: string;
  report: GeneratedReport;
  onProgress?: (progress: StorageUploadProgress) => void;
};

type SdkMerkleTree = {
  rootHash: () => string;
};

type SdkFile = {
  merkleTree: () => Promise<[SdkMerkleTree | null, Error | null]>;
  size: () => number;
};

type SdkUploadResult =
  | {
      txHash: string;
      rootHash: string;
      txSeq: number;
    }
  | {
      txHashes: string[];
      rootHashes: string[];
      txSeqs: number[];
    };

type SdkIndexer = {
  upload: (
    file: SdkFile,
    blockchainRpc: string,
    signer: JsonRpcSigner,
    uploadOptions?: {
      expectedReplica?: number;
      onProgress?: (message: string) => void;
    }
  ) => Promise<[SdkUploadResult, Error | null]>;
};

type ZgStorageBrowserModule = {
  Blob: new (file: File) => SdkFile;
  Indexer: new (url: string) => SdkIndexer;
};

type UploadArtifactResult = {
  rootHash: string;
  txHash: string;
};

type OgStorageConfig = {
  chainId: number | null;
  chainName: string;
  rpcUrl: string;
  indexerRpcUrl: string;
  explorerUrl: string;
  expectedReplica: number;
};

const defaultOgRpcUrl = "https://evmrpc-testnet.0g.ai";
const defaultIndexerRpcUrl = "https://indexer-storage-testnet-turbo.0g.ai";

// Data flow: this browser-only module receives source/report text from the UI,
// asks the user's wallet for a signer, then uploads both in-memory files through
// the official 0G TypeScript SDK. No backend secret or private key is used here.
export async function uploadProofNoteArtifacts({
  title,
  sourceText,
  report,
  onProgress
}: UploadProofNoteArtifactsInput): Promise<StorageUploadReceipt> {
  const config = readOgStorageConfig();
  const ethereum = getInjectedEthereum();

  onProgress?.({ stage: "wallet", message: "Requesting wallet access" });
  await ethereum.request({ method: "eth_requestAccounts" });
  await switchToConfiguredChain(ethereum, config);

  const [{ BrowserProvider }, zgStorageModule] = await Promise.all([
    import("ethers"),
    loadZgStorageBrowserModule()
  ]);
  const { Blob: ZgBlob, Indexer } = zgStorageModule;
  const browserProvider = new BrowserProvider(ethereum);
  const signer = await browserProvider.getSigner();
  const indexer = new Indexer(config.indexerRpcUrl);

  const sourceFile = createTextFile(sourceText, `${sanitizeFileName(title)}.txt`, {
    type: "text/plain;charset=utf-8"
  });
  const reportFile = createTextFile(JSON.stringify(report, null, 2), `${sanitizeFileName(title)}.report.json`, {
    type: "application/json;charset=utf-8"
  });

  const sourceUpload = await uploadArtifact({
    file: new ZgBlob(sourceFile),
    label: "source",
    indexer,
    signer,
    config,
    onProgress
  });
  const reportUpload = await uploadArtifact({
    file: new ZgBlob(reportFile),
    label: "report",
    indexer,
    signer,
    config,
    onProgress
  });

  return {
    sourceRootHash: sourceUpload.rootHash,
    reportRootHash: reportUpload.rootHash,
    sourceTxHash: sourceUpload.txHash,
    reportTxHash: reportUpload.txHash
  };
}

export function buildExplorerTxUrl(txHash: string) {
  const explorerUrl = process.env.NEXT_PUBLIC_OG_EXPLORER_URL?.trim();

  if (!explorerUrl) {
    return "";
  }

  const normalizedUrl = explorerUrl.replace(/\/$/, "");

  if (/\/tx$/i.test(normalizedUrl)) {
    return `${normalizedUrl}/${txHash}`;
  }

  return `${normalizedUrl}/tx/${txHash}`;
}

async function uploadArtifact({
  file,
  label,
  indexer,
  signer,
  config,
  onProgress
}: {
  file: SdkFile;
  label: "source" | "report";
  indexer: SdkIndexer;
  signer: JsonRpcSigner;
  config: OgStorageConfig;
  onProgress?: (progress: StorageUploadProgress) => void;
}): Promise<UploadArtifactResult> {
  onProgress?.({ stage: label, message: `Computing ${label} root hash` });

  const [tree, treeError] = await file.merkleTree();

  if (treeError || !tree) {
    throw new Error(
      `Failed to compute ${label} root hash: ${treeError?.message ?? "unknown error"}`
    );
  }

  onProgress?.({ stage: label, message: `Uploading ${label} to 0G Storage` });

  const [uploadResult, uploadError] = await indexer.upload(
    file,
    config.rpcUrl,
    signer,
    {
      expectedReplica: config.expectedReplica,
      onProgress: (message) =>
        onProgress?.({ stage: label, message: `${label}: ${message}` })
    }
  );

  if (uploadError) {
    throw new Error(`Failed to upload ${label}: ${uploadError.message}`);
  }

  return normalizeUploadResult(uploadResult, label, tree.rootHash());
}

function normalizeUploadResult(
  uploadResult: SdkUploadResult,
  label: "source" | "report",
  expectedRootHash: string
): UploadArtifactResult {
  if ("txHash" in uploadResult && "rootHash" in uploadResult) {
    if (!uploadResult.txHash || !uploadResult.rootHash) {
      throw new Error(`0G returned an empty ${label} upload receipt.`);
    }

    return {
      txHash: uploadResult.txHash,
      rootHash: uploadResult.rootHash || expectedRootHash
    };
  }

  if (
    uploadResult.txHashes.length === 1 &&
    uploadResult.rootHashes.length === 1
  ) {
    return {
      txHash: uploadResult.txHashes[0],
      rootHash: uploadResult.rootHashes[0] || expectedRootHash
    };
  }

  throw new Error(
    `0G returned multiple ${label} fragments. Multi-root upload display is not implemented yet.`
  );
}

async function switchToConfiguredChain(
  ethereum: Eip1193Provider,
  config: OgStorageConfig
) {
  if (!config.chainId) {
    return;
  }

  const chainIdHex = `0x${config.chainId.toString(16)}`;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }]
    });
  } catch (error) {
    if (getProviderErrorCode(error) !== 4902 || !config.rpcUrl) {
      throw new Error(
        `Please switch your wallet to ${config.chainName} before uploading.`
      );
    }

    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: config.chainName,
          rpcUrls: [config.rpcUrl],
          nativeCurrency: {
            name: "A0GI",
            symbol: "A0GI",
            decimals: 18
          },
          blockExplorerUrls: config.explorerUrl ? [config.explorerUrl] : []
        }
      ]
    });
  }
}

function readOgStorageConfig(): OgStorageConfig {
  const chainIdValue = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID);
  const expectedReplicaValue = Number(
    process.env.NEXT_PUBLIC_OG_EXPECTED_REPLICA
  );

  return {
    chainId: Number.isFinite(chainIdValue) && chainIdValue > 0 ? chainIdValue : null,
    chainName: process.env.NEXT_PUBLIC_OG_CHAIN_NAME || "0G Galileo Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_OG_RPC_URL || defaultOgRpcUrl,
    indexerRpcUrl:
      process.env.NEXT_PUBLIC_OG_STORAGE_INDEXER_URL || defaultIndexerRpcUrl,
    explorerUrl: process.env.NEXT_PUBLIC_OG_EXPLORER_URL || "",
    expectedReplica:
      Number.isFinite(expectedReplicaValue) && expectedReplicaValue > 0
        ? expectedReplicaValue
        : 1
  };
}

function createTextFile(
  content: string,
  fileName: string,
  options: FilePropertyBag
) {
  return new File([content], fileName, {
    ...options,
    lastModified: Date.now()
  });
}

async function loadZgStorageBrowserModule() {
  return (await import(
    "@0gfoundation/0g-ts-sdk/browser"
  )) as unknown as ZgStorageBrowserModule;
}

function sanitizeFileName(value: string) {
  const sanitizedValue = value
    .trim()
    .replace(/\.(txt|md)$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return sanitizedValue || "proofnote-report";
}

function getInjectedEthereum(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Install a wallet such as MetaMask to upload to 0G Storage.");
  }

  return window.ethereum;
}

function getProviderErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }

  return null;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
