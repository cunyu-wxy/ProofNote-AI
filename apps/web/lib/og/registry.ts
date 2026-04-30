import type { Eip1193Provider } from "ethers";
import { proofNoteRegistryAbi } from "../contracts/proofNoteRegistryAbi";

export type RecordReportInput = {
  title: string;
  sourceRootHash: string;
  reportRootHash: string;
  metadataRootHash: string;
};

export type RegistryRecordReceipt = {
  transactionHash: string;
  contractAddress: string;
};

export type RegistryReport = {
  owner: string;
  title: string;
  sourceRootHash: string;
  reportRootHash: string;
  metadataRootHash: string;
  createdAt: bigint;
};

type RegistryTransaction = {
  hash: string;
  wait: () => Promise<{
    hash?: string;
    transactionHash?: string;
  } | null>;
};

type ProofNoteRegistryContract = {
  recordReport: (
    title: string,
    sourceRootHash: string,
    reportRootHash: string,
    metadataRootHash: string
  ) => Promise<RegistryTransaction>;
  getReport: (id: bigint) => Promise<
    | [
        string,
        string,
        string,
        string,
        string,
        bigint
      ]
    | {
        owner: string;
        title: string;
        sourceRootHash: string;
        reportRootHash: string;
        metadataRootHash: string;
        createdAt: bigint;
      }
  >;
};

// Data flow: storage upload returns public root hashes, then this browser-only
// module asks the wallet to submit recordReport() to ProofNoteRegistry. The
// contract address is public config; no private key is stored in the app.
export async function recordReportOnChain({
  title,
  sourceRootHash,
  reportRootHash,
  metadataRootHash
}: RecordReportInput): Promise<RegistryRecordReceipt> {
  const ethereum = getInjectedEthereum();
  const { BrowserProvider, Contract, isAddress } = await import("ethers");
  const contractAddress = readRegistryAddress(isAddress);

  await ethereum.request({ method: "eth_requestAccounts" });

  const browserProvider = new BrowserProvider(ethereum);
  const signer = await browserProvider.getSigner();
  const registry = new Contract(
    contractAddress,
    proofNoteRegistryAbi,
    signer
  ) as unknown as ProofNoteRegistryContract;

  try {
    const transaction = await registry.recordReport(
      title,
      sourceRootHash,
      reportRootHash,
      metadataRootHash
    );
    const receipt = await transaction.wait();

    return {
      transactionHash:
        receipt?.hash ?? receipt?.transactionHash ?? transaction.hash,
      contractAddress
    };
  } catch (error) {
    if (isRejectedWalletAction(error)) {
      throw new Error(
        "Wallet transaction rejected. Storage upload succeeded, but the report was not recorded on chain."
      );
    }

    throw new Error(`Failed to record report on chain: ${readErrorMessage(error)}`);
  }
}

export function readConfiguredRegistryAddress() {
  return process.env.NEXT_PUBLIC_PROOFNOTE_REGISTRY_ADDRESS?.trim() ?? "";
}

export async function getReportFromChain(id: bigint): Promise<RegistryReport> {
  const { Contract, JsonRpcProvider, isAddress } = await import("ethers");
  const contractAddress = readRegistryAddress(isAddress);
  const rpcUrl = readConfiguredRpcUrl();
  const provider = new JsonRpcProvider(rpcUrl);
  const registry = new Contract(
    contractAddress,
    proofNoteRegistryAbi,
    provider
  ) as unknown as ProofNoteRegistryContract;

  try {
    return normalizeRegistryReport(await registry.getReport(id));
  } catch (error) {
    throw new Error(`Failed to read report #${id.toString()}: ${readErrorMessage(error)}`);
  }
}

export function buildExplorerAddressUrl(address: string) {
  const explorerUrl = process.env.NEXT_PUBLIC_OG_EXPLORER_URL?.trim();

  if (!explorerUrl) {
    return "";
  }

  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}

export function buildStorageRootUrl(rootHash: string) {
  const storageExplorerUrl =
    process.env.NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL?.trim();

  if (!storageExplorerUrl) {
    return "";
  }

  const normalizedUrl = storageExplorerUrl.replace(/\/$/, "");

  if (/\/(file|root|object|hash)$/i.test(normalizedUrl)) {
    return `${normalizedUrl}/${rootHash}`;
  }

  return `${normalizedUrl}/file/${rootHash}`;
}

function readRegistryAddress(isAddress: (value: string) => boolean) {
  const contractAddress = readConfiguredRegistryAddress();

  if (!contractAddress) {
    throw new Error(
      "Set NEXT_PUBLIC_PROOFNOTE_REGISTRY_ADDRESS before recording reports on chain."
    );
  }

  if (!isAddress(contractAddress)) {
    throw new Error("NEXT_PUBLIC_PROOFNOTE_REGISTRY_ADDRESS is not valid.");
  }

  return contractAddress;
}

function readConfiguredRpcUrl() {
  const rpcUrl = process.env.NEXT_PUBLIC_OG_RPC_URL?.trim();

  if (!rpcUrl) {
    throw new Error("Set NEXT_PUBLIC_OG_RPC_URL before verifying reports.");
  }

  return rpcUrl;
}

function normalizeRegistryReport(
  report:
    | [
        string,
        string,
        string,
        string,
        string,
        bigint
      ]
    | {
        owner: string;
        title: string;
        sourceRootHash: string;
        reportRootHash: string;
        metadataRootHash: string;
        createdAt: bigint;
      }
): RegistryReport {
  if (Array.isArray(report)) {
    return {
      owner: report[0],
      title: report[1],
      sourceRootHash: report[2],
      reportRootHash: report[3],
      metadataRootHash: report[4],
      createdAt: report[5]
    };
  }

  return report;
}

function getInjectedEthereum(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Install a wallet such as MetaMask to record on chain.");
  }

  return window.ethereum;
}

function isRejectedWalletAction(error: unknown) {
  const code = readErrorCode(error);
  const message = readErrorMessage(error).toLowerCase();

  return (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    message.includes("user rejected") ||
    message.includes("user denied") ||
    message.includes("rejected the request")
  );
}

function readErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (typeof error.code === "number" || typeof error.code === "string")
  ) {
    return error.code;
  }

  return null;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "shortMessage" in error &&
    typeof error.shortMessage === "string"
  ) {
    return error.shortMessage;
  }

  return "Unknown error";
}
