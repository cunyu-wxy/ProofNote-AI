import type { Eip1193Provider } from "ethers";
import { proofNoteRegistryAbi } from "../contracts/proofNoteRegistryAbi";
import { assertExpectedSignerAddress } from "./wallet";

const defaultOgRpcUrl = "https://evmrpc-testnet.0g.ai";
const defaultOgExplorerUrl = "https://chainscan-galileo.0g.ai";
export type RecordReportInput = {
  title: string;
  sourceRootHash: string;
  reportRootHash: string;
  metadataRootHash: string;
  contractAddress: string;
  expectedWalletAddress?: string;
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
  metadataRootHash,
  contractAddress,
  expectedWalletAddress
}: RecordReportInput): Promise<RegistryRecordReceipt> {
  const ethereum = getInjectedEthereum();
  const { BrowserProvider, Contract, getAddress, isAddress } = await import("ethers");
  const registryAddress = readRegistryAddress(isAddress, contractAddress);

  await ethereum.request({ method: "eth_requestAccounts" });

  const browserProvider = new BrowserProvider(ethereum);
  const signer = await browserProvider.getSigner();
  await assertExpectedSignerAddress({
    signer,
    expectedWalletAddress,
    getAddress,
    isAddress
  });

  const registry = new Contract(
    registryAddress,
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
      contractAddress: registryAddress
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

export async function getReportFromChain(
  id: bigint,
  contractAddress: string
): Promise<RegistryReport> {
  const { Contract, JsonRpcProvider, isAddress } = await import("ethers");
  const registryAddress = readRegistryAddress(isAddress, contractAddress);
  const rpcUrl = readConfiguredRpcUrl();
  const provider = new JsonRpcProvider(rpcUrl);
  const registry = new Contract(
    registryAddress,
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
  const explorerUrl =
    process.env.NEXT_PUBLIC_OG_EXPLORER_URL?.trim() || defaultOgExplorerUrl;

  return `${explorerUrl.replace(/\/$/, "")}/address/${address}`;
}

function readRegistryAddress(
  isAddress: (value: string) => boolean,
  configuredAddress: string
) {
  const contractAddress = configuredAddress.trim();

  if (!contractAddress) {
    throw new Error(
      "Enter the ProofNoteRegistry contract address in Runtime Settings before using on-chain records."
    );
  }

  if (!isAddress(contractAddress)) {
    throw new Error("ProofNoteRegistry contract address is not a valid EVM address.");
  }

  return contractAddress;
}

function readConfiguredRpcUrl() {
  return process.env.NEXT_PUBLIC_OG_RPC_URL?.trim() || defaultOgRpcUrl;
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
