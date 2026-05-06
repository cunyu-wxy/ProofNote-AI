import type {
  Eip1193Provider,
  JsonRpcSigner,
  JsonRpcProvider,
  TransactionRequest
} from "ethers";
import type { GeneratedReport } from "../report";
import { assertExpectedSignerAddress } from "./wallet";

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
  sourceTxSeq: number;
  reportTxSeq: number;
};

export type UploadProofNoteArtifactsInput = {
  title: string;
  sourceText: string;
  report: GeneratedReport;
  expectedWalletAddress?: string;
  onProgress?: (progress: StorageUploadProgress) => void;
};

export type ComputeSourceRootHashInput = {
  sourceText: string;
  title?: string;
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
  selectNodes: (
    expectedReplica: number,
    method?: "min" | "max" | "random"
  ) => Promise<[SdkStorageNode[], Error | null]>;
  upload: (
    file: SdkFile,
    blockchainRpc: string,
    signer: JsonRpcSigner,
    uploadOptions?: {
      expectedReplica?: number;
      onProgress?: (message: string) => void;
    },
    retryOptions?: unknown,
    transactionOptions?: {
      gasLimit?: bigint;
      gasPrice?: bigint;
    }
  ) => Promise<[SdkUploadResult, Error | null]>;
};

type ZgStorageBrowserModule = {
  Blob: new (file: File) => SdkFile;
  Indexer: new (url: string) => SdkIndexer;
};

type SdkStorageNode = {
  getStatus: () => Promise<{
    networkIdentity?: {
      chainId?: number;
      flowAddress?: string;
    };
  }>;
};

type BrowserWalletProvider = {
  getNetwork: () => Promise<{ chainId: bigint }>;
};

type FlowContract = {
  market: () => Promise<string>;
};

type FlowContractConstructor = typeof import("ethers").Contract;

type UploadArtifactResult = {
  rootHash: string;
  txHash: string;
  txSeq: number;
};

type OgStorageConfig = {
  chainId: number | null;
  chainName: string;
  rpcUrl: string;
  indexerRpcUrl: string;
  explorerUrl: string;
  expectedReplica: number;
  flowAddress: string;
  gasLimit: bigint;
};

const defaultChainName = "0G-Testnet-Galileo";
const defaultOgRpcUrl = "https://evmrpc-testnet.0g.ai";
const defaultIndexerRpcUrl = "https://indexer-storage-testnet-turbo.0g.ai";
const defaultFlowAddress = "0x22e03a6a89b950f1c82ec5e74f8eca321a105296";

// Data flow: this browser-only module receives source/report text from the UI,
// asks the user's wallet for a signer, then uploads both in-memory files through
// the official 0G TypeScript SDK. No backend secret or private key is used here.
export async function uploadProofNoteArtifacts({
  title,
  sourceText,
  report,
  expectedWalletAddress,
  onProgress
}: UploadProofNoteArtifactsInput): Promise<StorageUploadReceipt> {
  const config = readOgStorageConfig();
  const ethereum = getInjectedEthereum();

  onProgress?.({ stage: "wallet", message: "Requesting wallet access" });
  await ethereum.request({ method: "eth_requestAccounts" });
  await switchToConfiguredChain(ethereum, config);

  const [
    { BrowserProvider, Contract, JsonRpcProvider, getAddress, isAddress },
    zgStorageModule
  ] =
    await Promise.all([
    import("ethers"),
    loadZgStorageBrowserModule()
  ]);
  const { Blob: ZgBlob, Indexer } = zgStorageModule;
  const browserProvider = new BrowserProvider(ethereum);
  const signer = await browserProvider.getSigner();
  const readProvider = new JsonRpcProvider(config.rpcUrl);
  const uploadRunner = createStorageContractRunner(signer, readProvider);
  const indexer = new Indexer(config.indexerRpcUrl);

  await assertExpectedSignerAddress({
    signer,
    expectedWalletAddress,
    getAddress,
    isAddress
  });

  await validateStorageNetwork({
    browserProvider,
    readProvider,
    Contract,
    indexer,
    config
  });

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
    signer: uploadRunner,
    config,
    onProgress
  });
  const reportUpload = await uploadArtifact({
    file: new ZgBlob(reportFile),
    label: "report",
    indexer,
    signer: uploadRunner,
    config,
    onProgress
  });

  return {
    sourceRootHash: sourceUpload.rootHash,
    reportRootHash: reportUpload.rootHash,
    sourceTxHash: sourceUpload.txHash,
    reportTxHash: reportUpload.txHash,
    sourceTxSeq: sourceUpload.txSeq,
    reportTxSeq: reportUpload.txSeq
  };
}

export async function computeSourceRootHash({
  sourceText,
  title = "proofnote-source"
}: ComputeSourceRootHashInput) {
  const { Blob: ZgBlob } = await loadZgStorageBrowserModule();
  const sourceFile = createTextFile(sourceText, `${sanitizeFileName(title)}.txt`, {
    type: "text/plain;charset=utf-8"
  });

  return computeFileRootHash(new ZgBlob(sourceFile), "source");
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

export function buildStorageSubmissionUrl(txSeq: number) {
  const storageExplorerUrl =
    process.env.NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL?.trim() ||
    "https://storagescan-galileo.0g.ai";

  if (!Number.isFinite(txSeq) || txSeq < 0) {
    return "";
  }

  return `${storageExplorerUrl.replace(/\/$/, "")}/submission/${txSeq}`;
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

  const rootHash = await computeFileRootHash(file, label);

  onProgress?.({ stage: label, message: `Uploading ${label} to 0G Storage` });

  let uploadResult: SdkUploadResult;
  let uploadError: Error | null;

  try {
    [uploadResult, uploadError] = await indexer.upload(
      file,
      config.rpcUrl,
      signer,
      {
        expectedReplica: config.expectedReplica,
        onProgress: (message) =>
          onProgress?.({ stage: label, message: `${label}: ${message}` })
      },
      undefined,
      {
        gasLimit: config.gasLimit
      }
    );
  } catch (error) {
    throw normalizeStorageSdkError(error, label, config);
  }

  if (uploadError) {
    throw normalizeStorageSdkError(uploadError, label, config);
  }

  return normalizeUploadResult(uploadResult, label, rootHash);
}

async function computeFileRootHash(file: SdkFile, label: "source" | "report") {
  const [tree, treeError] = await file.merkleTree();

  if (treeError || !tree) {
    throw new Error(
      `Failed to compute ${label} root hash: ${treeError?.message ?? "unknown error"}`
    );
  }

  return tree.rootHash();
}

async function validateStorageNetwork({
  browserProvider,
  readProvider,
  Contract,
  indexer,
  config
}: {
  browserProvider: BrowserWalletProvider;
  readProvider: JsonRpcProvider;
  Contract: FlowContractConstructor;
  indexer: SdkIndexer;
  config: OgStorageConfig;
}) {
  const network = await browserProvider.getNetwork();
  const walletChainId = Number(network.chainId);
  const rpcNetwork = await readProvider.getNetwork();
  const rpcChainId = Number(rpcNetwork.chainId);

  if (config.chainId && walletChainId !== config.chainId) {
    throw new Error(
      `Wallet is connected to chain ${walletChainId}. Switch to ${config.chainName} (${config.chainId}) and retry.`
    );
  }

  if (config.chainId && rpcChainId !== config.chainId) {
    throw new Error(
      `Configured 0G RPC returned chain ${rpcChainId}, expected ${config.chainId}. Check NEXT_PUBLIC_OG_RPC_URL.`
    );
  }

  const flowAddress = await resolveFlowAddress(indexer, config);
  const flowCode = await readProvider.getCode(flowAddress);

  if (!flowCode || flowCode === "0x") {
    throw new Error(buildFlowRpcError(flowAddress, config, rpcChainId));
  }

  try {
    const flowContract = new Contract(
      flowAddress,
      ["function market() view returns (address)"],
      readProvider
    ) as unknown as FlowContract;
    const marketAddress = await flowContract.market();

    if (!isAddressLike(marketAddress)) {
      throw new Error(`market() returned ${marketAddress || "an empty address"}`);
    }
  } catch (error) {
    throw normalizeStorageSdkError(error, "source", {
      ...config,
      flowAddress
    });
  }
}

async function resolveFlowAddress(indexer: SdkIndexer, config: OgStorageConfig) {
  try {
    const [nodes, selectError] = await indexer.selectNodes(
      config.expectedReplica,
      "min"
    );

    if (selectError || nodes.length === 0) {
      return config.flowAddress;
    }

    const status = await nodes[0].getStatus();
    const nodeChainId = status.networkIdentity?.chainId;
    const nodeFlowAddress = status.networkIdentity?.flowAddress;

    if (
      config.chainId &&
      typeof nodeChainId === "number" &&
      nodeChainId !== config.chainId
    ) {
      throw new Error(
        `0G Storage node is on chain ${nodeChainId}, but the app is configured for ${config.chainId}. Check NEXT_PUBLIC_OG_STORAGE_INDEXER_URL.`
      );
    }

    return nodeFlowAddress || config.flowAddress;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Storage node is on chain")) {
      throw error;
    }

    return config.flowAddress;
  }
}

function normalizeStorageSdkError(
  error: unknown,
  label: "source" | "report",
  config: OgStorageConfig
) {
  const message = getUnknownErrorMessage(error);

  if (isFlowMarketDecodeError(error, message)) {
    return new Error(
      `Failed to upload ${label}: the wallet RPC could not read 0G Storage Flow market() at ${config.flowAddress}. Edit the ${config.chainName} network in MetaMask to use RPC ${config.rpcUrl}, refresh the page, and retry.`
    );
  }

  if (message.includes("market() returned")) {
    return new Error(
      `Failed to upload ${label}: 0G Storage Flow market() returned invalid data at ${config.flowAddress}. Check NEXT_PUBLIC_OG_RPC_URL and NEXT_PUBLIC_OG_STORAGE_INDEXER_URL.`
    );
  }

  return new Error(`Failed to upload ${label}: ${message}`);
}

function buildFlowRpcError(
  flowAddress: string,
  config: OgStorageConfig,
  rpcChainId: number
) {
  return `0G Storage Flow contract was not found at ${flowAddress} through configured RPC ${config.rpcUrl} on chain ${rpcChainId}. Check NEXT_PUBLIC_OG_RPC_URL and NEXT_PUBLIC_OG_FLOW_ADDRESS.`;
}

function isFlowMarketDecodeError(error: unknown, message: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "BAD_DATA" &&
    "info" in error &&
    typeof error.info === "object" &&
    error.info !== null
  ) {
    const info = error.info as { method?: unknown; signature?: unknown };

    return info.method === "market" || info.signature === "market()";
  }

  return message.includes("could not decode result data") && message.includes("market");
}

function isAddressLike(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
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
      rootHash: uploadResult.rootHash || expectedRootHash,
      txSeq: uploadResult.txSeq
    };
  }

  if (
    uploadResult.txHashes.length === 1 &&
    uploadResult.rootHashes.length === 1 &&
    uploadResult.txSeqs.length === 1
  ) {
    return {
      txHash: uploadResult.txHashes[0],
      rootHash: uploadResult.rootHashes[0] || expectedRootHash,
      txSeq: uploadResult.txSeqs[0]
    };
  }

  throw new Error(
    `0G returned multiple ${label} fragments. Multi-root upload display is not implemented yet.`
  );
}

function createStorageContractRunner(
  signer: JsonRpcSigner,
  readProvider: JsonRpcProvider
) {
  return {
    provider: readProvider,
    getAddress: () => signer.getAddress(),
    call: (transaction: TransactionRequest) => readProvider.call(transaction),
    estimateGas: (transaction: TransactionRequest) =>
      readProvider.estimateGas(transaction),
    resolveName: (name: string) => readProvider.resolveName(name),
    sendTransaction: (transaction: TransactionRequest) =>
      signer.sendTransaction(transaction)
  } as unknown as JsonRpcSigner;
}

async function switchToConfiguredChain(
  ethereum: Eip1193Provider,
  config: OgStorageConfig
) {
  if (!config.chainId) {
    return;
  }

  const chainIdHex = `0x${config.chainId.toString(16)}`;
  const chainParams = buildWalletChainParams(chainIdHex, config);

  try {
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [chainParams]
    });
  } catch (error) {
    if (getProviderErrorCode(error) === 4001) {
      throw new Error(
        `Wallet network update rejected. Approve the ${config.chainName} network update so MetaMask uses ${config.rpcUrl}.`
      );
    }
  }

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
      params: [chainParams]
    });
  }
}

function buildWalletChainParams(chainIdHex: string, config: OgStorageConfig) {
  return {
    chainId: chainIdHex,
    chainName: config.chainName,
    rpcUrls: [config.rpcUrl],
    nativeCurrency: {
      name: "0G",
      symbol: "0G",
      decimals: 18
    },
    blockExplorerUrls: config.explorerUrl ? [config.explorerUrl] : []
  };
}

function readOgStorageConfig(): OgStorageConfig {
  const chainIdValue = Number(process.env.NEXT_PUBLIC_OG_CHAIN_ID);
  const expectedReplicaValue = Number(
    process.env.NEXT_PUBLIC_OG_EXPECTED_REPLICA
  );
  const gasLimitValue = Number(process.env.NEXT_PUBLIC_OG_STORAGE_GAS_LIMIT);

  return {
    chainId: Number.isFinite(chainIdValue) && chainIdValue > 0 ? chainIdValue : null,
    chainName: process.env.NEXT_PUBLIC_OG_CHAIN_NAME || defaultChainName,
    rpcUrl: process.env.NEXT_PUBLIC_OG_RPC_URL || defaultOgRpcUrl,
    indexerRpcUrl:
      process.env.NEXT_PUBLIC_OG_STORAGE_INDEXER_URL || defaultIndexerRpcUrl,
    explorerUrl: process.env.NEXT_PUBLIC_OG_EXPLORER_URL || "",
    expectedReplica:
      Number.isFinite(expectedReplicaValue) && expectedReplicaValue > 0
        ? expectedReplicaValue
        : 1,
    flowAddress:
      process.env.NEXT_PUBLIC_OG_FLOW_ADDRESS?.trim() || defaultFlowAddress,
    gasLimit:
      Number.isFinite(gasLimitValue) && gasLimitValue > 0
        ? BigInt(Math.floor(gasLimitValue))
        : BigInt(500000)
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

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "unknown error";
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
